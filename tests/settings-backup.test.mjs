import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BACKUP_SCHEMA,
  buildSettingsBackup,
  normalizeSettingsRecord,
  parseSettingsBackup,
} from '../lib/settings-backup.js';
import { defaultSettings } from '../lib/settings.js';

const STORED = {
  pollSeconds: 75,
  overlapHours: 6,
  webhookEnabled: true,
  webhookUrl: 'https://example.com/hooks/gridpane',
  webhookSecret: 's3cret',
  webhookFormat: 'slack',
  webhookIncludeBackfill: true,
  webhookBackfillCount: 42,
};

test('a backup round-trips every setting unchanged', () => {
  const backup = buildSettingsBackup(STORED, Date.UTC(2026, 10, 25, 12, 0, 0));
  assert.equal(backup.schema, BACKUP_SCHEMA);
  assert.equal(backup.exported_at, '2026-11-25T12:00:00.000Z');
  const parsed = parseSettingsBackup(JSON.stringify(backup));
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.settings, STORED);
  assert.equal(parsed.exported_at, backup.exported_at);
});

test('a backup fills a complete record from defaults', () => {
  const parsed = parseSettingsBackup(JSON.stringify({ schema: 1, settings: { webhookUrl: 'https://example.com/hook' } }));
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.settings, { ...defaultSettings(), webhookUrl: 'https://example.com/hook' });
});

test('a backup migrates a legacy pollMinutes interval to seconds', () => {
  const parsed = parseSettingsBackup(JSON.stringify({ schema: 1, settings: { pollMinutes: 1, webhookUrl: 'https://example.com/hook' } }));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.settings.pollSeconds, 60);
  assert.equal('pollMinutes' in parsed.settings, false);
});

test('a backup clamps values the Settings page would clamp', () => {
  const parsed = parseSettingsBackup(JSON.stringify({
    schema: 1,
    settings: { pollSeconds: 1, overlapHours: 99, webhookBackfillCount: 501, webhookFormat: 'markdown' },
  }));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.settings.pollSeconds, 15);
  assert.equal(parsed.settings.overlapHours, 24);
  assert.equal(parsed.settings.webhookBackfillCount, 500);
  assert.equal(parsed.settings.webhookFormat, 'full');
});

test('a backup keeps a present secret and an absent one stays empty', () => {
  assert.equal(parseSettingsBackup(JSON.stringify({ schema: 1, settings: { webhookSecret: 'shh' } })).settings.webhookSecret, 'shh');
  assert.equal(parseSettingsBackup(JSON.stringify({ schema: 1, settings: { webhookUrl: 'https://example.com/hook' } })).settings.webhookSecret, '');
});

test('unknown keys in a backup are ignored', () => {
  const parsed = parseSettingsBackup(JSON.stringify({
    schema: 1,
    settings: { webhookUrl: 'https://example.com/hook', pollMinutes: 5, webhookSecretTypo: 'x' },
    extra: { nested: true },
  }));
  assert.equal(parsed.ok, true);
  assert.equal('pollMinutes' in parsed.settings, false);
  assert.equal('webhookSecretTypo' in parsed.settings, false);
  assert.deepEqual(Object.keys(parsed.settings).sort(), Object.keys(defaultSettings()).sort());
});

test('junk is refused without throwing', () => {
  assert.doesNotThrow(() => parseSettingsBackup('not json'));
  const junk = parseSettingsBackup('not json');
  assert.equal(junk.ok, false);
  assert.match(junk.error, /not a settings backup/i);
  for (const text of ['null', '[]', '"text"', '42']) {
    const parsed = parseSettingsBackup(text);
    assert.equal(parsed.ok, false, text);
    assert.match(parsed.error, /not a settings backup/i, text);
  }
});

test('a wrong or missing schema is refused', () => {
  const missing = parseSettingsBackup(JSON.stringify({ settings: STORED }));
  assert.equal(missing.ok, false);
  assert.match(missing.error, /version/i);
  const wrong = parseSettingsBackup(JSON.stringify({ schema: 2, settings: STORED }));
  assert.equal(wrong.ok, false);
  assert.match(wrong.error, /version/i);
});

test('a backup with no settings object or no known key is refused', () => {
  const noSettings = parseSettingsBackup(JSON.stringify({ schema: 1 }));
  assert.equal(noSettings.ok, false);
  assert.match(noSettings.error, /settings object/i);
  const listSettings = parseSettingsBackup(JSON.stringify({ schema: 1, settings: [] }));
  assert.equal(listSettings.ok, false);
  const unknownOnly = parseSettingsBackup(JSON.stringify({ schema: 1, settings: { somethingElse: true } }));
  assert.equal(unknownOnly.ok, false);
  assert.match(unknownOnly.error, /recognisable settings/i);
});

test('normalizeSettingsRecord turns junk into a complete default record', () => {
  assert.deepEqual(normalizeSettingsRecord(), defaultSettings());
  assert.deepEqual(normalizeSettingsRecord({ pollSeconds: 'nope', overlapHours: null }), defaultSettings());
});
