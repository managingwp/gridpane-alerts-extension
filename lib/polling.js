// Pure decisions about how often the extension checks GridPane. No chrome.*,
// db.js or normalize.js imports, so Node can test the cadence rules without an
// extension runtime.

export const MIN_INTERVAL_SECONDS = 15;
export const MAX_INTERVAL_SECONDS = 86400; // 24 hours
export const DEFAULT_INTERVAL_SECONDS = 300; // five minutes
export const TIMER_INTERVAL_LIMIT_SECONDS = 60;
export const AUTO_BACKFILL_CAP = 20;
export const LOG_HEARTBEAT_MS = 5 * 60 * 1000;

// A check interval is one integer in seconds. A missing or invalid value keeps
// the five-minute default, and the range is bounded so a typo cannot turn one
// check into a request loop or a once-a-year check.
export function clampIntervalSeconds(value, fallback = DEFAULT_INTERVAL_SECONDS) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(MAX_INTERVAL_SECONDS, Math.max(MIN_INTERVAL_SECONDS, Math.round(n)));
}

// Settings written before intervals had seconds only carry pollMinutes. Read
// pollSeconds first, then migrate the old value, then fall back to the default.
export function intervalSecondsFromSettings(settings = {}) {
  const total = Number(settings?.pollSeconds);
  if (Number.isFinite(total) && total > 0) return clampIntervalSeconds(total);
  const minutes = Number(settings?.pollMinutes);
  if (Number.isFinite(minutes) && minutes > 0) return clampIntervalSeconds(minutes * 60);
  return DEFAULT_INTERVAL_SECONDS;
}

export function splitInterval(seconds) {
  const total = clampIntervalSeconds(seconds);
  return { minutes: Math.floor(total / 60), seconds: total % 60 };
}

// The minutes and seconds inputs hold non-negative integers; two blank fields
// mean "keep the default". A total below the floor is refused with a message
// instead of clamped, so the user sees why the save did nothing.
export function parseIntervalInput(minutes, seconds) {
  const m = Math.max(0, Math.floor(Number(minutes) || 0));
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  if (m === 0 && s === 0) return { seconds: DEFAULT_INTERVAL_SECONDS, error: null };
  const total = m * 60 + s;
  if (total < MIN_INTERVAL_SECONDS) {
    return { seconds: MIN_INTERVAL_SECONDS, error: 'The shortest interval is 15 seconds.' };
  }
  return { seconds: Math.min(MAX_INTERVAL_SECONDS, total), error: null };
}

// Chrome alarms cannot repeat faster than every 30 seconds in a published
// extension, so anything under a minute is timed by the offscreen document.
export function usesTimerDocument(seconds) {
  return clampIntervalSeconds(seconds) < TIMER_INTERVAL_LIMIT_SECONDS;
}

export function alarmPeriodMinutes(seconds) {
  return clampIntervalSeconds(seconds) / 60;
}

// Keep the historical backfill pace of one page per 15 seconds at any interval,
// so a 15-second check reads one older page instead of twenty.
export function autoBackfillPages(seconds) {
  const total = clampIntervalSeconds(seconds);
  return Math.min(AUTO_BACKFILL_CAP, Math.max(1, Math.round(total / 15)));
}

// An automatic run writes a Sync log row when it stored a new alert, or when no
// automatic row was written in the last five minutes. Manual runs always log and
// an automatic no-tab run never does, so a short interval cannot fill the log.
export function shouldLogRun({ trigger, status, newWalkCount, lastAutoLogAt, now, heartbeatMs = LOG_HEARTBEAT_MS } = {}) {
  if (trigger === 'manual') return true;
  if (status === 'no_tab') return false;
  if (Number(newWalkCount) > 0) return true;
  return Number(now) - (Number(lastAutoLogAt) || 0) >= heartbeatMs;
}
