import test from 'node:test';
import assert from 'node:assert/strict';
import { pageOldest, shouldStop, nextCursor, missingIds, newestOf, backfillStart, batchDone, sortNewestFirst, overlapSeconds } from '../lib/scan.js';

test('pageOldest returns the oldest timestamp on the page', () => {
  assert.equal(pageOldest([{ created_at: 30 }, { created_at: 10 }, { created_at: 20 }]), 10);
});

test('pageOldest returns 0 for an empty page', () => {
  assert.equal(pageOldest([]), 0);
  assert.equal(pageOldest(null), 0);
});

test('shouldStop continues while more pages remain above the floor', () => {
  assert.equal(shouldStop({ more: true, oldest: 200, floor: 100 }), false);
});

test('shouldStop stops when the page reaches the floor', () => {
  assert.equal(shouldStop({ more: true, oldest: 99, floor: 100 }), true);
});

test('shouldStop keeps scanning when the oldest alert equals the floor', () => {
  assert.equal(shouldStop({ more: true, oldest: 100, floor: 100 }), false);
});

test('shouldStop stops when GridPane has no more pages', () => {
  assert.equal(shouldStop({ more: false, oldest: 200, floor: 100 }), true);
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

test('overlapSeconds keeps the two-hour default for a missing or invalid value', () => {
  assert.equal(overlapSeconds(undefined), 7200);
  assert.equal(overlapSeconds(null), 7200);
  assert.equal(overlapSeconds(NaN), 7200);
  assert.equal(overlapSeconds('abc'), 7200);
  assert.equal(overlapSeconds(-1), 7200);
  assert.equal(overlapSeconds(0), 7200);
});

test('overlapSeconds converts hours to whole seconds', () => {
  assert.equal(overlapSeconds(0.5), 1800);
  assert.equal(overlapSeconds(1), 3600);
  assert.equal(overlapSeconds(1.25), 4500);
  assert.equal(overlapSeconds(2), 7200);
  assert.equal(overlapSeconds('2'), 7200);
});

test('overlapSeconds clamps to the allowed range', () => {
  assert.equal(overlapSeconds(0.1), 1800);
  assert.equal(overlapSeconds(24), 86400);
  assert.equal(overlapSeconds(48), 86400);
});
