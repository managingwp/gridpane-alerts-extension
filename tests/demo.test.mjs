import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { buildDemo } from '../demo.js';
import { resolve } from '../normalize.js';

const NOW = Date.UTC(2026, 10, 12, 9, 0, 0); // 2026-11-12T09:00:00Z
const demo = buildDemo(NOW);
const ids = new Set(demo.notifications.map((n) => n.id));

test('buildDemo is deterministic for the same moment', () => {
  assert.equal(JSON.stringify(buildDemo(NOW)), JSON.stringify(buildDemo(NOW)));
});

test('buildDemo returns 24 unique, normalized alerts', () => {
  assert.equal(demo.notifications.length, 24);
  assert.equal(ids.size, 24);
  for (const n of demo.notifications) {
    assert.match(n.id, /^demo-\d{3}$/);
    assert.ok(n.title.length > 0);
    assert.ok(n.message.length > 0);
    assert.equal(n.team_id, 1);
    assert.ok(n.raw && n.raw.id === n.id);
  }
});

test('every alert falls inside the three-day window', () => {
  const oldest = NOW / 1000 - 3 * 24 * 3600 - 60;
  for (const n of demo.notifications) {
    assert.ok(n.created_at >= oldest, `${n.id} is older than three days`);
    assert.ok(n.created_at <= NOW / 1000, `${n.id} is in the future`);
    assert.ok(n.first_seen_at / 1000 <= NOW / 1000, `${n.id} was first seen in the future`);
    assert.ok(n.first_seen_at / 1000 >= n.created_at, `${n.id} was first seen before it was created`);
  }
});

test('the fixture covers every severity and a multi-line message', () => {
  const counts = demo.notifications.reduce((all, n) => {
    all[n.severity] = (all[n.severity] || 0) + 1;
    return all;
  }, {});
  assert.ok(counts.error >= 4, `only ${counts.error || 0} error alerts`);
  assert.ok(counts.warning >= 8, `only ${counts.warning || 0} warning alerts`);
  assert.ok(counts.info >= 8, `only ${counts.info || 0} info alerts`);
  assert.ok(demo.notifications.some((n) => n.message.includes('\n')));
});

test('repeated alerts exercise Group similar', () => {
  const disk = demo.notifications.filter((n) => n.title === 'Disk usage > 85%');
  const ssl = demo.notifications.filter((n) => n.title === 'SSL certificate expires in 7 days');
  assert.equal(disk.length, 4);
  assert.ok(disk.every((n) => n.server_id === disk[0].server_id && n.site_id === disk[0].site_id));
  assert.equal(ssl.length, 2);
  assert.ok(ssl.every((n) => n.server_id === ssl[0].server_id && n.site_id === ssl[0].site_id));
});

test('every server and site id resolves to a fictional name', () => {
  for (const n of demo.notifications) {
    const r = resolve(n, demo.lookups);
    if (n.server_id) assert.ok(r.server_label, `${n.id} has no server label`);
    if (n.site_id) assert.ok(r.site_url, `${n.id} has no site URL`);
  }
  assert.equal(Object.keys(demo.lookups.servers).length, 3);
  assert.equal(Object.keys(demo.lookups.sites).length, 4);
});

test('server IPs stay in the TEST-NET ranges', () => {
  const ips = Object.values(demo.lookups.servers).map((s) => s.ip);
  assert.equal(ips.length, 3);
  for (const ip of ips) {
    assert.match(ip, /^(192\.0\.2\.|198\.51\.100\.|203\.0\.113\.)/);
  }
  for (const site of Object.values(demo.lookups.sites)) {
    assert.match(site.url, /(^|\.)example\.com$/);
  }
});

test('the Sync log has nine coherent successful runs', () => {
  assert.equal(demo.synclog.length, 9);
  for (const run of demo.synclog) {
    assert.ok(run.started <= run.finished);
    assert.equal(run.status, 'ok');
    assert.equal(run.error, null);
    assert.ok(run.pages >= 1);
    assert.ok(run.requests >= run.pages);
    assert.ok(run.cursorTo && ids.has(run.cursorTo.id), `${run.started} has an unknown cursorTo`);
    assert.ok(run.cursorFrom && ids.has(run.cursorFrom.id), `${run.started} has an unknown cursorFrom`);
  }
  assert.ok(demo.synclog.some((r) => r.kind === 'history'));
  assert.ok(demo.synclog.some((r) => r.kind === 'sync'));
});

test('the seeded state looks like a recent successful sync', () => {
  assert.equal(demo.state.status, 'ok');
  assert.equal(demo.state.backfill.done, true);
  assert.equal(demo.state.cursor.id, demo.notifications[0].id);
  assert.equal(demo.state.cursor.created_at, demo.notifications[0].created_at);
  assert.ok(demo.state.lastSync < NOW);
  assert.ok(demo.state.lastSync > NOW - 10 * 60 * 1000);
  assert.equal(demo.state.unseen, 3);
});

test('the seeded settings use a fictional webhook and the Slack format', () => {
  assert.equal(demo.settings.pollMinutes, 5);
  assert.equal(demo.settings.overlapHours, 2);
  assert.equal(demo.settings.webhookEnabled, true);
  assert.equal(demo.settings.webhookFormat, 'slack');
  assert.match(demo.settings.webhookUrl, /^https:\/\/hooks\.example\.com\//);
  assert.equal(demo.settings.webhookSecret, '');
});

test('demo.js stays free of browser globals', () => {
  const source = readFileSync(new URL('../demo.js', import.meta.url), 'utf8');
  for (const api of ['chrome.runtime', 'chrome.storage', 'indexedDB.open', 'document.getElementById', 'window.location']) {
    assert.equal(source.includes(api), false, `demo.js references ${api}`);
  }
});
