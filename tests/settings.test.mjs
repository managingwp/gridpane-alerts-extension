import test from 'node:test';
import assert from 'node:assert/strict';

import { clampOverlapHours, mergeSettingsSection, webhookReady } from '../lib/settings.js';

const STORED = {
  pollSeconds: 75,
  overlapHours: 6,
  webhookEnabled: true,
  webhookUrl: 'https://example.com/hooks/gridpane',
  webhookSecret: 's3cret',
  webhookFormat: 'slack',
  webhookIncludeBackfill: true,
  webhookBackfillCount: 30,
};

test('a sync save keeps every stored webhook value', () => {
  const next = mergeSettingsSection(STORED, 'sync', { pollSeconds: 300, overlapHours: '12' });
  for (const key of Object.keys(STORED).filter((k) => k.startsWith('webhook'))) {
    assert.deepEqual(next[key], STORED[key], key);
  }
  assert.equal(next.pollSeconds, 300);
  assert.equal(next.overlapHours, 12);
});

test('a webhook save keeps the stored interval and overlap', () => {
  const next = mergeSettingsSection(STORED, 'webhook', {
    webhookEnabled: false,
    webhookUrl: '  https://hooks.example.com/new  ',
    webhookSecret: '',
    webhookFormat: 'chat',
    webhookIncludeBackfill: false,
  });
  assert.equal(next.pollSeconds, STORED.pollSeconds);
  assert.equal(next.overlapHours, STORED.overlapHours);
  assert.equal(next.webhookEnabled, false);
  assert.equal(next.webhookUrl, 'https://hooks.example.com/new');
  assert.equal(next.webhookSecret, '');
  assert.equal(next.webhookFormat, 'chat');
  assert.equal(next.webhookIncludeBackfill, false);
});

test('a sync save drops a legacy pollMinutes', () => {
  const next = mergeSettingsSection({ ...STORED, pollMinutes: 5 }, 'sync', { pollSeconds: 75, overlapHours: 2 });
  assert.equal('pollMinutes' in next, false);
});

test('clampOverlapHours bounds the window and keeps the default for junk', () => {
  assert.equal(clampOverlapHours(0), 0.5);
  assert.equal(clampOverlapHours(-1), 0.5);
  assert.equal(clampOverlapHours(''), 2);
  assert.equal(clampOverlapHours('nope'), 2);
  assert.equal(clampOverlapHours(NaN), 2);
  assert.equal(clampOverlapHours(0.5), 0.5);
  assert.equal(clampOverlapHours('6'), 6);
  assert.equal(clampOverlapHours(24), 24);
  assert.equal(clampOverlapHours(25), 24);
  assert.equal(clampOverlapHours(1, 3), 1);
});

test('an unknown webhook format falls back to full', () => {
  assert.equal(mergeSettingsSection({}, 'webhook', { webhookFormat: 'markdown' }).webhookFormat, 'full');
  assert.equal(mergeSettingsSection({}, 'webhook', {}).webhookFormat, 'full');
  assert.equal(mergeSettingsSection({}, 'webhook', { webhookFormat: 'slack' }).webhookFormat, 'slack');
});

test('booleans are stored as booleans and strings are not invented', () => {
  const next = mergeSettingsSection({}, 'webhook', { webhookEnabled: 1, webhookIncludeBackfill: 'yes' });
  assert.equal(next.webhookEnabled, true);
  assert.equal(next.webhookIncludeBackfill, true);
  assert.equal(next.webhookUrl, '');
  assert.equal(next.webhookSecret, '');
});

test('an unknown section leaves the record unchanged', () => {
  const next = mergeSettingsSection(STORED, 'sample', { pollSeconds: 15 });
  assert.deepEqual(next, STORED);
  assert.notEqual(next, STORED);
});

test('a webhook save stores the backfill count and clamps it', () => {
  assert.equal(mergeSettingsSection(STORED, 'webhook', { webhookBackfillCount: 12 }).webhookBackfillCount, 12);
  assert.equal(mergeSettingsSection(STORED, 'webhook', { webhookBackfillCount: 501 }).webhookBackfillCount, 500);
  assert.equal(mergeSettingsSection(STORED, 'webhook', { webhookBackfillCount: 'nope' }).webhookBackfillCount, 30);
  assert.equal(mergeSettingsSection({ ...STORED, webhookBackfillCount: 10 }, 'webhook', {}).webhookBackfillCount, 30);
  assert.equal(mergeSettingsSection(STORED, 'sync', { pollSeconds: 60, overlapHours: 2 }).webhookBackfillCount, 30);
});

test('webhookReady needs an enabled webhook and a non-blank URL', () => {
  assert.equal(webhookReady({ webhookEnabled: true, webhookUrl: 'https://example.com/hook' }), true);
  assert.equal(webhookReady({ webhookEnabled: true, webhookUrl: '  https://example.com/hook  ' }), true);
  assert.equal(webhookReady({ webhookEnabled: false, webhookUrl: 'https://example.com/hook' }), false);
  assert.equal(webhookReady({ webhookEnabled: true, webhookUrl: '   ' }), false);
  assert.equal(webhookReady({}), false);
});
