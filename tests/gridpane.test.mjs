import test from 'node:test';
import assert from 'node:assert/strict';
import { NOTIFICATIONS_PATH, notificationsPath, isMaintenanceResponse } from '../lib/gridpane.js';
import { RUNTIME_FILES } from '../scripts/package.mjs';

test('notificationsPath requests page 1 without a query string', () => {
  assert.equal(NOTIFICATIONS_PATH, '/notifications/recent');
  assert.equal(notificationsPath(1), '/notifications/recent');
});

test('notificationsPath pages older alerts with ?page=N', () => {
  assert.equal(notificationsPath(2), '/notifications/recent?page=2');
  assert.equal(notificationsPath(50), '/notifications/recent?page=50');
});

test('notificationsPath rejects anything that is not a positive integer', () => {
  for (const page of [0, -1, 1.5, '1', undefined]) {
    assert.throws(() => notificationsPath(page), RangeError);
  }
});

test('isMaintenanceResponse treats every 503 as maintenance', () => {
  assert.equal(isMaintenanceResponse({ status: 503, ct: 'text/html', body: "<h1>We'll be back soon!</h1>" }), true);
  assert.equal(isMaintenanceResponse({ status: 503, body: '' }), true);
});

test('isMaintenanceResponse recognises the 200 HTML maintenance page', () => {
  assert.equal(isMaintenanceResponse({ status: 200, ct: 'text/html', body: "We'll be back soon!" }), true);
  assert.equal(isMaintenanceResponse({ status: 200, ct: 'text/html; charset=utf-8', body: 'We’ll be back soon!' }), true);
});

test('isMaintenanceResponse leaves JSON responses alone', () => {
  assert.equal(isMaintenanceResponse({ status: 200, ct: 'application/json', body: '{}' }), false);
  assert.equal(isMaintenanceResponse({ status: 200, ct: 'application/json', body: '{"message":"We\'ll be back soon!"}' }), false);
  assert.equal(isMaintenanceResponse({ status: 200, ct: 'Application/JSON', body: '{"message":"We\'ll be back soon!"}' }), false);
});

test('isMaintenanceResponse does not turn login pages into maintenance', () => {
  assert.equal(isMaintenanceResponse({ status: 401, ct: 'text/html', body: '<title>Login</title>' }), false);
  assert.equal(isMaintenanceResponse({ status: 419, ct: 'text/html', body: '<title>Page expired</title>' }), false);
});

test('isMaintenanceResponse tolerates a missing response', () => {
  assert.equal(isMaintenanceResponse({}), false);
  assert.equal(isMaintenanceResponse(), false);
});

test('the package ships lib/gridpane.js', () => {
  assert.ok(RUNTIME_FILES.includes('lib/gridpane.js'));
});
