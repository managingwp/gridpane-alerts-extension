// Pure helpers for the manual webhook backfill: how many stored alerts to
// replay and which ids go out, oldest first. No chrome.* imports, so Node can
// test the selection without an extension runtime.

export const DEFAULT_BACKFILL_COUNT = 30;
export const MAX_BACKFILL_COUNT = 500;

// One integer between 1 and the cap. A blank, zero, fraction below one or junk
// value keeps the fallback, so an empty form still does something sensible.
export function clampBackfillCount(value, fallback = DEFAULT_BACKFILL_COUNT) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(MAX_BACKFILL_COUNT, Math.floor(n));
}

// Pick the newest N alerts and return their ids oldest first, the order live
// alerts and the outbox already use. A record without an id is ignored, and a
// repeated id counts once. created_at ties fall back to the id so a run is
// deterministic.
export function backfillIds(records = [], count = DEFAULT_BACKFILL_COUNT) {
  const limit = clampBackfillCount(count);
  const byId = new Map();
  for (const rec of records) {
    if (rec == null || rec.id == null) continue;
    const id = String(rec.id);
    if (!byId.has(id)) byId.set(id, rec);
  }
  // Oldest first, created_at ties by id. The newest selection is the same
  // comparison reversed, so the two orders cannot drift.
  const byOldest = (a, b) => {
    const at = Number(a.created_at) || 0;
    const bt = Number(b.created_at) || 0;
    if (at !== bt) return at - bt;
    return String(a.id).localeCompare(String(b.id));
  };
  return [...byId.values()]
    .sort((a, b) => byOldest(b, a))
    .slice(0, limit)
    .sort(byOldest)
    .map((rec) => String(rec.id));
}
