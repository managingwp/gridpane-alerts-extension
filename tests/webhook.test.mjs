import test from 'node:test';
import assert from 'node:assert/strict';

import { DEFAULT_BACKFILL_COUNT, MAX_BACKFILL_COUNT, backfillIds, clampBackfillCount } from '../lib/webhook.js';

const alerts = (n) => Array.from({ length: n }, (_, i) => ({ id: String(i + 1), created_at: i + 1 }));

test('clampBackfillCount keeps a whole number of 1 to 500', () => {
  assert.equal(clampBackfillCount(0), DEFAULT_BACKFILL_COUNT);
  assert.equal(clampBackfillCount(-1), DEFAULT_BACKFILL_COUNT);
  assert.equal(clampBackfillCount(''), DEFAULT_BACKFILL_COUNT);
  assert.equal(clampBackfillCount('nope'), DEFAULT_BACKFILL_COUNT);
  assert.equal(clampBackfillCount(NaN), DEFAULT_BACKFILL_COUNT);
  assert.equal(clampBackfillCount(1), 1);
  assert.equal(clampBackfillCount('12'), 12);
  assert.equal(clampBackfillCount(12.9), 12);
  assert.equal(clampBackfillCount(MAX_BACKFILL_COUNT), MAX_BACKFILL_COUNT);
  assert.equal(clampBackfillCount(MAX_BACKFILL_COUNT + 1), MAX_BACKFILL_COUNT);
  assert.equal(clampBackfillCount(0, 7), 7);
});

test('backfillIds picks the newest alerts and returns them oldest first', () => {
  assert.deepEqual(backfillIds(alerts(10), 3), ['8', '9', '10']);
  assert.deepEqual(backfillIds(alerts(10), 30), alerts(10).map((a) => a.id));
  assert.deepEqual(backfillIds(alerts(10), 1), ['10']);
});

test('backfillIds collapses duplicates and ignores records without an id', () => {
  const records = [
    { id: 'x', created_at: 2 },
    { id: 'x', created_at: 2 },
    { id: 'y', created_at: 1 },
    { id: null, created_at: 9 },
    { created_at: 8 },
  ];
  assert.deepEqual(backfillIds(records, 30), ['y', 'x']);
});

test('backfillIds returns an empty list for an empty archive', () => {
  assert.deepEqual(backfillIds([], 30), []);
  assert.deepEqual(backfillIds(undefined, 30), []);
});

test('created_at ties keep a deterministic id order', () => {
  const records = [
    { id: 'b', created_at: 5 },
    { id: 'a', created_at: 5 },
    { id: 'c', created_at: 5 },
  ];
  assert.deepEqual(backfillIds(records, 2), ['b', 'c']);
  assert.deepEqual(backfillIds(records, 30), ['a', 'b', 'c']);
});

test('a junk id is stringified once, not dropped', () => {
  assert.deepEqual(backfillIds([{ id: 42, created_at: 1 }], 30), ['42']);
});
