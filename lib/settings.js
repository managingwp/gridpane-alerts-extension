// Pure Settings merges. The Settings page saves one card at a time, and only
// the fields the user changed: saving Sync must never write a stale Webhook
// field (and the reverse), and a save must never write a default over a stored
// value the form did not actually change. No chrome.* or DOM imports, so Node
// can test the merges and diffs without an extension runtime.

import { MAX_OVERLAP_HOURS, MIN_OVERLAP_HOURS, DEFAULT_OVERLAP_HOURS } from './scan.js';
import { clampIntervalSeconds, DEFAULT_INTERVAL_SECONDS } from './polling.js';
import { DEFAULT_BACKFILL_COUNT, clampBackfillCount } from './webhook.js';

export const WEBHOOK_FORMATS = ['full', 'chat', 'slack'];

const SYNC_KEYS = ['pollSeconds', 'overlapHours'];
const WEBHOOK_KEYS = [
  'webhookEnabled', 'webhookUrl', 'webhookSecret',
  'webhookFormat', 'webhookIncludeBackfill', 'webhookBackfillCount',
];

// The keys each card owns, in one place for the save, the diff and the backup.
export const SETTINGS_SECTION_KEYS = { sync: SYNC_KEYS, webhook: WEBHOOK_KEYS };

// The record a fresh install reads before anything is saved.
export function defaultSettings() {
  return {
    pollSeconds: DEFAULT_INTERVAL_SECONDS,
    overlapHours: DEFAULT_OVERLAP_HOURS,
    webhookEnabled: false,
    webhookUrl: '',
    webhookSecret: '',
    webhookFormat: 'full',
    webhookIncludeBackfill: false,
    webhookBackfillCount: DEFAULT_BACKFILL_COUNT,
  };
}

// The catch-up overlap is hours, bounded so a typo cannot ask for a year of
// pages or a zero-length window. A blank or non-numeric value keeps the default;
// a number, including zero or a negative, is clamped into the supported range.
export function clampOverlapHours(value, fallback = DEFAULT_OVERLAP_HOURS) {
  if (value === '' || value == null) return fallback;
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_OVERLAP_HOURS, Math.max(MIN_OVERLAP_HOURS, n));
}

// The Backfill button and its disabled state share this rule, so a whitespace
// URL never counts as ready and the two places cannot drift.
export function webhookReady(settings = {}) {
  return !!(settings.webhookEnabled && String(settings.webhookUrl || '').trim());
}

// Normalise only the keys a patch actually carries. A missing key stays missing,
// so a merge can never invent a value for a field the form did not supply.
export function normalizeSettingsSection(section, values = {}) {
  if (section === 'sync') {
    const out = {};
    if ('pollSeconds' in values) out.pollSeconds = clampIntervalSeconds(values.pollSeconds);
    if ('overlapHours' in values) out.overlapHours = clampOverlapHours(values.overlapHours);
    return out;
  }
  if (section === 'webhook') {
    const out = {};
    if ('webhookEnabled' in values) out.webhookEnabled = !!values.webhookEnabled;
    if ('webhookUrl' in values) out.webhookUrl = String(values.webhookUrl ?? '').trim();
    if ('webhookSecret' in values) out.webhookSecret = String(values.webhookSecret ?? '');
    if ('webhookFormat' in values) out.webhookFormat = WEBHOOK_FORMATS.includes(values.webhookFormat) ? values.webhookFormat : 'full';
    if ('webhookIncludeBackfill' in values) out.webhookIncludeBackfill = !!values.webhookIncludeBackfill;
    if ('webhookBackfillCount' in values) out.webhookBackfillCount = clampBackfillCount(values.webhookBackfillCount, DEFAULT_BACKFILL_COUNT);
    return out;
  }
  return {};
}

// Merge one Settings card's patch into the stored object. `sync` and `webhook`
// touch disjoint keys; any other section is a no-op that keeps the record.
export function mergeSettingsSection(current = {}, section, patch = {}) {
  const next = { ...current, ...normalizeSettingsSection(section, patch) };
  if (section === 'sync') {
    // The interval is stored only as seconds now; a legacy pollMinutes must not
    // survive a save, or a later read could prefer the stale value.
    delete next.pollMinutes;
  }
  return next;
}

// Sample data snapshots the real settings so removing the sample can restore
// them. A save made while the sample is loaded must update that snapshot too,
// or the removal would put the older record back over the newer one. Returning
// the same object when nothing changes lets the caller skip the write.
export function mergeDemoSnapshot(demo, patch = {}) {
  if (!demo?.active || !Object.keys(patch).length) return demo;
  return { ...demo, previousSettings: { ...(demo.previousSettings || {}), ...patch } };
}

// The keys whose normalised value differs between the painted card and the form.
// A form field the caller did not supply is ignored, and values that normalise
// the same (a trimmed URL, '30' and 30) are not a change.
export function settingsDiff(painted = {}, values = {}, section) {
  const keys = SETTINGS_SECTION_KEYS[section] || [];
  const before = normalizeSettingsSection(section, painted);
  const after = normalizeSettingsSection(section, values);
  const patch = {};
  for (const key of keys) {
    if (!(key in after)) continue;
    if (!(key in before) || !Object.is(after[key], before[key])) patch[key] = after[key];
  }
  return patch;
}
