import * as store from './db.js';
import { resolve, webhookPayload } from './normalize.js';

const $ = (id) => document.getElementById(id);
const el = (tag, props = {}, ...kids) => {
  const n = Object.assign(document.createElement(tag), props);
  for (const k of kids) if (k != null) n.append(k);
  return n;
};
const send = (msg) => chrome.runtime.sendMessage(msg);

// ---------- Columns ----------
const fmtDate = (unix) => {
  if (!unix) return '';
  const d = new Date(unix * 1000);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const COLUMNS = [
  { key: 'date', label: 'Date', groupLabel: 'Last seen', sort: (r) => r.created_at, text: (r) => fmtDate(r.created_at), on: true },
  { key: 'count', label: 'Count', groupOnly: true, sort: (r) => r._group?.count ?? 1, text: (r) => String(r._group?.count ?? 1) },
  { key: 'first', label: 'First seen', groupOnly: true, sort: (r) => r._group?.first ?? r.created_at, text: (r) => fmtDate(r._group?.first ?? r.created_at) },
  { key: 'severity', label: 'Severity', sort: (r) => ({ error: 0, warning: 1, info: 2 })[r.severity], text: (r) => r.severity, on: true },
  { key: 'title', label: 'Alert', sort: (r) => r.title.toLowerCase(), text: (r) => r.title, on: true, hl: true },
  { key: 'message', label: 'Message', sort: (r) => r.message.toLowerCase(), text: (r) => r.message, on: true, hl: true },
  { key: 'server', label: 'Server', sort: (r) => r._server.toLowerCase(), text: (r) => r._server, on: true, hl: true },
  { key: 'ip', label: 'Server IP', sort: (r) => r._ip, text: (r) => r._ip, on: false, hl: true },
  { key: 'site', label: 'Site', sort: (r) => r._site.toLowerCase(), text: (r) => r._site, on: true, hl: true },
  { key: 'creator', label: 'Created by', sort: (r) => r.creator_name.toLowerCase(), text: (r) => r.creator_name, on: true },
  { key: 'read', label: 'Read in GridPane', sort: (r) => (r.read ? 1 : 0), text: (r) => (r.read ? 'Yes' : 'No'), on: false },
  { key: 'id', label: 'ID', sort: (r) => r._group?.items[0].id ?? r.id, text: (r) => r._group?.items[0].id ?? r.id, on: false },
];

const ui = {
  all: [], rows: [], lookups: null,
  sort: { key: 'date', dir: -1 },
  page: 0, pageSize: 100,
  open: new Set(),
  cols: loadCols(),
  terms: [],
  filtered: [],
  group: pref('group') === '1',
  groupMode: pref('groupMode') || 'type',
};

function pref(k) { try { return localStorage.getItem(k); } catch { return null; } }
function setPref(k, v) { try { localStorage.setItem(k, v); } catch {} }

function loadCols() {
  try {
    const saved = JSON.parse(localStorage.getItem('cols') || 'null');
    if (Array.isArray(saved)) return new Set(saved);
  } catch {}
  return new Set(COLUMNS.filter((c) => c.on).map((c) => c.key));
}
function saveCols() { try { localStorage.setItem('cols', JSON.stringify([...ui.cols])); } catch {} }

// ---------- Loading ----------
function guessDomain(text) {
  const m = (text || '').match(/\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,24}\b/i);
  return m ? m[0].toLowerCase() : null;
}

async function load() {
  const [recs, lookups] = await Promise.all([store.getAll('notifications'), store.kvGet('lookups')]);
  ui.lookups = lookups || { servers: {}, sites: {} };
  // Sites not in the name list yet (e.g. just created): take the domain from any alert
  // for that site whose message mentions one, oldest first (the build/SSL notices).
  const guessed = {};
  for (const r of recs.slice().sort((a, b) => a.created_at - b.created_at)) {
    if (r.site_id && !guessed[r.site_id] && !ui.lookups.sites?.[r.site_id]) {
      const d = guessDomain(r.message);
      if (d) guessed[r.site_id] = d;
    }
  }
  ui.all = recs.map((r) => {
    const x = resolve(r, ui.lookups);
    const server = x.server_label || (r.server_id ? `#${r.server_id}` : '');
    const site = x.site_url || (r.site_id ? (guessed[r.site_id] || `#${r.site_id}`) : '');
    const ip = x.server_ip || '';
    return {
      ...r, _server: server, _site: site, _ip: ip,
      _hay: [r.title, r.message, server, ip, site, r.creator_name, r.creator_email, r.severity, r.id].join('\n').toLowerCase(),
    };
  });
  fillSelects();
  apply();
}

function fillSelect(sel, entries, allLabel) {
  const cur = sel.value;
  sel.replaceChildren(el('option', { value: '', textContent: allLabel }));
  for (const [value, label] of entries) sel.append(el('option', { value, textContent: label }));
  if ([...sel.options].some((o) => o.value === cur)) sel.value = cur;
}

function fillSelects() {
  const counts = (fn) => {
    const m = new Map();
    for (const r of ui.all) { const k = fn(r); if (k) m.set(k, (m.get(k) || 0) + 1); }
    return m;
  };
  const titles = [...counts((r) => r.title)].sort((a, b) => a[0].localeCompare(b[0]));
  fillSelect($('fTitle'), titles.map(([t, n]) => [t, `${t} (${n})`]), 'All alert types');

  const servers = new Map();
  for (const r of ui.all) if (r.server_id) servers.set(String(r.server_id), r._server);
  fillSelect($('fServer'), [...servers].sort((a, b) => a[1].localeCompare(b[1])), 'All servers');

  const sites = new Map();
  for (const r of ui.all) if (r.site_id) sites.set(String(r.site_id), r._site);
  fillSelect($('fSite'), [...sites].sort((a, b) => a[1].localeCompare(b[1])), 'All sites');
}

// ---------- Search & filters ----------
const FIELDS = {
  title: (r) => r.title, alert: (r) => r.title, msg: (r) => r.message, message: (r) => r.message,
  server: (r) => `${r._server} ${r._ip}`, ip: (r) => r._ip, site: (r) => r._site,
  by: (r) => `${r.creator_name} ${r.creator_email}`, severity: (r) => r.severity, sev: (r) => r.severity, id: (r) => r.id,
};

function parseQuery(q) {
  const out = [];
  const re = /(-?)(?:(\w+):)?(?:"([^"]*)"|(\S+))/g;
  let m;
  while ((m = re.exec(q))) {
    const field = m[2] && FIELDS[m[2].toLowerCase()] ? m[2].toLowerCase() : null;
    let v = (m[3] ?? m[4] ?? '').toLowerCase();
    if (m[2] && !field) v = `${m[2].toLowerCase()}:${v}`; // unknown prefix: treat literally
    if (v) out.push({ neg: m[1] === '-', field, v });
  }
  return out;
}

function apply() {
  const q = parseQuery($('q').value.trim());
  ui.terms = q.filter((t) => !t.neg).map((t) => t.v);
  const sev = $('fSeverity').value, title = $('fTitle').value, server = $('fServer').value, site = $('fSite').value;
  const from = $('fFrom').value ? new Date($('fFrom').value + 'T00:00:00').getTime() / 1000 : null;
  const to = $('fTo').value ? new Date($('fTo').value + 'T23:59:59').getTime() / 1000 : null;

  ui.filtered = ui.all.filter((r) => {
    if (sev && r.severity !== sev) return false;
    if (title && r.title !== title) return false;
    if (server && String(r.server_id) !== server) return false;
    if (site && String(r.site_id) !== site) return false;
    if (from && r.created_at < from) return false;
    if (to && r.created_at > to) return false;
    for (const t of q) {
      const hay = t.field ? FIELDS[t.field](r).toLowerCase() : r._hay;
      if (hay.includes(t.v) === t.neg) return false;
    }
    return true;
  });

  ui.rows = ui.group ? groupRows(ui.filtered) : ui.filtered.slice();

  let col = COLUMNS.find((c) => c.key === ui.sort.key) || COLUMNS[0];
  if (col.groupOnly && !ui.group) col = COLUMNS[0];
  const d = ui.sort.dir;
  ui.rows.sort((a, b) => {
    const x = col.sort(a), y = col.sort(b);
    return (x < y ? -1 : x > y ? 1 : 0) * d || (b.created_at - a.created_at);
  });
  ui.page = 0;
  render();
}

// ---------- Grouping ----------
const SEV_RANK = { error: 0, warning: 1, info: 2 };

// "type": same alert title on the same server and site.
// "message": additionally requires the exact same message text.
function groupKey(r) {
  const parts = [r.title, r.server_id ?? '', r.site_id ?? ''];
  if (ui.groupMode === 'message') parts.push(r.message);
  return parts.join('\u0001');
}

function groupRows(list) {
  const groups = new Map();
  for (const r of list) {
    const k = groupKey(r);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  return [...groups].map(([k, items]) => {
    items.sort((a, b) => b.created_at - a.created_at);
    const latest = items[0];
    const worst = items.reduce((s, x) => (SEV_RANK[x.severity] < SEV_RANK[s] ? x.severity : s), latest.severity);
    return {
      ...latest, id: 'g:' + k, severity: worst,
      _group: { count: items.length, first: items.at(-1).created_at, last: latest.created_at, items },
    };
  });
}

// ---------- Rendering ----------
function highlight(text) {
  const frag = document.createDocumentFragment();
  const terms = ui.terms.filter((t) => t.length > 1);
  if (!text || !terms.length) { frag.append(text || ''); return frag; }
  const re = new RegExp('(' + terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
  let last = 0;
  for (const m of text.matchAll(re)) {
    frag.append(text.slice(last, m.index), el('mark', { textContent: m[0] }));
    last = m.index + m[0].length;
  }
  frag.append(text.slice(last));
  return frag;
}

function visibleCols() { return COLUMNS.filter((c) => (c.groupOnly ? ui.group : ui.cols.has(c.key))); }

function renderHead() {
  $('head').replaceChildren(...visibleCols().map((c) => {
    const th = el('th', { textContent: ui.group && c.groupLabel ? c.groupLabel : c.label });
    if (ui.sort.key === c.key) th.append(el('span', { className: 'arrow', textContent: ui.sort.dir < 0 ? '▼' : '▲' }));
    th.onclick = () => {
      ui.sort = { key: c.key, dir: ui.sort.key === c.key ? -ui.sort.dir : (c.key === 'date' ? -1 : 1) };
      apply();
    };
    return th;
  }));
}

function cell(c, r) {
  const td = el('td', { className: `c-${c.key}` });
  if (c.key === 'severity') td.append(el('span', { className: `sev ${r.severity}`, textContent: r.severity }));
  else if (c.key === 'message') td.append(el('div', { className: 'msg' }, highlight(r.message)));
  else if (c.key === 'date') { td.textContent = fmtDate(r.created_at); td.title = r.date_text || ''; }
  else if (c.key === 'count') {
    const n = r._group?.count ?? 1;
    td.append(el('span', { className: 'count' + (n > 1 ? ' multi' : ''), textContent: n > 1 ? `×${n}` : '1' }));
  }
  else if (c.key === 'first') { td.textContent = (r._group?.count ?? 1) > 1 ? c.text(r) : ''; td.classList.add('c-date'); }
  else if (c.hl) td.append(highlight(c.text(r)));
  else td.textContent = c.text(r);
  return td;
}

function detailRow(r, span) {
  const kv = el('dl', { className: 'kv' });
  const add = (k, v) => { if (v !== '' && v != null) kv.append(el('dt', { textContent: k }), el('dd', { textContent: String(v) })); };
  add('When', `${fmtDate(r.created_at)}  (GridPane: ${r.date_text})`);
  add('Server', r._server + (r._ip ? `  ${r._ip}` : '') + (r.server_id ? `  · id ${r.server_id}` : ''));
  add('Site', r.site_id ? `${r._site}  · id ${r.site_id}` : '');
  add('Created by', [r.creator_name, r.creator_email].filter(Boolean).join(' · '));
  add('Read in GridPane', r.read ? 'Yes' : 'No');
  add('First stored', r.first_seen_at ? new Date(r.first_seen_at).toLocaleString() : '');
  add('ID', r.id);

  const links = el('div', { className: 'links' });
  if (r.action_url) links.append(el('a', { className: 'btn ghost small', href: r.action_url, target: '_blank', textContent: r.action_text || 'Open' }));
  if (r.server_id) links.append(el('a', { className: 'btn ghost small', href: `https://my.gridpane.com/servers`, target: '_blank', textContent: 'Open GridPane' }));
  const copy = el('button', { className: 'btn ghost small', textContent: 'Copy JSON' });
  copy.onclick = (e) => { e.stopPropagation(); navigator.clipboard.writeText(JSON.stringify(r.raw, null, 2)); copy.textContent = 'Copied'; };
  links.append(copy);

  const left = el('div', {}, el('p', { className: 'detail-msg' }, highlight(r.message)), kv, links);
  const right = el('div', {}, el('pre', { textContent: JSON.stringify(r.raw, null, 2) }));
  const td = el('td', { colSpan: span }, el('div', { className: 'detail-grid' }, left, right));
  return el('tr', { className: 'detail' }, td);
}

// Detail for a group of 2+ occurrences: summary plus every occurrence.
function groupDetailRow(g, span) {
  const { items, count, first, last } = g._group;
  const kv = el('dl', { className: 'kv' });
  const add = (k, v) => { if (v) kv.append(el('dt', { textContent: k }), el('dd', { textContent: String(v) })); };
  add('Occurrences', count);
  add('First seen', fmtDate(first));
  add('Last seen', fmtDate(last));
  add('Server', g._server + (g._ip ? `  ${g._ip}` : ''));
  add('Site', g.site_id ? g._site : '');

  const copy = el('button', { className: 'btn ghost small', textContent: `Copy JSON (${count})` });
  copy.onclick = (e) => { e.stopPropagation(); navigator.clipboard.writeText(JSON.stringify(items.map((i) => i.raw), null, 2)); copy.textContent = 'Copied'; };

  const sameMsg = items.every((i) => i.message === items[0].message);
  const list = el('table', { className: 'occ' },
    el('thead', {}, el('tr', {}, el('th', { textContent: 'When' }), el('th', { textContent: 'Severity' }), el('th', { textContent: sameMsg ? 'ID' : 'Message' }))),
    el('tbody', {}, ...items.slice(0, 300).map((i) => el('tr', {},
      el('td', { className: 'c-date', textContent: fmtDate(i.created_at) }),
      el('td', {}, el('span', { className: `sev ${i.severity}`, textContent: i.severity })),
      sameMsg ? el('td', { className: 'c-id', textContent: i.id }) : el('td', { className: 'occ-msg' }, highlight(i.message)),
    ))));
  const more = items.length > 300 ? el('p', { className: 'muted', textContent: `…and ${items.length - 300} more` }) : null;

  const left = el('div', {},
    sameMsg ? el('p', { className: 'detail-msg' }, highlight(items[0].message)) : null,
    kv, el('div', { className: 'links' }, copy));
  const right = el('div', { className: 'occ-wrap' }, list, more);
  return el('tr', { className: 'detail' }, el('td', { colSpan: span }, el('div', { className: 'detail-grid' }, left, right)));
}

function render() {
  renderHead();
  const cols = visibleCols();
  const start = ui.page * ui.pageSize;
  const slice = ui.rows.slice(start, start + ui.pageSize);
  const frag = document.createDocumentFragment();
  for (const r of slice) {
    const tr = el('tr', { className: 'row' + (ui.open.has(r.id) ? ' open' : '') });
    for (const c of cols) tr.append(cell(c, r));
    tr.onclick = () => { ui.open.has(r.id) ? ui.open.delete(r.id) : ui.open.add(r.id); render(); };
    frag.append(tr);
    if (ui.open.has(r.id)) {
      const multi = r._group && r._group.count > 1;
      frag.append(multi ? groupDetailRow(r, cols.length) : detailRow(r._group ? r._group.items[0] : r, cols.length));
    }
  }
  $('body').replaceChildren(frag);

  const total = ui.all.length, shown = ui.rows.length, matched = ui.filtered.length;
  const of = matched === total ? `${total.toLocaleString()} alerts` : `${matched.toLocaleString()} of ${total.toLocaleString()} alerts`;
  $('summary').textContent = ui.group ? `${shown.toLocaleString()} groups · ${of}` : of;
  const pages = Math.max(1, Math.ceil(shown / ui.pageSize));
  $('pageInfo').textContent = `Page ${ui.page + 1} of ${pages}`;
  $('prev').disabled = ui.page === 0;
  $('next').disabled = ui.page >= pages - 1;

  const empty = $('empty');
  empty.hidden = shown > 0;
  empty.textContent = total === 0 ? 'No alerts stored yet. New alerts are picked up automatically while you are signed in to GridPane; older ones can be imported from Settings.' : 'No alerts match these filters.';
}

function renderColMenu() {
  $('colMenu').replaceChildren(...COLUMNS.filter((c) => !c.groupOnly).map((c) => {
    const cb = el('input', { type: 'checkbox', checked: ui.cols.has(c.key) });
    cb.onchange = () => { cb.checked ? ui.cols.add(c.key) : ui.cols.delete(c.key); if (!ui.cols.size) ui.cols.add('title'); saveCols(); render(); };
    return el('label', {}, cb, c.label);
  }));
}

// ---------- Export ----------
function download(name, type, content) {
  const a = el('a', { href: URL.createObjectURL(new Blob([content], { type })), download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');

// CSV/JSON of exactly what the table shows: filtered rows, or groups when grouping is on.
const iso = (unix) => new Date(unix * 1000).toISOString();

function buildCsv() {
  const esc = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const cols = COLUMNS.filter((c) => !c.groupOnly);
  const head = ui.group ? ['Count', 'First seen', 'Last seen', ...cols.filter((c) => c.key !== 'date').map((c) => c.label)] : cols.map((c) => c.label);
  const lines = [head.map(esc).join(',')];
  for (const r of ui.rows) {
    const vals = cols.filter((c) => !ui.group || c.key !== 'date').map((c) => (c.key === 'date' ? iso(r.created_at) : c.text(r)));
    if (ui.group) vals.unshift(r._group.count, iso(r._group.first), iso(r._group.last));
    lines.push(vals.map(esc).join(','));
  }
  return lines.join('\r\n');
}

function buildJson() {
  const data = ui.rows.map((r) => {
    if (!ui.group) return webhookPayload(r, ui.lookups).notification;
    const { items, count, first, last } = r._group;
    return {
      count, first_seen: iso(first), last_seen: iso(last),
      ...webhookPayload(items[0], ui.lookups).notification,
      severity: r.severity,
      ids: items.map((i) => i.id),
    };
  });
  return JSON.stringify(data, null, 2);
}

const exportCsv = () => download(`gridpane-alerts-${stamp()}.csv`, 'text/csv', '﻿' + buildCsv());
const exportJson = () => download(`gridpane-alerts-${stamp()}.json`, 'application/json', buildJson());

async function copyOut(btn, build) {
  const label = btn.textContent;
  try {
    await navigator.clipboard.writeText(build());
    btn.textContent = `Copied ${ui.rows.length.toLocaleString()} ${ui.group ? 'groups' : 'rows'}`;
  } catch (e) {
    btn.textContent = 'Copy failed';
  }
  setTimeout(() => { btn.textContent = label; }, 1800);
}

// ---------- Status ----------
function ago(ms) {
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(ms).toLocaleString();
}

async function renderStatus() {
  const { state = {} } = await chrome.storage.local.get('state');
  const st = $('status');
  const banner = $('banner');
  const paused = state.status === 'rate_limited' && state.backoffUntil > Date.now();
  st.classList.toggle('bad', state.status === 'signed_out' || state.status === 'no_tab' || state.status === 'error' || paused);
  if (state.syncing) {
    st.textContent = state.syncMode === 'history' ? `Importing older history… page ${state.syncPage || 0}` : `Checking for new alerts… page ${state.syncPage || 1}`;
  } else if (paused) {
    st.textContent = `Rate limited · paused until ${new Date(state.backoffUntil).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  } else if (state.status === 'signed_out') {
    st.textContent = 'Not signed in';
  } else if (state.status === 'no_tab') {
    st.textContent = 'GridPane tab not open';
  } else if (state.status === 'error') {
    st.textContent = 'Sync error';
  } else if (state.lastSync) {
    st.textContent = `Synced ${ago(state.lastSync)}`;
  } else {
    st.textContent = 'Not synced yet';
  }

  if (state.status === 'no_tab' && !state.syncing) {
    const open = el('button', { className: 'btn ghost small', textContent: 'Open GridPane' });
    open.addEventListener('click', async () => {
      open.disabled = true;
      await send({ type: 'openGridPane' });
      renderStatus();
    });
    banner.replaceChildren('GridPane needs an open my.gridpane.com tab. ', open, ' then press Sync now.');
    banner.hidden = false;
  } else if (state.status === 'signed_out' && !state.syncing) {
    banner.replaceChildren('GridPane says this browser isn’t signed in. ',
      el('a', { href: 'https://my.gridpane.com/login', target: '_blank', textContent: 'Sign in to my.gridpane.com' }),
      ', keep a GridPane tab open, then press Sync now.');
    banner.hidden = false;
  } else if (paused && !state.syncing) {
    banner.textContent = `GridPane is rate-limiting requests (HTTP 429). Automatic checks are paused until ${new Date(state.backoffUntil).toLocaleTimeString()}; nothing is lost, the next check picks up from the last synced alert.`;
    banner.hidden = false;
  } else if (state.status === 'error' && !state.syncing) {
    banner.textContent = `Last sync failed: ${state.lastError}`;
    banner.hidden = false;
  } else if (state.syncGap && !state.syncing) {
    banner.textContent = 'The gap back to the last synced alert is too large for a normal check. New alerts are still collected; run Import older history to fill the rest.';
    banner.hidden = false;
  } else banner.hidden = true;
  $('syncNow').disabled = !!state.syncing;
}

// ---------- Sync log ----------
const RESULT_LABEL = { ok: 'OK', rate_limited: 'Rate limited', signed_out: 'Signed out', no_tab: 'No GridPane tab', error: 'Error' };
const RESULT_CLASS = { ok: 'info', rate_limited: 'warning', signed_out: 'warning', no_tab: 'warning', error: 'error' };
const dur = (ms) => (ms < 1000 ? `${ms} ms` : ms < 60000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.floor(ms / 60000)} m ${Math.round((ms % 60000) / 1000)} s`);
const clock = (unix) => (unix ? new Date(unix * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '–');
const cursorText = (e) => `${clock(e.cursorFrom?.created_at)} → ${clock(e.cursorTo?.created_at)}`;
let logRows = [];

async function renderLog() {
  const all = (await store.getAll('synclog')).sort((a, b) => b.started - a.started);
  const f = $('logFilter').value;
  logRows = all.filter((e) => !f || (f === 'problems' ? e.status !== 'ok' || e.webhookFailed : e.newCount > 0));
  const last24 = all.filter((e) => e.started > Date.now() - 86400000);
  $('logSummary').textContent = `${all.length} runs logged · last 24 h: ${last24.length} runs, ` +
    `${last24.reduce((n, e) => n + e.newCount, 0)} new alerts, ${last24.reduce((n, e) => n + e.requests, 0)} requests, ` +
    `${last24.filter((e) => e.status === 'rate_limited').length} rate-limited`;
  $('logBody').replaceChildren(...logRows.slice(0, 500).map((e) => {
    const res = el('td', {}, el('span', { className: `sev ${RESULT_CLASS[e.status] || 'info'}`, textContent: RESULT_LABEL[e.status] || e.status }));
    if (e.error && e.status !== 'ok') res.title = e.error;
    const wh = e.webhookSent || e.webhookFailed ? `${e.webhookSent} sent${e.webhookFailed ? `, ${e.webhookFailed} failed` : ''}` : '–';
    return el('tr', {},
      el('td', { className: 'c-date', textContent: new Date(e.started).toLocaleString() }),
      el('td', { textContent: `${e.kind === 'history' ? 'History import' : 'Sync'}${e.trigger === 'manual' ? ' (manual)' : ''}` }),
      res,
      el('td', { className: 'c-date', textContent: cursorText(e) }),
      el('td', { textContent: e.pages }),
      el('td', { textContent: e.requests }),
      el('td', { textContent: e.rateLimited || '–' }),
      el('td', { textContent: e.newCount || '–' }),
      el('td', { textContent: wh }),
      el('td', { className: 'c-date', textContent: dur(e.finished - e.started) }),
      el('td', { className: 'c-message', textContent: [e.notes, e.status !== 'ok' ? e.error : ''].filter(Boolean).join(' · ') }),
    );
  }));
  $('logEmpty').hidden = logRows.length > 0;
}

function exportLog() {
  const head = ['started', 'finished', 'kind', 'trigger', 'status', 'pages', 'requests', 'rate_limited', 'new_alerts', 'webhook_sent', 'webhook_failed', 'error', 'notes'];
  const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = [head.join(','), ...logRows.map((e) => [
    new Date(e.started).toISOString(), new Date(e.finished).toISOString(), e.kind, e.trigger, e.status, e.pages, e.requests,
    e.rateLimited, e.newCount, e.webhookSent, e.webhookFailed, e.error, e.notes].map(esc).join(','))];
  download(`gridpane-alerts-synclog-${stamp()}.csv`, 'text/csv', '﻿' + lines.join('\r\n'));
}

// ---------- Settings ----------
async function loadSettings() {
  const { settings = {} } = await chrome.storage.local.get('settings');
  const s = { pollMinutes: 5, webhookEnabled: false, webhookUrl: '', webhookSecret: '', webhookFormat: 'full', webhookIncludeBackfill: false, ...settings };
  $('sPoll').value = s.pollMinutes;
  $('sWhEnabled').checked = s.webhookEnabled;
  $('sWhUrl').value = s.webhookUrl;
  $('sWhSecret').value = s.webhookSecret;
  $('sWhFormat').value = s.webhookFormat;
  $('sWhBackfill').checked = s.webhookIncludeBackfill;
  renderSample();
}

function renderSample() {
  const sample = ui.all.slice().sort((a, b) => b.created_at - a.created_at)[0];
  $('sSample').textContent = sample
    ? JSON.stringify(webhookPayload(sample, ui.lookups, $('sWhFormat').value), null, 2)
    : 'A sample appears here once alerts are stored.';
}

async function renderSettingsInfo() {
  const [n, outbox, lookups] = await Promise.all([store.count('notifications'), store.getAll('outbox'), store.kvGet('lookups')]);
  const ls = lookups || { servers: {}, sites: {} };
  $('sDataInfo').textContent = `${n.toLocaleString()} alerts stored · names known for ${Object.keys(ls.servers).length} servers and ${Object.keys(ls.sites).length} sites` +
    (ls.updated_at ? ` (updated ${ago(ls.updated_at)})` : '');
  const failing = outbox.filter((o) => o.attempts > 0);
  $('sOutbox').textContent = outbox.length
    ? `${outbox.length} alert${outbox.length === 1 ? '' : 's'} waiting to send` + (failing.length ? ` · last error: ${failing.at(-1).last_error}` : '')
    : 'Webhook queue is empty.';
  $('sRetry').hidden = $('sClearOutbox').hidden = !outbox.length;

  const { state = {} } = await chrome.storage.local.get('state');
  const busy = !!state.syncing;
  $('sHistory').disabled = busy;
  $('sHistory').textContent = state.historyNextPage > 1 && !state.historyDone ? `Resume import (page ${state.historyNextPage})` : 'Import older history';
  $('sHistoryInfo').textContent = state.syncing && state.syncMode === 'history' ? `Importing page ${state.syncPage}…`
    : state.historyDone ? 'Full history imported.'
    : state.historyNextPage > 1 ? `Stopped at page ${state.historyNextPage}.` : '';
}

function msg(text, bad = false) { const m = $('sMsg'); m.textContent = text; m.style.color = bad ? 'var(--err)' : ''; }

async function saveSettings() {
  const url = $('sWhUrl').value.trim();
  const enabled = $('sWhEnabled').checked;
  if (url) {
    let u;
    try { u = new URL(url); } catch { return msg('That webhook URL isn’t valid.', true); }
    if (!/^https?:$/.test(u.protocol)) return msg('Webhook URL must start with http:// or https://', true);
    const granted = await chrome.permissions.request({ origins: [`${u.origin}/*`] });
    if (!granted) return msg(`Chrome permission for ${u.host} was declined, so the webhook can’t be called.`, true);
  } else if (enabled) {
    return msg('Add a webhook URL first.', true);
  }
  const settings = {
    pollMinutes: Math.max(1, parseInt($('sPoll').value, 10) || 5),
    webhookEnabled: enabled, webhookUrl: url, webhookSecret: $('sWhSecret').value,
    webhookFormat: $('sWhFormat').value, webhookIncludeBackfill: $('sWhBackfill').checked,
  };
  await chrome.storage.local.set({ settings });
  await send({ type: 'settingsChanged' });
  msg('Saved.');
}

// ---------- Wiring ----------
function showView(name) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === name));
  $('view-alerts').hidden = name !== 'alerts';
  $('view-settings').hidden = name !== 'settings';
  $('view-log').hidden = name !== 'log';
  if (name === 'settings') { renderSettingsInfo(); renderSample(); }
  if (name === 'log') renderLog();
}

let debounce;
$('q').addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(apply, 150); });
for (const id of ['fSeverity', 'fTitle', 'fServer', 'fSite', 'fFrom', 'fTo']) $(id).addEventListener('change', apply);
$('clearFilters').onclick = () => { for (const id of ['q', 'fSeverity', 'fTitle', 'fServer', 'fSite', 'fFrom', 'fTo']) $(id).value = ''; apply(); };
$('prev').onclick = () => { ui.page--; render(); $('grid').scrollIntoView({ block: 'start' }); };
$('next').onclick = () => { ui.page++; render(); $('grid').scrollIntoView({ block: 'start' }); };
$('pageSize').onchange = () => { ui.pageSize = +$('pageSize').value; ui.page = 0; render(); };
$('exportCsv').onclick = exportCsv;
$('exportJson').onclick = exportJson;
$('copyCsv').onclick = () => copyOut($('copyCsv'), buildCsv);
$('copyJson').onclick = () => copyOut($('copyJson'), buildJson);

$('groupOn').checked = ui.group;
$('groupMode').value = ui.groupMode;
$('groupMode').hidden = !ui.group;
$('groupOn').onchange = () => {
  ui.group = $('groupOn').checked;
  setPref('group', ui.group ? '1' : '0');
  $('groupMode').hidden = !ui.group;
  ui.open.clear();
  apply();
};
$('groupMode').onchange = () => { ui.groupMode = $('groupMode').value; setPref('groupMode', ui.groupMode); ui.open.clear(); apply(); };
document.querySelectorAll('.tab').forEach((t) => (t.onclick = () => showView(t.dataset.view)));
document.addEventListener('click', (e) => { const m = document.querySelector('.menu'); if (m.open && !m.contains(e.target)) m.open = false; });

$('syncNow').onclick = () => send({ type: 'sync' });
$('sSave').onclick = saveSettings;
$('sWhFormat').onchange = renderSample;
$('sTest').onclick = async () => {
  msg('Sending…');
  const r = await send({ type: 'testWebhook' });
  r?.ok ? msg(`Test delivered (HTTP ${r.status}).`) : msg(`Test failed: ${r?.error || 'unknown error'}. Save settings first if you changed the URL.`, true);
};
$('sRetry').onclick = async () => { await send({ type: 'flushOutbox' }); renderSettingsInfo(); };
$('sClearOutbox').onclick = async () => { if (confirm('Discard all queued webhook deliveries?')) { await store.clear('outbox'); renderSettingsInfo(); } };
$('sHistory').onclick = () => { send({ type: 'importHistory' }); setTimeout(renderSettingsInfo, 300); };
$('sHistoryReset').onclick = async () => { await send({ type: 'resetHistory' }); renderSettingsInfo(); };
$('logFilter').onchange = renderLog;
$('logExport').onclick = exportLog;
$('sLookups').onclick = async () => {
  $('sLookups').disabled = true;
  const r = await send({ type: 'refreshLookups' });
  $('sLookups').disabled = false;
  if (!r?.ok) msg(`Couldn’t refresh names: ${r?.error}`, true);
  await load(); renderSettingsInfo();
};
$('sGapAudit').onclick = async () => {
  const btn = $('sGapAudit');
  const info = $('sGapInfo');
  btn.disabled = true;
  info.textContent = 'Checking…';
  const r = await send({ type: 'gapAudit' });
  btn.disabled = false;
  if (!r?.ok) { info.textContent = `Couldn’t check: ${r?.error || 'unknown error'}`; return; }
  if (!r.missingCount) {
    info.textContent = `No gaps in the newest ${r.checked.toLocaleString()} alerts (${r.pages} page${r.pages === 1 ? '' : 's'}).`;
    return;
  }
  const newest = r.missing.slice(0, 3).map((m) => `${m.title} (${new Date(m.created_at * 1000).toLocaleString()})`).join('; ');
  info.textContent = `${r.missingCount.toLocaleString()} alert${r.missingCount === 1 ? '' : 's'} on GridPane are not stored, newest: ${newest}. Run Import older history.`;
};
$('sWipe').onclick = async () => {
  if (!confirm('Delete every stored alert from this browser? GridPane itself is not affected.')) return;
  await store.clear('notifications'); await store.clear('outbox');
  const { state = {} } = await chrome.storage.local.get('state');
  await chrome.storage.local.set({ state: { ...state, cursor: null, historyNextPage: 1, historyDone: false, unseen: 0 } });
  await load(); renderSettingsInfo();
};

// Refresh when the background sync finishes.
chrome.storage.onChanged.addListener((changes) => {
  if (!changes.state) return;
  renderStatus();
  const o = changes.state.oldValue || {}, n = changes.state.newValue || {};
  const importProgress = n.syncing && n.syncPage !== o.syncPage && n.syncPage % 10 === 0;
  if (n.lastSync !== o.lastSync || (o.syncing && !n.syncing) || importProgress) {
    load();
    if (!$('view-log').hidden) renderLog();
  }
  if (!$('view-settings').hidden) renderSettingsInfo();
});
setInterval(renderStatus, 30000);

renderColMenu();
await load();
await loadSettings();
await renderStatus();
send({ type: 'seen' });
