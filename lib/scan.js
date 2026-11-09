// Pure decisions for the notification page walk. No chrome.*, db.js or
// normalize.js imports, so Node can test these without an extension runtime.

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
// walk actually reached the floor (or the end of history).
export function nextCursor({ reached, newest, current }) {
  if (!reached) return current || null;
  return newest || current || null;
}

// Remote notifications whose id is not stored locally, in remote order.
export function missingIds(remote, localIds) {
  const have = localIds instanceof Set ? localIds : new Set(localIds || []);
  return (remote || []).filter((item) => !have.has(String(item?.id)));
}
