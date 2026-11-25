// Local settings backup. Pure: no chrome.* or DOM, so Node can test the file
// format without an extension runtime. The backup is the JSON the Data card
// downloads and restores; it carries the webhook URL and signing secret, so the
// UI and the privacy page say so.

import { intervalSecondsFromSettings } from './polling.js';
import { defaultSettings, mergeSettingsSection, SETTINGS_SECTION_KEYS } from './settings.js';

export const BACKUP_SCHEMA = 1;

export const BACKUP_KEYS = [...SETTINGS_SECTION_KEYS.sync, ...SETTINGS_SECTION_KEYS.webhook];

// The retired overlapHours key is accepted so an older file still restores, with
// the page-based default; pollMinutes is migrated to seconds by the interval
// helper. Neither key is written back.
const LEGACY_KEYS = ['overlapHours'];

// A complete, normalised record: the defaults, then whatever the source holds.
// The interval goes through the same migration the rest of the extension uses,
// so a record that still carries legacy `pollMinutes` is backed up as the
// seconds it actually means. Values share the save clamps, so a restored record
// can never be outside the ranges the Settings page enforces.
export function normalizeSettingsRecord(settings = {}) {
  const defaults = defaultSettings();
  const source = settings && typeof settings === 'object' ? settings : {};
  const sync = mergeSettingsSection(defaults, 'sync', {
    pollSeconds: intervalSecondsFromSettings(source),
    catchUpPages: source.catchUpPages ?? defaults.catchUpPages,
  });
  return mergeSettingsSection(sync, 'webhook', {
    webhookEnabled: source.webhookEnabled ?? defaults.webhookEnabled,
    webhookUrl: source.webhookUrl ?? defaults.webhookUrl,
    webhookSecret: source.webhookSecret ?? defaults.webhookSecret,
    webhookFormat: source.webhookFormat ?? defaults.webhookFormat,
    webhookIncludeBackfill: source.webhookIncludeBackfill ?? defaults.webhookIncludeBackfill,
    webhookBackfillCount: source.webhookBackfillCount ?? defaults.webhookBackfillCount,
  });
}

export function buildSettingsBackup(settings = {}, now = Date.now()) {
  return {
    schema: BACKUP_SCHEMA,
    exported_at: new Date(now).toISOString(),
    settings: normalizeSettingsRecord(settings),
  };
}

// Parse a downloaded file. Never throws: the caller shows the error and leaves
// storage alone. A file with no recognisable setting is refused rather than
// restored as a record of defaults.
export function parseSettingsBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return { ok: false, error: `That file is not a settings backup: ${e?.message || e}` };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, error: 'That file is not a settings backup.' };
  }
  if (data.schema !== BACKUP_SCHEMA) {
    return { ok: false, error: `Unsupported settings backup version: ${data.schema ?? 'missing'}.` };
  }
  const settings = data.settings;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return { ok: false, error: 'The backup has no settings object.' };
  }
  if (!BACKUP_KEYS.some((key) => key in settings) && !LEGACY_KEYS.some((key) => key in settings)) {
    return { ok: false, error: 'The backup has no recognisable settings.' };
  }
  return {
    ok: true,
    exported_at: typeof data.exported_at === 'string' ? data.exported_at : '',
    settings: normalizeSettingsRecord(settings),
  };
}
