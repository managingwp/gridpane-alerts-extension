// Pure decisions for the notification page walk. No chrome.*, db.js or
// normalize.js imports, so Node can test these without an extension runtime.

// The catch-up window below the cursor, in seconds. The setting is in hours;
// a missing or invalid value keeps the original two-hour window, and the range
// is bounded so a typo cannot turn one check into a history-wide walk.
export function overlapSeconds(hours) {
  const n = Number(hours);
  const valid = Number.isFinite(n) && n > 0 ? n : 2;
  return Math.round(Math.min(24, Math.max(0.5, valid)) * 3600);
}

// Oldest created_at (Unix seconds) on a page, or 0 when the page is empty.
export function pageOldest(items) {
  return (items || []).reduce((oldest, item) => {
    const t = Number(item?.created_at) || 0;
    return t && (!oldest || t < oldest) ? t : oldest;
  }, 0);
}

// Stop once GridPane has no more pages, or the page reaches the scan floor.
// Reaching the floor exactly still counts as scanned, so an alert sitting on
// the boundary is stored before the walk ends.
export function shouldStop({ more, oldest, floor }) {
  if (!more) return true;
  return Number(oldest) < Number(floor);
}

// The cursor is a scan floor, not a sentinel: only move it forward when the
// walk actually reached the floor (or the end of history), and never let a
// stale page-1 entry pull it backwards. Callers pass newestOf(items) here.
export function nextCursor({ reached, newest, current }) {
  if (!reached) return current || null;
  if (!newest) return current || null;
  const currentAt = Number(current?.created_at) || 0;
  const newestAt = Number(newest?.created_at) || 0;
  return currentAt >= newestAt ? current : newest;
}

// The newest alert on a page. GridPane can deliver a page whose first entry is
// not the newest, so never assume items[0].
export function newestOf(items) {
  let newest = null;
  for (const item of items || []) {
    if (!item) continue;
    if (!newest || (Number(item.created_at) || 0) > (Number(newest.created_at) || 0)) newest = item;
  }
  return newest;
}

// Where the backfill resumes: after the page the new-alert walk reached, and
// never back at page 1 while a later page has already been consumed.
export function backfillStart({ nextPage, lastWalkedPage }) {
  const recorded = Number(nextPage);
  const first = Number.isFinite(recorded) && recorded >= 1 ? Math.floor(recorded) : 1;
  const walked = Number(lastWalkedPage);
  const afterWalk = Number.isFinite(walked) && walked >= 0 ? Math.floor(walked) + 1 : 1;
  return Math.max(first, afterWalk);
}

// Stop a backfill batch when GridPane has no more pages or the budget is spent.
export function batchDone({ page, startPage, batch, more }) {
  if (!more) return true;
  const used = Number(page) - Number(startPage) + 1;
  const cap = Number(batch);
  return Number.isFinite(cap) && used >= cap;
}

// Newest-first copy for gap reporting; a missing or broken created_at sorts last.
export function sortNewestFirst(items) {
  return [...(items || [])].sort((a, b) => (Number(b?.created_at) || 0) - (Number(a?.created_at) || 0));
}

// Remote notifications whose id is not stored locally, in remote order.
export function missingIds(remote, localIds) {
  const have = localIds instanceof Set ? localIds : new Set(localIds || []);
  return (remote || []).filter((item) => !have.has(String(item?.id)));
}
