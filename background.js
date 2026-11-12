import * as store from './db.js';
import { normalize, webhookPayload } from './normalize.js';
import { buildDemo } from './demo.js';
import { pageOldest, shouldStop, nextCursor, missingIds, newestOf, backfillStart, batchDone, overlapSeconds } from './lib/scan.js';
import { pickGridPaneTab, shouldRetryOnTabLoad, isGridPaneUrl } from './lib/tabs.js';

const BASE = 'https://my.gridpane.com';
const GRIDPANE_ROOT = BASE + '/';
const ALARM = 'gp-sync';
const LOOKUP_TTL = 24 * 3600 * 1000;   // server/site names: once a day
const UNKNOWN_LOOKUP_MIN_GAP = 3600 * 1000; // ...or sooner (max hourly) when an alert mentions an unknown one
const PAGE_DELAY = 1500;                // pause between paged requests
const MAX_WALK_PAGES = 50;              // safety cap for the new-alert walk
const AUTO_BACKFILL_PAGES = 20;         // older pages an automatic run consumes
const MANUAL_BACKFILL_PAGES = 100;      // older pages a watched manual run consumes
// GridPane can insert a notification with a timestamp older than the newest one
// already stored (provisioning notices arrive in a batch). Keep scanning the
// configured overlap below the cursor so those alerts are stored instead of
// skipped forever. The setting is in hours; `overlapSeconds` keeps the old
// two-hour default and bounds the range.
const RATE_LIMIT_STEPS = [5, 15, 30, 60]; // minutes to pause after consecutive 429s
const DEFAULTS = {
  pollMinutes: 5,
  overlapHours: 2, // 0.5–24 hours, see overlapSeconds()
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

// Sample data sets `demoMode` so no GridPane read can replace it. The record
// also carries the settings snapshot restored when the sample is removed.
async function demoState() {
  const { demoMode } = await chrome.storage.local.get('demoMode');
  return demoMode?.active ? demoMode : null;
}

// ---------- GridPane fetching ----------

class SignedOutError extends Error {}
class NoTabError extends Error {}
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

// Chrome withholds GridPane's session cookie from the extension's own fetch, so a
// GridPane read has to run inside an open panel tab. Find that tab up front and
// report a missing one as its own state; "Not signed in" sends the user to the
// login page when the real fix is to open the panel.
async function gridPaneTab() {
  const tabs = await chrome.tabs.query({ url: BASE + '/*' });
  return pickGridPaneTab(tabs);
}

async function requireGridPaneTab() {
  const tab = await gridPaneTab();
  if (!tab) throw new NoTabError(`Open ${GRIDPANE_ROOT} in a tab to let the extension read GridPane alerts`);
  return tab;
}

// Fallback: run the request inside an open GridPane tab, exactly as the panel does.
async function fetchViaTab(path) {
  const tab = await gridPaneTab();
  if (!tab) throw new NoTabError(`Open ${GRIDPANE_ROOT} in a tab to let the extension read GridPane alerts`);
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
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

// Backfill progress lives in state.backfill. Older installs only had the manual
// history import, so their next page is carried over instead of restarting.
function backfillState(state) {
  if (state.backfill) return state.backfill;
  if (state.historyDone) return { nextPage: 1, done: true };
  return { nextPage: state.historyNextPage || 1, done: false };
}

let running = null;
const GRIDPANE_READ_KINDS = new Set(['sync', 'history']);
function startRun(kind, fn, trigger = 'auto') {
  if (running) return { ok: false, status: 'busy', error: 'A run is already in progress' };
  running = (async () => {
    // Sample data is a stable, fictional archive: a GridPane read would replace
    // or empty it, so refuse before the tab preflight or any counter exists.
    if (GRIDPANE_READ_KINDS.has(kind) && await demoState()) {
      return { ok: false, status: 'demo', error: 'Sample data is loaded' };
    }
    const before = await getState();
    run = { kind, trigger, started: Date.now(), requests: 0, rateLimited: 0, pages: 0, newCount: 0, notes: [], freshRecs: [], floor: 0, capped: false, pageDetail: [], cursorFrom: before.cursor || null };
    let result;
    try {
      // Refuse before the first request: without a panel tab every read would
      // fail deep inside the walk and be reported as a sign-out.
      if (GRIDPANE_READ_KINDS.has(kind)) await requireGridPaneTab();
      await setState({ syncing: true, syncMode: kind, syncPage: 0 });
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
      backfillFrom: run.backfillFrom ?? null, backfillTo: run.backfillTo ?? null, backfillDone: run.backfillDone ?? null,
    };
    // An automatic alarm in the no-tab state would add 288 rows a day at the
    // 5-minute default and push real runs out of the 1,000-entry log. A manual
    // attempt still records one row, so the click is auditable.
    const quiet = result.status === 'no_tab' && run.trigger !== 'manual';
    if (!quiet) {
      await store.addLog(entry);
      try {
        const debug = (await store.kvGet('syncDebug')) || [];
        debug.push({
          started: entry.started, kind, trigger: entry.trigger, status: entry.status,
          cursorFrom: entry.cursorFrom, cursorTo: entry.cursorTo, floor: entry.floor, capped: entry.capped,
          backfillFrom: entry.backfillFrom, backfillTo: entry.backfillTo, backfillDone: entry.backfillDone,
          pages: run.pageDetail,
        });
        await store.kvSet('syncDebug', debug.slice(-20));
      } catch {}
    }
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
  if (e instanceof NoTabError) {
    await setState({ status: 'no_tab', lastError: msg });
    return { ok: false, status: 'no_tab', error: msg };
  }
  await setState({ status: 'error', lastError: msg });
  return { ok: false, status: 'error', error: msg };
}

// Regular sync: walk back from the newest alert through the overlap window below
// the cursor, then continue into the backfill so older alerts arrive on their own.
// Alerts are stored by id, so re-reading a page is harmless; what matters is that
// an alert inserted below the cursor is still seen and that the bell is emptied
// in throttled, resumable batches.
async function syncNew(r, { batch }) {
  const settings = await getSettings();
  const state = await getState();
  const backfill = backfillState(state);
  let cursor = state.cursor || null;

  // First run (or upgrade): if alerts are already stored, start from the newest one.
  if (!cursor) {
    const all = await store.getAll('notifications');
    const top = all.sort((a, b) => b.created_at - a.created_at)[0];
    if (top) cursor = { id: top.id, created_at: top.created_at };
  }
  const firstRun = !cursor;
  r.countAsUnseen = !firstRun;
  const sendNew = settings.webhookEnabled && settings.webhookUrl && (!firstRun || settings.webhookIncludeBackfill);
  // Backfilled alerts keep the existing opt-in: a catch-up run must not replay
  // old alerts unless the user asked for it.
  const sendBackfill = settings.webhookEnabled && settings.webhookUrl && settings.webhookIncludeBackfill;

  const overlap = overlapSeconds(settings.overlapHours);
  const floor = cursor ? cursor.created_at - overlap : 0;
  r.floor = floor;

  let newest = null;
  let reached = firstRun;
  let lastWalkedPage = 0;
  for (let page = 1; page <= MAX_WALK_PAGES; page++) {
    const j = await gpGet(`/notifications/recent?page=${page}`);
    r.pages = page;
    lastWalkedPage = page;
    await setState({ syncPage: page });
    const items = j.notifications || [];
    if (!items.length) { reached = true; break; }
    if (!newest) newest = newestOf(items);

    const fresh = await storeNew(items.map(normalize), { sendToWebhook: sendNew });
    r.newCount += fresh.length;
    r.freshRecs.push(...fresh);
    r.pageDetail.push({
      page, count: items.length, first: String(items[0].id), last: String(items[items.length - 1].id),
      oldest: pageOldest(items), more: !!j.willLoadMoreNoti,
    });

    if (firstRun) { reached = true; break; } // page 1 is the whole new-alert walk
    if (shouldStop({ more: j.willLoadMoreNoti, oldest: pageOldest(items), floor })) { reached = true; break; }
    await sleep(PAGE_DELAY);
  }
  r.capped = !reached;
  if (r.capped) r.notes.push(`stopped at the ${MAX_WALK_PAGES}-page limit before reaching the ${overlap / 3600}-hour overlap; the backfill continues below it`);
  if (firstRun) r.notes.push('first run: started tracking from the newest alerts');

  // Backfill: resume below the page the new-alert walk just read. A finished
  // backfill stays finished unless this walk was capped, in which case the pages
  // below the cap still need reading.
  let startPage = backfillStart({ nextPage: backfill.nextPage, lastWalkedPage });
  if (backfill.done && !r.capped) startPage = null;

  let pagesFrom = null;
  let pagesTo = null;
  let done = backfill.done;
  let pausedAt = null;
  if (startPage) {
    let page = startPage;
    for (;;) {
      const j = await gpGet(`/notifications/recent?page=${page}`);
      r.pages = Math.max(r.pages, page);
      await setState({ syncPage: page });
      const items = j.notifications || [];
      const fresh = await storeNew(items.map(normalize), { sendToWebhook: sendBackfill });
      r.newCount += fresh.length;
      r.freshRecs.push(...fresh);
      r.pageDetail.push({
        page, backfill: true, count: items.length,
        first: items.length ? String(items[0].id) : null, last: items.length ? String(items[items.length - 1].id) : null,
        oldest: pageOldest(items), more: !!j.willLoadMoreNoti,
      });
      if (pagesFrom == null) pagesFrom = page;
      pagesTo = page;
      const more = !!j.willLoadMoreNoti && items.length > 0;
      done = !more;
      if (batchDone({ page, startPage, batch, more })) {
        pausedAt = more ? page + 1 : null;
        break;
      }
      page++;
      await sleep(PAGE_DELAY);
    }
    r.notes.push(`backfill: pages ${pagesFrom}–${pagesTo}`);
    if (done) r.notes.push('backfill complete (reached the oldest alert)');
    else if (pausedAt) r.notes.push(`backfill paused at page ${pausedAt} (batch)`);
  }

  const nextBackfill = startPage
    ? { nextPage: pausedAt || 1, done, updatedAt: Date.now() }
    : { ...backfill, updatedAt: Date.now() };
  r.backfillFrom = pagesFrom;
  r.backfillTo = pagesTo;
  r.backfillDone = done;

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

  // The cursor only moves once the walk reached the overlap floor (or the end of
  // history), and never goes backwards. The gap flag now tracks the backfill: it
  // clears when GridPane has no more pages below, not when an audit happened to
  // see something.
  const next = nextCursor({ reached, newest, current: cursor });
  return { cursor: next, syncGap: !nextBackfill.done, backfill: nextBackfill };
}

async function sync(trigger = 'auto') {
  const state = await getState();
  if (trigger === 'auto' && state.backoffUntil && state.backoffUntil > Date.now()) return { ok: false, status: 'waiting' };
  // A manual run is watched by the user, so it takes the larger batch; automatic
  // runs stay page-paced and rate-limit aware.
  const batch = trigger === 'manual' ? MANUAL_BACKFILL_PAGES : AUTO_BACKFILL_PAGES;
  return startRun('sync', async (r) => { r.trigger = trigger; return syncNew(r, { batch }); }, trigger);
}

// Read-only: compare the whole bell GridPane still serves with what is stored.
async function gapAudit() {
  const remote = [];
  let pages = 0;
  let done = false;
  for (let page = 1; page <= MAX_WALK_PAGES; page++) {
    const j = await gpGet(`/notifications/recent?page=${page}`);
    const items = j.notifications || [];
    remote.push(...items);
    pages = page;
    if (!items.length || !j.willLoadMoreNoti) { done = true; break; }
    await sleep(PAGE_DELAY);
  }
  const local = await store.getAll('notifications');
  const missing = sortNewestFirst(missingIds(remote, new Set(local.map((r) => r.id))));
  const brief = (n) => (n ? { id: String(n.id), created_at: Number(n.created_at) || 0, title: n.title || '' } : null);
  return {
    ok: true,
    checked: remote.length,
    pages,
    done,
    missingCount: missing.length,
    newest: brief(missing[0]),
    oldest: brief(missing[missing.length - 1]),
    missing: missing.slice(0, 50).map(brief),
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
  if (s.status === 'signed_out' || s.status === 'no_tab' || s.status === 'error' || s.status === 'rate_limited') {
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

// A tab opened after a no-tab check is the user doing what the banner asked.
// Retry once it finishes loading, with a short cooldown so several tabs (or a
// reload) cannot start a run each. Other states, and a 429 pause, are left to
// the user or the normal alarm.
let lastTabRetry = 0;
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  (async () => {
    try {
      const url = tab?.url || changeInfo.url;
      // Cheap filter first: unrelated tab loads must not read extension state.
      if (changeInfo.status !== 'complete' || !isGridPaneUrl(url)) return;
      const state = await getState();
      const now = Date.now();
      if (!shouldRetryOnTabLoad({
        status: state.status,
        complete: true,
        url,
        now,
        lastRetryAt: lastTabRetry,
      })) return;
      lastTabRetry = now;
      await sync('auto');
    } catch {}
  })();
});

// One click from the archive page: focus the panel tab already open, or open it.
async function openGridPane() {
  const tab = await gridPaneTab();
  if (tab) {
    await chrome.tabs.update(tab.id, { active: true });
    if (tab.windowId != null) await chrome.windows.update(tab.windowId, { focused: true });
    return { ok: true, opened: 'focused' };
  }
  await chrome.tabs.create({ url: GRIDPANE_ROOT });
  return { ok: true, opened: 'created' };
}

// The manual actions below bypass startRun, so they run the same preflight and
// answer in the shape the archive page already understands.
async function requireTabOrReply(idle) {
  try { await requireGridPaneTab(); }
  catch (e) { return { ok: false, status: 'no_tab', error: String(e.message || e) }; }
  return idle();
}

// ---------- Sample data ----------
// `buildDemo` returns every shape the sync writes, so loading is a clear and
// copy; removing restores the webhook settings captured at load time.
async function loadDemo() {
  if (running) return { ok: false, status: 'busy', error: 'A run is already in progress' };
  // A second tab can still show the Load button after the first load. Keep the
  // settings snapshot from the first load instead of snapshotting demo values.
  const prior = await demoState();
  const previousSettings = prior?.previousSettings || await getSettings();
  const demo = buildDemo(Date.now());
  await store.clear('notifications');
  await store.clear('outbox');
  await store.clear('synclog');
  await store.del('kv', 'lookups');
  await store.del('kv', 'syncDebug');
  await store.putMany('notifications', demo.notifications);
  await store.putMany('synclog', demo.synclog);
  await store.kvSet('lookups', demo.lookups);
  await chrome.storage.local.set({
    settings: demo.settings,
    demoMode: { active: true, seededAt: Date.now(), alerts: demo.notifications.length, previousSettings },
    state: demo.state,
  });
  await chrome.alarms.clear(ALARM);
  await updateBadge();
  return { ok: true, count: demo.notifications.length };
}

async function exitDemo() {
  const demo = await demoState();
  if (!demo) return { ok: true, removed: false };
  if (running) return { ok: false, status: 'busy', error: 'A run is already in progress' };
  await store.clear('notifications');
  await store.clear('outbox');
  await store.clear('synclog');
  await store.del('kv', 'lookups');
  await store.del('kv', 'syncDebug');
  await chrome.storage.local.set({ settings: { ...DEFAULTS, ...(demo.previousSettings || {}) } });
  await setState({
    status: 'ok', lastError: null, lastSync: null, lastAttempt: null,
    cursor: null, backfill: { nextPage: 1, done: false }, unseen: 0,
    syncGap: false, syncing: false, syncMode: null, syncPage: 0,
    rateLimitStreak: 0, backoffUntil: 0,
  });
  await chrome.storage.local.remove('demoMode');
  await scheduleAlarm();
  await updateBadge();
  return { ok: true, removed: true };
}

const handlers = {
  sync: () => sync('manual'),
  importHistory: () => startRun('history', async (r) => { r.trigger = 'manual'; return syncNew(r, { batch: MANUAL_BACKFILL_PAGES }); }, 'manual'),
  resetHistory: async () => { await setState({ backfill: { nextPage: 1, done: false } }); return { ok: true }; },
  settingsChanged: async () => { await scheduleAlarm(); await flushOutbox(); return { ok: true }; },
  testWebhook: async () => ({ ok: true, status: await testWebhook() }),
  flushOutbox: async () => ({ ok: true, ...(await flushOutbox(true)) }),
  gapAudit: () => requireTabOrReply(() => gapAudit()),
  refreshLookups: () => requireTabOrReply(async () => { await refreshLookups(true); return { ok: true }; }),
  openGridPane: () => openGridPane(),
  loadDemo: () => loadDemo(),
  exitDemo: () => exitDemo(),
  seen: async () => {
    if (await demoState()) return { ok: true, demo: true };
    await setState({ unseen: 0 }); await updateBadge(); return { ok: true };
  },
};

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const h = handlers[msg?.type];
  if (!h) return false;
  Promise.resolve(h(msg)).then(sendResponse, (e) => sendResponse({ ok: false, error: String(e.message || e) }));
  return true;
});
