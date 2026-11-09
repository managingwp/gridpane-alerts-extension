import test from 'node:test';
import assert from 'node:assert/strict';
import { pageOldest, shouldStop, nextCursor, missingIds } from '../lib/scan.js';

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

test('missingIds returns unseen ids in remote order', () => {
  const remote = [
    { id: 'a', title: 'A' },
    { id: 42, title: 'B' },
    { id: 'c', title: 'C' },
  ];
  const missing = missingIds(remote, new Set(['a', 'c']));
  assert.deepEqual(missing.map((n) => n.id), [42]);
});
