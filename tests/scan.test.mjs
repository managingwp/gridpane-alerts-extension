import test from 'node:test';
import assert from 'node:assert/strict';
import { pageOldest, nextCursor, missingIds, newestOf, backfillStart, resolveBackfill, backfillActive, armBackfill, batchDone, sortNewestFirst, passedBoundary, walkDone, walkStep, clampCatchUpPages, lateBatchDone } from '../lib/scan.js';

test('pageOldest returns the oldest timestamp on the page', () => {
  assert.equal(pageOldest([{ created_at: 30 }, { created_at: 10 }, { created_at: 20 }]), 10);
});

test('pageOldest returns 0 for an empty page', () => {
  assert.equal(pageOldest([]), 0);
  assert.equal(pageOldest(null), 0);
});

test('lateBatchDone keeps probing up to the page budget below the boundary', () => {
  assert.equal(lateBatchDone({ page: 2, boundaryPage: 1, catchUpPages: 2 }), false);
  assert.equal(lateBatchDone({ page: 3, boundaryPage: 1, catchUpPages: 2 }), true);
});

test('lateBatchDone counts from the boundary page, not from page 1', () => {
  assert.equal(lateBatchDone({ page: 6, boundaryPage: 5, catchUpPages: 2 }), false);
  assert.equal(lateBatchDone({ page: 7, boundaryPage: 5, catchUpPages: 2 }), true);
});

test('lateBatchDone stays open before the boundary is found', () => {
  assert.equal(lateBatchDone({ page: 4, boundaryPage: null, catchUpPages: 2 }), false);
  assert.equal(lateBatchDone({}), false);
});

test('nextCursor keeps the current cursor when the walk was capped', () => {
  const current = { id: 'a', created_at: 100 };
  assert.deepEqual(nextCursor({ reached: false, newest: { id: 'b', created_at: 200 }, current }), current);
});

test('nextCursor advances to the newest alert after a completed walk', () => {
  const newest = { id: 'b', created_at: 200 };
  assert.deepEqual(nextCursor({ reached: true, newest, current: { id: 'a', created_at: 100 } }), newest);
});

test('nextCursor falls back to the current cursor when nothing is newer', () => {
  const current = { id: 'a', created_at: 100 };
  assert.deepEqual(nextCursor({ reached: true, newest: null, current }), current);
});

test('nextCursor keeps a current cursor that is newer than the page', () => {
  const current = { id: 'a', created_at: 300 };
  assert.deepEqual(nextCursor({ reached: true, newest: { id: 'b', created_at: 200 }, current }), current);
});

test('newestOf picks the maximum created_at, not the first entry', () => {
  const items = [{ id: 'a', created_at: 30 }, { id: 'b', created_at: 90 }, { id: 'c', created_at: 60 }];
  assert.equal(newestOf(items).id, 'b');
});

test('newestOf keeps the first entry on a tie', () => {
  const items = [{ id: 'a', created_at: 50 }, { id: 'b', created_at: 50 }];
  assert.equal(newestOf(items).id, 'a');
});

test('newestOf returns null for an empty or missing list', () => {
  assert.equal(newestOf([]), null);
  assert.equal(newestOf(null), null);
  assert.equal(newestOf(undefined), null);
});

test('backfillStart resumes after the page the new-alert walk reached', () => {
  assert.equal(backfillStart({ nextPage: 2, lastWalkedPage: 5 }), 6);
});

test('backfillStart uses the recorded page when it is ahead of the walk', () => {
  assert.equal(backfillStart({ nextPage: 12, lastWalkedPage: 3 }), 12);
});

test('backfillStart defaults to page 1 on junk input', () => {
  assert.equal(backfillStart({ nextPage: 0, lastWalkedPage: 0 }), 1);
  assert.equal(backfillStart({ nextPage: 'x' }), 1);
  assert.equal(backfillStart({}), 1);
});

test('resolveBackfill is idle without a stored record', () => {
  assert.deepEqual(resolveBackfill({}), { nextPage: 1, done: true });
  assert.deepEqual(resolveBackfill({ historyDone: false, historyNextPage: 4 }), { nextPage: 1, done: true });
});

test('resolveBackfill returns the stored record', () => {
  const record = { nextPage: 7, done: false, userStarted: true };
  assert.equal(resolveBackfill({ backfill: record }), record);
});

test('backfillActive needs an armed, unfinished pass', () => {
  assert.equal(backfillActive({ nextPage: 2, done: false, userStarted: true }), true);
  assert.equal(backfillActive({ nextPage: 2, done: true, userStarted: true }), false);
  assert.equal(backfillActive({ nextPage: 2, done: false }), false);
  assert.equal(backfillActive(null), false);
  assert.equal(backfillActive(undefined), false);
});

test('armBackfill starts below the newest page by default', () => {
  assert.deepEqual(armBackfill(), { nextPage: 2, done: false, userStarted: true });
});

test('armBackfill accepts page 1 and rejects junk', () => {
  assert.deepEqual(armBackfill(1), { nextPage: 1, done: false, userStarted: true });
  assert.deepEqual(armBackfill('9'), { nextPage: 9, done: false, userStarted: true });
  assert.deepEqual(armBackfill(0), { nextPage: 2, done: false, userStarted: true });
  assert.deepEqual(armBackfill('x'), { nextPage: 2, done: false, userStarted: true });
});

test('batchDone is false below the budget', () => {
  assert.equal(batchDone({ page: 10, startPage: 5, batch: 20, more: true }), false);
});

test('batchDone is true when the budget is spent', () => {
  assert.equal(batchDone({ page: 24, startPage: 5, batch: 20, more: true }), true);
});

test('batchDone is true when GridPane has no more pages', () => {
  assert.equal(batchDone({ page: 5, startPage: 5, batch: 20, more: false }), true);
});

test('sortNewestFirst orders by created_at descending without mutating', () => {
  const items = [{ id: 'a', created_at: 10 }, { id: 'b', created_at: 30 }, { id: 'c', created_at: 20 }];
  const sorted = sortNewestFirst(items);
  assert.deepEqual(sorted.map((i) => i.id), ['b', 'c', 'a']);
  assert.deepEqual(items.map((i) => i.id), ['a', 'b', 'c']);
});

test('sortNewestFirst treats a missing created_at as oldest', () => {
  const sorted = sortNewestFirst([{ id: 'a' }, { id: 'b', created_at: 5 }, { id: 'c', created_at: 'x' }]);
  assert.deepEqual(sorted.map((i) => i.id), ['b', 'a', 'c']);
});

test('missingIds returns unseen ids in remote order', () => {
  const remote = [
    { id: 'a', title: 'A' },
    { id: 42, title: 'B' },
    { id: 'c', title: 'C' },
  ];
  const missing = missingIds(remote, new Set(['a', 'c']));
  assert.deepEqual(missing.map((n) => n.id), [42]);
});

test('clampCatchUpPages keeps the default for a blank or invalid value', () => {
  assert.equal(clampCatchUpPages(undefined), 2);
  assert.equal(clampCatchUpPages(null), 2);
  assert.equal(clampCatchUpPages(NaN), 2);
  assert.equal(clampCatchUpPages('abc'), 2);
  assert.equal(clampCatchUpPages(''), 2);
});

test('clampCatchUpPages converts to whole pages in range', () => {
  assert.equal(clampCatchUpPages(2), 2);
  assert.equal(clampCatchUpPages('4'), 4);
  assert.equal(clampCatchUpPages(2.6), 3);
});

test('clampCatchUpPages clamps to the allowed range', () => {
  assert.equal(clampCatchUpPages(0), 1);
  assert.equal(clampCatchUpPages(-1), 1);
  assert.equal(clampCatchUpPages(10), 10);
  assert.equal(clampCatchUpPages(48), 10);
});

test('passedBoundary is true when the cursor id is on the page', () => {
  const items = [{ id: 3, created_at: 300 }, { id: 2, created_at: 200 }];
  assert.equal(passedBoundary({ items, cursor: { id: '2', created_at: 200 } }), true);
});

test('passedBoundary is true when the page reaches the cursor timestamp', () => {
  const items = [{ id: 5, created_at: 500 }, { id: 4, created_at: 400 }];
  assert.equal(passedBoundary({ items, cursor: { id: 'gone', created_at: 450 } }), true);
});

test('passedBoundary is false while the page is newer than the cursor', () => {
  const items = [{ id: 9, created_at: 900 }, { id: 8, created_at: 800 }];
  assert.equal(passedBoundary({ items, cursor: { id: 'gone', created_at: 500 } }), false);
});

test('passedBoundary is false without a cursor, items or a timestamp', () => {
  assert.equal(passedBoundary({ items: [{ id: 1, created_at: 1 }], cursor: null }), false);
  assert.equal(passedBoundary({ items: [], cursor: { id: '1', created_at: 1 } }), false);
  assert.equal(passedBoundary({}), false);
  assert.equal(passedBoundary({ items: [{ id: 1, created_at: 1 }], cursor: { id: 'gone' } }), false);
});

test('walkDone stops at the end of the bell', () => {
  assert.equal(walkDone({ more: false, page: 1, boundaryPage: null, freshCount: 0 }), true);
});

test('walkDone keeps reading until the boundary is seen', () => {
  assert.equal(walkDone({ more: true, page: 1, boundaryPage: null, freshCount: 0 }), false);
});

test('walkDone keeps reading on the boundary page', () => {
  assert.equal(walkDone({ more: true, page: 3, boundaryPage: 3, freshCount: 0 }), false);
  assert.equal(walkDone({ more: true, page: 3, boundaryPage: 3, freshCount: 2 }), false);
});

test('walkDone stops on the first clean page after the boundary', () => {
  assert.equal(walkDone({ more: true, page: 4, boundaryPage: 3, freshCount: 0 }), true);
});

test('walkDone keeps reading while the probe page adds alerts', () => {
  assert.equal(walkDone({ more: true, page: 4, boundaryPage: 3, freshCount: 1 }), false);
  assert.equal(walkDone({ more: true, page: 5, boundaryPage: 3, freshCount: 0 }), true);
});

test('the boundary probe reads one clean page past the last stored alert', () => {
  const item = (id, created_at) => ({ id: String(id), created_at });
  const page = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => item(from + i, 1000 - (from + i)));
  const archived = [...page(1, 30)];

  // A small loop over the production decision, so the assertions exercise
  // walkStep rather than a copy of its logic.
  function probeWalk(pages, { cursorId = '1', createdAt = 1000, catchUpPages = 2 } = {}) {
    const seen = new Set(archived.map((alert) => alert.id));
    let boundaryPage = null;
    let reads = 0;
    for (let n = 1; n <= pages.length; n++) {
      const items = pages[n - 1];
      reads++;
      const fresh = items.filter((alert) => !seen.has(alert.id));
      for (const alert of fresh) seen.add(alert.id);
      const step = walkStep({
        page: n, items, cursor: { id: cursorId, created_at: createdAt },
        boundaryPage, freshCount: fresh.length, more: n < pages.length, catchUpPages,
      });
      boundaryPage = step.boundaryPage;
      if (step.stop) return { reads, boundaryPage, reached: step.reached, lateStop: step.lateStop };
    }
    return { reads, boundaryPage, reached: false, lateStop: false };
  }

  // Quiet: page 1 holds the last stored alert, page 2 confirms nothing is new.
  assert.deepEqual(probeWalk([page(1, 10), page(11, 20), page(21, 30)]), { reads: 2, boundaryPage: 1, reached: true, lateStop: false });

  // New alerts above the boundary on page 1: still only one confirmation page.
  const withNew = [item('n1', 1100), ...page(1, 9)];
  assert.deepEqual(probeWalk([withNew, page(11, 20), page(21, 30)]), { reads: 2, boundaryPage: 1, reached: true, lateStop: false });

  // A late alert on the probe page pulls in one more page before the clean stop.
  const lateProbe = [{ id: 'n2', created_at: 900 }, ...page(11, 19)];
  assert.deepEqual(probeWalk([withNew, lateProbe, page(21, 30)]), { reads: 3, boundaryPage: 1, reached: true, lateStop: false });

  // A late batch on every page reaches the page cap without a clean stop, so the
  // cursor must not advance.
  const lateAgain = [{ id: 'n3', created_at: 890 }, ...page(21, 29)];
  assert.deepEqual(probeWalk([withNew, lateProbe, lateAgain, page(31, 40)]), { reads: 3, boundaryPage: 1, reached: false, lateStop: true });

  // A one-page budget stops on the first page below the boundary.
  assert.deepEqual(probeWalk([withNew, lateProbe, page(21, 30)], { catchUpPages: 1 }), { reads: 2, boundaryPage: 1, reached: false, lateStop: true });
});
