import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clampOverlapHours,
  mergeDemoSnapshot,
  mergeSettingsSection,
  normalizeSettingsSection,
  settingsDiff,
  webhookReady,
} from '../lib/settings.js';

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

const PAINTED = {
  webhookEnabled: true,
  webhookUrl: 'https://example.com/hooks/gridpane',
  webhookSecret: 's3cret',
  webhookFormat: 'full',
  webhookIncludeBackfill: false,
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

test('a key absent from the patch keeps its stored value', () => {
  const next = mergeSettingsSection(STORED, 'webhook', { webhookUrl: 'https://hooks.example.com/new' });
  assert.equal(next.webhookUrl, 'https://hooks.example.com/new');
  assert.equal(next.webhookSecret, STORED.webhookSecret);
  assert.equal(next.webhookEnabled, STORED.webhookEnabled);
  assert.equal(next.webhookFormat, STORED.webhookFormat);
  assert.equal(next.webhookIncludeBackfill, STORED.webhookIncludeBackfill);
  assert.equal(next.webhookBackfillCount, STORED.webhookBackfillCount);
  assert.equal(next.pollSeconds, STORED.pollSeconds);
});

test('an empty patch keeps the record byte-for-byte', () => {
  assert.deepEqual(mergeSettingsSection(STORED, 'webhook', {}), STORED);
  assert.deepEqual(mergeSettingsSection(STORED, 'sync', {}), STORED);
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

test('an unknown webhook format falls back to full when it is supplied', () => {
  assert.equal(mergeSettingsSection({}, 'webhook', { webhookFormat: 'markdown' }).webhookFormat, 'full');
  assert.equal('webhookFormat' in mergeSettingsSection({}, 'webhook', {}), false);
  assert.equal(mergeSettingsSection({}, 'webhook', { webhookFormat: 'slack' }).webhookFormat, 'slack');
});

test('booleans are stored as booleans and unsupplied strings are not invented', () => {
  const next = mergeSettingsSection({}, 'webhook', { webhookEnabled: 1, webhookIncludeBackfill: 'yes' });
  assert.equal(next.webhookEnabled, true);
  assert.equal(next.webhookIncludeBackfill, true);
  assert.equal('webhookUrl' in next, false);
  assert.equal('webhookSecret' in next, false);
});

test('an unknown section leaves the record unchanged', () => {
  const next = mergeSettingsSection(STORED, 'sample', { pollSeconds: 15 });
  assert.deepEqual(next, STORED);
  assert.notEqual(next, STORED);
});

test('a webhook save stores the backfill count and clamps it when supplied', () => {
  assert.equal(mergeSettingsSection(STORED, 'webhook', { webhookBackfillCount: 12 }).webhookBackfillCount, 12);
  assert.equal(mergeSettingsSection(STORED, 'webhook', { webhookBackfillCount: 501 }).webhookBackfillCount, 500);
  assert.equal(mergeSettingsSection(STORED, 'webhook', { webhookBackfillCount: 'nope' }).webhookBackfillCount, 30);
  assert.equal(mergeSettingsSection({ ...STORED, webhookBackfillCount: 10 }, 'webhook', {}).webhookBackfillCount, 10);
  assert.equal(mergeSettingsSection(STORED, 'sync', { pollSeconds: 60, overlapHours: 2 }).webhookBackfillCount, 30);
});

test('normalizeSettingsSection keeps only the supplied keys', () => {
  assert.deepEqual(normalizeSettingsSection('webhook', {}), {});
  assert.deepEqual(normalizeSettingsSection('sync', {}), {});
  assert.deepEqual(normalizeSettingsSection('webhook', { webhookUrl: '  https://x.test  ' }), { webhookUrl: 'https://x.test' });
  assert.deepEqual(normalizeSettingsSection('sync', { overlapHours: '99' }), { overlapHours: 24 });
  assert.deepEqual(normalizeSettingsSection('sync', { pollSeconds: 1 }), { pollSeconds: 15 });
  assert.deepEqual(normalizeSettingsSection('other', { pollSeconds: 30 }), {});
});

test('settingsDiff reports no change for an untouched form', () => {
  assert.deepEqual(settingsDiff(PAINTED, { ...PAINTED }, 'webhook'), {});
  assert.deepEqual(settingsDiff({ pollSeconds: 75, overlapHours: 2 }, { pollSeconds: 75, overlapHours: 2 }, 'sync'), {});
});

test('settingsDiff compares normalised values', () => {
  assert.deepEqual(settingsDiff(PAINTED, {
    ...PAINTED,
    webhookUrl: '  https://example.com/hooks/gridpane  ',
    webhookBackfillCount: '30',
  }, 'webhook'), {});
  assert.deepEqual(settingsDiff({ pollSeconds: 75, overlapHours: 2 }, { pollSeconds: '75', overlapHours: '2' }, 'sync'), {});
});

test('settingsDiff returns only the edited key', () => {
  assert.deepEqual(settingsDiff(PAINTED, { ...PAINTED, webhookFormat: 'slack' }, 'webhook'), { webhookFormat: 'slack' });
  assert.deepEqual(settingsDiff({ pollSeconds: 75, overlapHours: 2 }, { pollSeconds: 75, overlapHours: '6' }, 'sync'), { overlapHours: 6 });
});

test('settingsDiff ignores fields the form did not supply', () => {
  assert.deepEqual(settingsDiff(PAINTED, { webhookUrl: 'https://new.example/hook' }, 'webhook'), { webhookUrl: 'https://new.example/hook' });
  assert.deepEqual(settingsDiff(PAINTED, {}, 'webhook'), {});
});

test('settingsDiff ignores an unknown section', () => {
  assert.deepEqual(settingsDiff(PAINTED, { webhookUrl: 'https://new.example' }, 'sample'), {});
});

test('mergeDemoSnapshot folds a save into the settings snapshot', () => {
  const demo = { active: true, alerts: 24, previousSettings: { pollSeconds: 300, webhookUrl: 'https://old.example' } };
  const next = mergeDemoSnapshot(demo, { webhookUrl: 'https://new.example', webhookSecret: 'new' });
  assert.notEqual(next, demo);
  assert.deepEqual(next.previousSettings, { pollSeconds: 300, webhookUrl: 'https://new.example', webhookSecret: 'new' });
  assert.equal(next.active, true);
  assert.equal(next.alerts, 24);
  assert.deepEqual(demo.previousSettings, { pollSeconds: 300, webhookUrl: 'https://old.example' });
});

test('mergeDemoSnapshot leaves the record alone when it cannot apply', () => {
  const demo = { active: true, previousSettings: {} };
  const inactive = { active: false, previousSettings: {} };
  assert.equal(mergeDemoSnapshot(demo, {}), demo);
  assert.equal(mergeDemoSnapshot(inactive, { webhookUrl: 'https://new.example' }), inactive);
  assert.equal(mergeDemoSnapshot(undefined, { webhookUrl: 'https://new.example' }), undefined);
  assert.deepEqual(mergeDemoSnapshot({ active: true }, { webhookUrl: 'https://new.example' }).previousSettings, { webhookUrl: 'https://new.example' });
});

test('webhookReady needs an enabled webhook and a non-blank URL', () => {
  assert.equal(webhookReady({ webhookEnabled: true, webhookUrl: 'https://example.com/hook' }), true);
  assert.equal(webhookReady({ webhookEnabled: true, webhookUrl: '  https://example.com/hook  ' }), true);
  assert.equal(webhookReady({ webhookEnabled: false, webhookUrl: 'https://example.com/hook' }), false);
  assert.equal(webhookReady({ webhookEnabled: true, webhookUrl: '   ' }), false);
  assert.equal(webhookReady({}), false);
});
