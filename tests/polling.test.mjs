import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MIN_INTERVAL_SECONDS,
  MAX_INTERVAL_SECONDS,
  DEFAULT_INTERVAL_SECONDS,
  clampIntervalSeconds,
  intervalSecondsFromSettings,
  splitInterval,
  parseIntervalInput,
  usesTimerDocument,
  alarmPeriodMinutes,
  autoBackfillPages,
  shouldLogRun,
} from '../lib/polling.js';

test('clampIntervalSeconds raises a short interval to the floor', () => {
  assert.equal(clampIntervalSeconds(2), MIN_INTERVAL_SECONDS);
  assert.equal(clampIntervalSeconds(0), DEFAULT_INTERVAL_SECONDS);
  assert.equal(clampIntervalSeconds(-30), DEFAULT_INTERVAL_SECONDS);
});

test('clampIntervalSeconds caps a long interval at 24 hours', () => {
  assert.equal(clampIntervalSeconds(90000), MAX_INTERVAL_SECONDS);
  assert.equal(clampIntervalSeconds(86400), 86400);
});

test('clampIntervalSeconds keeps a valid interval and rounds a fraction', () => {
  assert.equal(clampIntervalSeconds(75), 75);
  assert.equal(clampIntervalSeconds(75.6), 76);
  assert.equal(clampIntervalSeconds('45'), 45);
  assert.equal(clampIntervalSeconds('nope'), DEFAULT_INTERVAL_SECONDS);
});

test('intervalSecondsFromSettings prefers pollSeconds', () => {
  assert.equal(intervalSecondsFromSettings({ pollSeconds: 75, pollMinutes: 10 }), 75);
});

test('intervalSecondsFromSettings migrates a legacy pollMinutes', () => {
  assert.equal(intervalSecondsFromSettings({ pollMinutes: 2 }), 120);
  assert.equal(intervalSecondsFromSettings({ pollMinutes: 5 }), 300);
});

test('intervalSecondsFromSettings falls back to the default', () => {
  assert.equal(intervalSecondsFromSettings({}), 300);
  assert.equal(intervalSecondsFromSettings(), 300);
  assert.equal(intervalSecondsFromSettings({ pollSeconds: 0, pollMinutes: 0 }), 300);
});

test('splitInterval returns whole minutes and the remainder seconds', () => {
  assert.deepEqual(splitInterval(75), { minutes: 1, seconds: 15 });
  assert.deepEqual(splitInterval(15), { minutes: 0, seconds: 15 });
  assert.deepEqual(splitInterval(300), { minutes: 5, seconds: 0 });
  assert.deepEqual(splitInterval(86400), { minutes: 1440, seconds: 0 });
});

test('parseIntervalInput joins minutes and seconds', () => {
  assert.deepEqual(parseIntervalInput('1', '15'), { seconds: 75, error: null });
  assert.deepEqual(parseIntervalInput('0', '15'), { seconds: 15, error: null });
  assert.deepEqual(parseIntervalInput('', '15'), { seconds: 15, error: null });
});

test('parseIntervalInput keeps the default when both fields are blank', () => {
  assert.deepEqual(parseIntervalInput('', ''), { seconds: DEFAULT_INTERVAL_SECONDS, error: null });
});

test('parseIntervalInput refuses a total under 15 seconds', () => {
  const result = parseIntervalInput('0', '5');
  assert.equal(result.seconds, MIN_INTERVAL_SECONDS);
  assert.match(result.error, /15 seconds/);
});

test('parseIntervalInput caps a total over 24 hours', () => {
  assert.deepEqual(parseIntervalInput('1440', '59'), { seconds: MAX_INTERVAL_SECONDS, error: null });
});

test('usesTimerDocument switches at one minute', () => {
  assert.equal(usesTimerDocument(15), true);
  assert.equal(usesTimerDocument(59), true);
  assert.equal(usesTimerDocument(60), false);
  assert.equal(usesTimerDocument(75), false);
});

test('alarmPeriodMinutes turns a seconds interval into the alarm period', () => {
  assert.equal(alarmPeriodMinutes(75), 1.25);
  assert.equal(alarmPeriodMinutes(300), 5);
  assert.equal(alarmPeriodMinutes(86400), 1440);
});

test('autoBackfillPages keeps one page per 15 seconds up to the cap', () => {
  assert.equal(autoBackfillPages(15), 1);
  assert.equal(autoBackfillPages(60), 4);
  assert.equal(autoBackfillPages(75), 5);
  assert.equal(autoBackfillPages(300), 20);
  assert.equal(autoBackfillPages(86400), 20);
});

test('shouldLogRun always logs a manual run', () => {
  const now = Date.now();
  assert.equal(shouldLogRun({ trigger: 'manual', status: 'ok', newWalkCount: 0, lastAutoLogAt: now, now }), true);
  assert.equal(shouldLogRun({ trigger: 'manual', status: 'no_tab', newWalkCount: 0, lastAutoLogAt: now, now }), true);
});

test('shouldLogRun never logs an automatic no-tab run', () => {
  assert.equal(shouldLogRun({ trigger: 'auto', status: 'no_tab', newWalkCount: 0, lastAutoLogAt: 0, now: Date.now() }), false);
});

test('shouldLogRun logs an automatic run that stored a new-walk alert', () => {
  const now = Date.now();
  assert.equal(shouldLogRun({ trigger: 'auto', status: 'ok', newWalkCount: 2, lastAutoLogAt: now, now }), true);
});

test('shouldLogRun waits for the five-minute heartbeat after a routine row', () => {
  const now = Date.now();
  const lastAutoLogAt = now - 2 * 60 * 1000;
  assert.equal(shouldLogRun({ trigger: 'auto', status: 'ok', newWalkCount: 0, lastAutoLogAt, now }), false);
  assert.equal(shouldLogRun({ trigger: 'auto', status: 'rate_limited', newWalkCount: 0, lastAutoLogAt, now }), false);
});

test('shouldLogRun logs a routine run once the heartbeat has passed', () => {
  const now = Date.now();
  const lastAutoLogAt = now - 6 * 60 * 1000;
  assert.equal(shouldLogRun({ trigger: 'auto', status: 'ok', newWalkCount: 0, lastAutoLogAt, now }), true);
  assert.equal(shouldLogRun({ trigger: 'auto', status: 'error', newWalkCount: 0, lastAutoLogAt, now }), true);
});

test('shouldLogRun logs when no automatic row has ever been written', () => {
  assert.equal(shouldLogRun({ trigger: 'auto', status: 'ok', newWalkCount: 0, lastAutoLogAt: undefined, now: Date.now() }), true);
});
