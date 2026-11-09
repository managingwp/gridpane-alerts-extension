import * as store from './db.js';
import { normalize, webhookPayload } from './normalize.js';
import { pageOldest, shouldStop, nextCursor, missingIds } from './lib/scan.js';

const BASE = 'https://my.gridpane.com';
const ALARM = 'gp-sync';
const LOOKUP_TTL = 24 * 3600 * 1000;   // server/site names: once a day
const UNKNOWN_LOOKUP_MIN_GAP = 3600 * 1000; // ...or sooner (max hourly) when an alert mentions an unknown one
const PAGE_DELAY = 1500;                // pause between paged requests
const MAX_SYNC_PAGES = 50;              // safety cap for a regular sync
const GAP_AUDIT_PAGES = 12;             // pages compared by the Settings gap audit
// GridPane can insert a notification with a timestamp older than the newest one
// already stored (provisioning notices arrive in a batch). Keep scanning this
// far below the cursor so those alerts are stored instead of skipped forever.
const OVERLAP_SEC = 2 * 3600;
const RATE_LIMIT_STEPS = [5, 15, 30, 60]; // minutes to pause after consecutive 429s
const DEFAULTS = {
  pollMinutes: 5,
  webhookEnabled: false,
  webhookUrl: '',
  webhookSecret: '',
  webhookFormat: 'full', // 'full' | 'chat'
  webhookIncludeBackfill: false,
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getSettings() {
  const { settings = {} } = await chrome.storage.local.get('settings');
  return { ...DEFAULTS, ...settings };
}
async function getState() {
  const { state = {} } = await chrome.storage.local.get('state');
  return state;
}
async function setState(patch) {
  const state = await getState();
  await chrome.storage.local.set({ state: { ...state, ...patch } });
}

// ---------- GridPane fetching ----------

class SignedOutError extends Error {}
class RateLimitError extends Error {
  constructor(retryAfterSec) { super('GridPane rate limit (HTTP 429)'); this.retryAfterSec = retryAfterSec; }
}

const GP_HEADERS = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
let preferTab = false; // set once direct fetches turn out not to carry the session
let run = null;        // counters for the run in progress (requests, 429s)

function retryAfterSeconds(v) {
  if (!v) return null;
  const n = Number(v);
  if (Number.isFinite(n)) return Math.max(0, n);
  const t = Date.parse(v);
  return Number.isFinite(t) ? Math.max(0, Math.round((t - Date.now()) / 1000)) : null;
}

function parseResponse({ status, ct, url, body, retryAfter }) {
  if (status === 429) throw new RateLimitError(retryAfterSeconds(retryAfter));
  if (status === 401 || status === 419 || /\/login(\?|$)/.test(url || '') || !(ct || '').includes('json')) {
    throw new SignedOutError('Not signed in to GridPane');
  }
  if (status < 200 || status >= 300) throw new Error(`GridPane returned ${status}`);
  return JSON.parse(body);
}

async function fetchDirect(path) {
  const r = await fetch(BASE + path, { credentials: 'include', headers: GP_HEADERS });
  return parseResponse({ status: r.status, ct: r.headers.get('content-type'), url: r.url, body: await r.text(), retryAfter: r.headers.get('retry-after') });
}

// Fallback: run the request inside an open GridPane tab, exactly as the panel does.
async function fetchViaTab(path) {
  const tabs = await chrome.tabs.query({ url: BASE + '/*' });
  if (!tabs.length) throw new SignedOutError('Open my.gridpane.com in a tab and sign in');
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tabs[0].id },
    world: 'MAIN',
    args: [path, GP_HEADERS],
    func: async (p, headers) => {
      const r = await fetch(p, { headers, credentials: 'include' });
      return { status: r.status, ct: r.headers.get('content-type'), url: r.url, body: await r.text(), retryAfter: r.headers.get('retry-after') };
    },
  });
  return parseResponse(result);
}

async function gpGetOnce(path) {
  if (run) run.requests++;
  if (!preferTab) {
    try { return await fetchDirect(path); }
    catch (e) { if (!(e instanceof SignedOutError)) throw e; }
  }
  const out = await fetchViaTab(path);
  preferTab = true;
  return out;
}

// Short Retry-After waits are absorbed here; anything longer ends the run.
async function gpGet(path) {
  for (let attempt = 0; ; attempt++) {
    try { return await gpGetOnce(path); }
    catch (e) {
      if (!(e instanceof RateLimitError)) throw e;
      if (run) run.rateLimited++;
      const wait = e.retryAfterSec ?? 10 * (attempt + 1);
      if (attempt >= 2 || wait > 30) throw e;
      await sleep(wait * 1000);
    }
  }
}

// ---------- Server / site name lookups ----------

async function fetchAllPages(path) {
  const out = [];
  for (let p = 1; p <= 300; p++) {
    const j = await gpGet(`${path}?page=${p}`);
    out.push(...(j.data || []));
    if (p >= (j.meta?.last_page ?? 1)) break;
    await sleep(PAGE_DELAY);
  }
  return out;
}

async function refreshLookups(force = false) {
  const cur = (await store.kvGet('lookups')) || { servers: {}, sites: {}, updated_at: 0 };
  if (!force && Date.now() - cur.updated_at < LOOKUP_TTL) return false;
  const servers = await fetchAllPages('/api/v1/servers');
  await sleep(PAGE_DELAY);
  const sites = await fetchAllPages('/api/v1/sites');
  // Merge rather than replace, so deleted servers/sites keep their names in old alerts.
  for (const s of servers) cur.servers[s.id] = { label: s.label, ip: s.ip };
  for (const s of sites) cur.sites[s.id] = { url: s.url, server_id: s.server_id };
  cur.updated_at = Date.now();
  await store.kvSet('lookups', cur);
  return true;
}

// ---------- Storing a page of alerts ----------

// Stores alerts not seen before and queues them for the webhook straight away,
// so an interrupted run never loses a webhook delivery.
async function storeNew(recs, { sendToWebhook }) {
  if (!recs.length) return [];
  const existing = await store.getExisting(recs.map((r) => r.id));
  const now = Date.now();
  const fresh = recs.filter((r) => !existing.has(r.id)).map((r) => ({ ...r, first_seen_at: now }));
  await store.putMany('notifications', fresh);
  if (sendToWebhook && fresh.length) {
    await store.putMany('outbox', fresh.map((r) => ({ id: r.id, created_at: r.created_at, attempts: 0, next_at: 0 })));
  }
  return fresh;
}

// ---------- Runs (sync / history import), logging, rate limiting ----------

let running = null;
function startRun(kind, fn) {
  if (running) return running;
  running = (async () => {
    const before = await getState();
    run = { kind, started: Date.now(), requests: 0, rateLimited: 0, pages: 0, newCount: 0, notes: [], freshRecs: [], floor: 0, capped: false, pageDetail: [], cursorFrom: before.cursor || null };
    await setState({ syncing: true, syncMode: kind, syncPage: 0 });
    let result;
    try {
      const extra = await fn(run);
      await setState({ status: 'ok', lastError: null, rateLimitStreak: 0, backoffUntil: 0, ...(extra || {}) });
      result = { ok: true, status: 'ok' };
    } catch (e) {
      result = await handleRunError(e);
    }
    const wh = await flushOutbox().catch((e) => ({ sent: 0, failed: 0, error: String(e) }));
    const after = await getState();
    const entry = {
      started: run.started, finished: Date.now(), kind, trigger: run.trigger || 'auto',
      status: result.status, pages: run.pages, requests: run.requests, rateLimited: run.rateLimited,
      newCount: run.newCount, webhookSent: wh?.sent || 0, webhookFailed: wh?.failed || 0,
      error: result.error || null, notes: run.notes.join(' · '),
      cursorFrom: run.cursorFrom, cursorTo: after.cursor || null, floor: run.floor, capped: run.capped,
    };
    await store.addLog(entry);
    try {
      const debug = (await store.kvGet('syncDebug')) || [];
      debug.push({
        started: entry.started, kind, trigger: entry.trigger, status: entry.status,
        cursorFrom: entry.cursorFrom, cursorTo: entry.cursorTo, floor: entry.floor, capped: entry.capped,
        pages: run.pageDetail,
      });
      await store.kvSet('syncDebug', debug.slice(-20));
    } catch {}
    const state = await getState();
    await setState({
      syncing: false, lastSync: result.ok ? Date.now() : state.lastSync, lastAttempt: Date.now(),
      unseen: (state.unseen || 0) + (run.countAsUnseen ? run.newCount : 0),
    });
    await updateBadge();
    run = null;
    return { ...result, newCount: entry.newCount };
  })().finally(() => { running = null; });
  return running;
}

async function handleRunError(e) {
  const msg = String(e.message || e);
  if (e instanceof RateLimitError) {
    const state = await getState();
    const streak = (state.rateLimitStreak || 0) + 1;
    const stepMin = RATE_LIMIT_STEPS[Math.min(streak - 1, RATE_LIMIT_STEPS.length - 1)];
    const waitMs = Math.max(stepMin * 60000, (e.retryAfterSec || 0) * 1000);
    const until = Date.now() + waitMs;
    await setState({ status: 'rate_limited', lastError: msg, rateLimitStreak: streak, backoffUntil: until });
    run.notes.push(`paused until ${new Date(until).toLocaleTimeString()}`);
    return { ok: false, status: 'rate_limited', error: msg };
  }
  if (e instanceof SignedOutError) {
    await setState({ status: 'signed_out', lastError: msg });
    return { ok: false, status: 'signed_out', error: msg };
  }
  await setState({ status: 'error', lastError: msg });
  return { ok: false, status: 'error', error: msg };
}

// Regular sync: page back from the newest alert through the overlap window below
// the cursor. Alerts are stored by id, so re-reading a page is harmless; what
// matters is that an alert inserted below the cursor is still seen.
async function syncNew(r, { shallow = false } = {}) {
  const settings = await getSettings();
  const state = await getState();
  let cursor = state.cursor || null;

  // First run (or upgrade): if alerts are already stored, start from the newest one.
  if (!cursor) {
    const all = await store.getAll('notifications');
    const top = all.sort((a, b) => b.created_at - a.created_at)[0];
    if (top) cursor = { id: top.id, created_at: top.created_at };
  }
  const firstRun = !cursor;
  r.countAsUnseen = !firstRun;
  const sendToWebhook = settings.webhookEnabled && settings.webhookUrl && (!firstRun || settings.webhookIncludeBackfill);

  const floor = cursor ? cursor.created_at - OVERLAP_SEC : 0;
  r.floor = floor;

  let newest = null;
  let reached = firstRun;
  const maxPages = shallow ? 1 : MAX_SYNC_PAGES;
  for (let page = 1; page <= maxPages; page++) {
    const j = await gpGet(`/notifications/recent?page=${page}`);
    r.pages = page;
    await setState({ syncPage: page });
    const items = j.notifications || [];
    if (!items.length) { reached = true; break; }
    if (!newest) newest = { id: String(items[0].id), created_at: Number(items[0].created_at) || 0 };

    const fresh = await storeNew(items.map(normalize), { sendToWebhook });
    r.newCount += fresh.length;
    r.freshRecs.push(...fresh);
    r.pageDetail.push({
      page, count: items.length, first: String(items[0].id), last: String(items[items.length - 1].id),
      oldest: pageOldest(items), more: !!j.willLoadMoreNoti,
    });

    if (firstRun || shallow) { reached = true; break; } // page 1 is the whole run
    if (shouldStop({ more: j.willLoadMoreNoti, oldest: pageOldest(items), floor })) { reached = true; break; }
    await sleep(PAGE_DELAY);
  }
  r.capped = !reached;
  if (r.capped) r.notes.push(`stopped at the ${maxPages}-page limit before reaching the ${OVERLAP_SEC / 3600}-hour overlap; anything below it needs the history import`);
  if (firstRun) r.notes.push('first run: started tracking from the newest alerts');

  try {
    // New servers/sites (e.g. a fresh clone) show up as IDs until names are refreshed,
    // so refresh early when a new alert mentions one we don't know (at most hourly).
    const lk = (await store.kvGet('lookups')) || { servers: {}, sites: {}, updated_at: 0 };
    const unknown = r.freshRecs.some((x) => (x.server_id && !lk.servers[x.server_id]) || (x.site_id && !lk.sites[x.site_id]));
    const force = unknown && Date.now() - lk.updated_at > UNKNOWN_LOOKUP_MIN_GAP;
    if (await refreshLookups(force)) r.notes.push(force ? 'server/site names refreshed (new server or site seen)' : 'server/site names refreshed');
  } catch (e) {
    if (e instanceof RateLimitError) r.notes.push('name refresh skipped (rate limited)');
    else r.notes.push(`name refresh failed: ${e.message || e}`);
  }

  // Only move the cursor once the walk reached the overlap floor (or the end of
  // history). A capped walk keeps the old cursor and flags the gap; a shallow
  // run leaves it alone too, so a later manual walk cannot clear the flag
  // without actually filling the gap.
  const next = shallow ? cursor : nextCursor({ reached, newest, current: cursor });
  return { cursor: next, syncGap: shallow ? !!state.syncGap : r.capped };
}

// Manual, resumable import of older alerts. Continues where the last import stopped.
async function importHistory(r) {
  const settings = await getSettings();
  const state = await getState();
  const sendToWebhook = settings.webhookEnabled && settings.webhookUrl && settings.webhookIncludeBackfill;
  let page = state.historyNextPage || 1;
  r.notes.push(`starting at page ${page}`);
  for (;;) {
    const j = await gpGet(`/notifications/recent?page=${page}`);
    r.pages++;
    await setState({ syncPage: page });
    const items = j.notifications || [];
    const fresh = await storeNew(items.map(normalize), { sendToWebhook });
    r.newCount += fresh.length;
    page++;
    await setState({ historyNextPage: page });
    if (!items.length || !j.willLoadMoreNoti) {
      r.notes.push('reached the oldest alert');
      // A finished import means the archive now holds everything the bell still
      // serves, so point the cursor at the newest stored alert and drop the gap
      // flag; the next sync must not re-scan the whole history.
      const all = await store.getAll('notifications');
      const top = all.sort((a, b) => b.created_at - a.created_at)[0];
      return {
        historyDone: true, historyNextPage: 1, syncGap: false,
        ...(top ? { cursor: { id: top.id, created_at: top.created_at } } : {}),
      };
    }
    await sleep(PAGE_DELAY);
  }
}

async function sync(trigger = 'auto') {
  const state = await getState();
  if (trigger === 'auto' && state.backoffUntil && state.backoffUntil > Date.now()) return { ok: false, status: 'waiting' };
  // While a gap is waiting for the history import, automatic checks only take
  // page 1 so new alerts still arrive; a manual sync attempts the full walk.
  const shallow = trigger === 'auto' && !!state.syncGap;
  const p = startRun('sync', async (r) => { r.trigger = trigger; return syncNew(r, { shallow }); });
  return p;
}

// Read-only: compare the newest pages GridPane still serves with what is stored.
async function gapAudit() {
  const remote = [];
  let pages = 0;
  for (let page = 1; page <= GAP_AUDIT_PAGES; page++) {
    const j = await gpGet(`/notifications/recent?page=${page}`);
    const items = j.notifications || [];
    remote.push(...items);
    pages = page;
    if (!items.length || !j.willLoadMoreNoti) break;
    await sleep(PAGE_DELAY);
  }
  const local = await store.getAll('notifications');
  const missing = missingIds(remote, new Set(local.map((r) => r.id)));
  return {
    ok: true,
    checked: remote.length,
    pages,
    missingCount: missing.length,
    missing: missing.slice(0, 50).map((n) => ({
      id: String(n.id),
      created_at: Number(n.created_at) || 0,
      title: n.title || '',
    })),
  };
}

// ---------- Webhook ----------

async function hmac(secret, body) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function postWebhook(settings, payload, id) {
  const body = JSON.stringify(payload);
  const headers = { 'Content-Type': 'application/json', 'X-GPAlerts-Event': 'gridpane.notification' };
  if (id) headers['X-GPAlerts-Id'] = id;
  if (settings.webhookSecret) headers['X-GPAlerts-Signature'] = 'sha256=' + await hmac(settings.webhookSecret, body);
  const r = await fetch(settings.webhookUrl, { method: 'POST', headers, body });
  if (!r.ok) throw new Error(`Webhook returned ${r.status}`);
  return r.status;
}

let flushing = null;
function flushOutbox(force = false) {
  if (!flushing) flushing = doFlush(force).finally(() => { flushing = null; });
  return flushing;
}

async function doFlush(force) {
  const out = { sent: 0, failed: 0 };
  const settings = await getSettings();
  if (!settings.webhookEnabled || !settings.webhookUrl) return out;
  const lookups = await store.kvGet('lookups');
  const due = (await store.getAll('outbox'))
    .filter((o) => force || o.next_at <= Date.now())
    .sort((a, b) => a.created_at - b.created_at); // oldest first
  for (const o of due) {
    const rec = await store.get('notifications', o.id);
    if (!rec) { await store.del('outbox', o.id); continue; }
    try {
      await postWebhook(settings, webhookPayload(rec, lookups, settings.webhookFormat), rec.id);
      await store.del('outbox', o.id);
      out.sent++;
      await setState({ lastWebhookOk: Date.now() });
    } catch (e) {
      out.failed++;
      const attempts = o.attempts + 1;
      const backoffMin = Math.min(60, 2 ** attempts); // 2, 4, 8 ... up to 60 minutes
      await store.put('outbox', { ...o, attempts, last_error: String(e.message || e), next_at: Date.now() + backoffMin * 60000 });
      await setState({ lastWebhookError: String(e.message || e), lastWebhookErrorAt: Date.now() });
    }
  }
  return out;
}

async function testWebhook() {
  const settings = await getSettings();
  if (!settings.webhookUrl) throw new Error('No webhook URL saved');
  const lookups = await store.kvGet('lookups');
  const all = await store.getAll('notifications');
  const latest = all.sort((a, b) => b.created_at - a.created_at)[0] || {
    id: 'test', created_at: Math.floor(Date.now() / 1000), title: 'Test alert', message: 'This is a test from GridPane Alerts Archive.',
    severity: 'info', icon: '', server_id: null, site_id: null, team_id: null, creator_name: '', creator_email: '', read: false, action_url: '',
  };
  const payload = webhookPayload(latest, lookups, settings.webhookFormat);
  if (payload.event) payload.test = true;
  return postWebhook(settings, payload, 'test');
}

// ---------- Badge, alarms, wiring ----------

async function updateBadge() {
  const s = await getState();
  if (s.status === 'signed_out' || s.status === 'error' || s.status === 'rate_limited') {
    await chrome.action.setBadgeBackgroundColor({ color: '#d97706' });
    await chrome.action.setBadgeText({ text: s.status === 'rate_limited' ? '⏸' : '!' });
    await chrome.action.setTitle({ title: `GridPane Alerts — ${s.lastError || 'sync problem'}` });
    return;
  }
  await chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
  await chrome.action.setBadgeText({ text: s.unseen ? String(Math.min(s.unseen, 999)) : '' });
  await chrome.action.setTitle({ title: 'GridPane Alerts' });
}

async function scheduleAlarm() {
  const { pollMinutes } = await getSettings();
  await chrome.alarms.clear(ALARM);
  await chrome.alarms.create(ALARM, { periodInMinutes: Math.max(2, Number(pollMinutes) || 5), delayInMinutes: 0.1 });
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  await scheduleAlarm();
  if (reason === 'install') chrome.tabs.create({ url: chrome.runtime.getURL('app.html') });
});
chrome.runtime.onStartup.addListener(scheduleAlarm);
chrome.alarms.onAlarm.addListener((a) => { if (a.name === ALARM) sync('auto'); });
chrome.action.onClicked.addListener(() => chrome.tabs.create({ url: chrome.runtime.getURL('app.html') }));

const handlers = {
  sync: () => sync('manual'),
  importHistory: () => startRun('history', async (r) => { r.trigger = 'manual'; return importHistory(r); }),
  resetHistory: async () => { await setState({ historyNextPage: 1, historyDone: false }); return { ok: true }; },
  settingsChanged: async () => { await scheduleAlarm(); await flushOutbox(); return { ok: true }; },
  testWebhook: async () => ({ ok: true, status: await testWebhook() }),
  flushOutbox: async () => ({ ok: true, ...(await flushOutbox(true)) }),
  gapAudit: () => gapAudit(),
  refreshLookups: async () => { await refreshLookups(true); return { ok: true }; },
  seen: async () => { await setState({ unseen: 0 }); await updateBadge(); return { ok: true }; },
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const h = handlers[msg?.type];
  if (!h) return false;
  Promise.resolve(h(msg)).then(sendResponse, (e) => sendResponse({ ok: false, error: String(e.message || e) }));
  return true;
});
