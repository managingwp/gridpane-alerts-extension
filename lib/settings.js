// Pure Settings merges. The Settings page saves one card at a time, so saving
// Sync must never write a stale Webhook field (and the reverse), and a card's
// save must not clobber the other card's stored values. No chrome.* or DOM
// imports, so Node can test the merges without an extension runtime.

import { MAX_OVERLAP_HOURS, MIN_OVERLAP_HOURS, DEFAULT_OVERLAP_HOURS } from './scan.js';
import { DEFAULT_BACKFILL_COUNT, clampBackfillCount } from './webhook.js';

export const WEBHOOK_FORMATS = ['full', 'chat', 'slack'];

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

// Merge one Settings card's patch into the stored object. `sync` and `webhook`
// touch disjoint keys; any other section is a no-op that keeps the record.
export function mergeSettingsSection(current = {}, section, patch = {}) {
  if (section === 'sync') {
    const next = {
      ...current,
      pollSeconds: patch.pollSeconds,
      overlapHours: clampOverlapHours(patch.overlapHours),
    };
    // The interval is stored only as seconds now; a legacy pollMinutes must not
    // survive a save, or a later read could prefer the stale value.
    delete next.pollMinutes;
    return next;
  }
  if (section === 'webhook') {
    return {
      ...current,
      webhookEnabled: !!patch.webhookEnabled,
      webhookUrl: String(patch.webhookUrl ?? '').trim(),
      webhookSecret: String(patch.webhookSecret ?? ''),
      webhookFormat: WEBHOOK_FORMATS.includes(patch.webhookFormat) ? patch.webhookFormat : 'full',
      webhookIncludeBackfill: !!patch.webhookIncludeBackfill,
      webhookBackfillCount: clampBackfillCount(patch.webhookBackfillCount, DEFAULT_BACKFILL_COUNT),
    };
  }
  return { ...current };
}
