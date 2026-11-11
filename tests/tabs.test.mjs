import test from 'node:test';
import assert from 'node:assert/strict';
import { isGridPaneUrl, pickGridPaneTab } from '../lib/tabs.js';

const TAB = (url, extra = {}) => ({ id: 1, url, discarded: false, ...extra });

test('isGridPaneUrl accepts the root URL with a trailing slash', () => {
  assert.equal(isGridPaneUrl('https://my.gridpane.com/'), true);
});

test('isGridPaneUrl accepts the root URL without a trailing slash', () => {
  assert.equal(isGridPaneUrl('https://my.gridpane.com'), true);
});

test('isGridPaneUrl accepts a deep path', () => {
  assert.equal(isGridPaneUrl('https://my.gridpane.com/servers/12/sites'), true);
});

test('isGridPaneUrl accepts a query string', () => {
  assert.equal(isGridPaneUrl('https://my.gridpane.com/?page=2'), true);
});

test('isGridPaneUrl accepts a hash', () => {
  assert.equal(isGridPaneUrl('https://my.gridpane.com/notifications#top'), true);
});

test('isGridPaneUrl accepts a mixed-case host', () => {
  assert.equal(isGridPaneUrl('https://My.GridPane.COM/servers'), true);
});

test('isGridPaneUrl rejects plain http', () => {
  assert.equal(isGridPaneUrl('http://my.gridpane.com/'), false);
});

test('isGridPaneUrl rejects a subdomain', () => {
  assert.equal(isGridPaneUrl('https://app.my.gridpane.com/'), false);
});

test('isGridPaneUrl rejects a lookalike host', () => {
  assert.equal(isGridPaneUrl('https://notmy.gridpane.com/'), false);
  assert.equal(isGridPaneUrl('https://my.gridpane.com.example.net/'), false);
});

test('isGridPaneUrl rejects non-strings, empty and unparseable input', () => {
  assert.equal(isGridPaneUrl(undefined), false);
  assert.equal(isGridPaneUrl(null), false);
  assert.equal(isGridPaneUrl(''), false);
  assert.equal(isGridPaneUrl(42), false);
  assert.equal(isGridPaneUrl('not a url'), false);
});

test('pickGridPaneTab picks the GridPane tab out of a mixed list', () => {
  const gp = TAB('https://my.gridpane.com/servers', { id: 7 });
  const tabs = [TAB('https://example.com/', { id: 3 }), gp, TAB('https://my.gridpane.com/', { id: 9 })];
  assert.equal(pickGridPaneTab(tabs), gp);
});

test('pickGridPaneTab skips a discarded GridPane tab', () => {
  const live = TAB('https://my.gridpane.com/', { id: 4 });
  const tabs = [TAB('https://my.gridpane.com/servers', { id: 2, discarded: true }), live];
  assert.equal(pickGridPaneTab(tabs), live);
});

test('pickGridPaneTab returns null when the only match is discarded', () => {
  assert.equal(pickGridPaneTab([TAB('https://my.gridpane.com/', { discarded: true })]), null);
});

test('pickGridPaneTab returns null when no tab matches', () => {
  assert.equal(pickGridPaneTab([TAB('https://example.com/'), TAB('https://notmy.gridpane.com/')]), null);
  assert.equal(pickGridPaneTab([]), null);
  assert.equal(pickGridPaneTab(undefined), null);
});
