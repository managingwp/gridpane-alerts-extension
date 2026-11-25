// Pure decisions for the notification page walk. No chrome.*, db.js or
// normalize.js imports, so Node can test these without an extension runtime.

// The catch-up window below the cursor, in seconds. The setting is in hours;
// a missing or invalid value keeps the original two-hour window, and the range
// is bounded so a typo cannot turn one check into a history-wide walk.
export const MIN_OVERLAP_HOURS = 0.5;
export const MAX_OVERLAP_HOURS = 24;
export const DEFAULT_OVERLAP_HOURS = 2;

export function overlapSeconds(hours) {
  const n = Number(hours);
  const valid = Number.isFinite(n) && n > 0 ? n : DEFAULT_OVERLAP_HOURS;
  return Math.round(Math.min(MAX_OVERLAP_HOURS, Math.max(MIN_OVERLAP_HOURS, valid)) * 3600);
}

// Oldest created_at (Unix seconds) on a page, or 0 when the page is empty.
export function pageOldest(items) {
  return (items || []).reduce((oldest, item) => {
    const t = Number(item?.created_at) || 0;
    return t && (!oldest || t < oldest) ? t : oldest;
  }, 0);
}

// The overlap floor is now a cap, not the routine walk length: it bounds how
// far a late batch found below the last stored alert is followed. Reaching the
// floor exactly still counts as scanned, so an alert sitting on the boundary is
// stored before the walk ends.
export function shouldStop({ more, oldest, floor }) {
  if (!more) return true;
  return Number(oldest) < Number(floor);
}

// Did this page contain, or cross below, the last alert the previous check
// stored? The id is the strong signal; the timestamp is the fallback for an
// alert GridPane no longer serves.
export function passedBoundary({ items, cursor } = {}) {
  const page = items || [];
  if (!cursor || !page.length) return false;
  const id = cursor.id;
  if (id != null && page.some((item) => item && String(item.id) === String(id))) return true;
  const at = Number(cursor.created_at) || 0;
  if (!at) return false;
  const oldest = pageOldest(page);
  return oldest > 0 && oldest <= at;
}

// Stop the routine walk on the first page after the boundary that adds no new
// alerts: that is the next-ten-items confirmation once the last stored alert
// has been reached. A page of fresh alerts below the boundary keeps the walk
// going until it finds a clean page.
export function walkDone({ more, page, boundaryPage, freshCount }) {
  if (!more) return true;
  if (boundaryPage == null) return false;
  return Number(page) > boundaryPage && Number(freshCount) === 0;
}

// One page of the routine walk: update the boundary page and decide whether it
// ends here. `reached` is only true when the walk confirmed the page after the
// last stored alert (or reached the end of history); an overlap-cap stop leaves
// it false so the cursor does not advance past alerts that were not followed.
export function walkStep({ page, items, cursor, boundaryPage, freshCount, more, floor } = {}) {
  const oldest = pageOldest(items);
  const boundary = boundaryPage != null ? boundaryPage : (passedBoundary({ items, cursor }) ? page : null);
  const step = { boundaryPage: boundary, oldest, stop: false, reached: false, floorStop: false };
  if (walkDone({ more, page, boundaryPage: boundary, freshCount })) {
    return { ...step, stop: true, reached: true };
  }
  if (shouldStop({ more, oldest, floor })) {
    return { ...step, stop: true, floorStop: true };
  }
  return step;
}

// The cursor is the last confirmed alert, not a scan floor: only move it
// forward when the walk confirmed the page after the last stored alert (or
// reached the end of history), and never let a stale page-1 entry pull it
// backwards. Callers pass newestOf(items) here.
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
