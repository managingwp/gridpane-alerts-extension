import test from 'node:test';
import assert from 'node:assert/strict';
import { webhookPayload, escapeSlack, truncate, slackColor } from '../normalize.js';

const REC = (extra = {}) => ({
  id: 'alert-1',
  created_at: 1793900000,
  title: 'FILESYSTEM Capacity Warning > 90%',
  message: 'Disk is <full> & needs attention\nSecond line',
  severity: 'warning',
  icon: 'fa-warning',
  server_id: 1,
  site_id: 2,
  team_id: 1,
  creator_name: 'A & B',
  creator_email: 'a@example.com',
  read: false,
  action_url: '',
  ...extra,
});

const LOOKUPS = {
  servers: { 1: { label: 'web1', ip: '203.0.113.10' } },
  sites: { 2: { url: 'https://example.com' } },
};

const blocks = (p) => p.attachments[0].blocks;
const headerText = (p) => blocks(p).find((b) => b.type === 'header').text.text;
const messageText = (p) => blocks(p).find((b) => b.type === 'section' && b.text)?.text.text;
const fields = (p) => blocks(p).find((b) => b.type === 'section' && b.fields)?.fields || [];

test('webhookPayload keeps the full-JSON shape and event', () => {
  const p = webhookPayload(REC(), LOOKUPS, 'full');
  assert.equal(p.event, 'gridpane.notification');
  assert.equal(p.notification.id, 'alert-1');
  assert.equal(p.notification.server.label, 'web1');
  assert.equal(p.notification.site.url, 'https://example.com');
  assert.match(p.text, /^\[WARNING\]/);
});

test('webhookPayload keeps the chat shape and its 1990-character cap', () => {
  const p = webhookPayload(REC(), LOOKUPS, 'chat');
  assert.deepEqual(Object.keys(p), ['text', 'content']);
  assert.equal(p.content, p.text);
  const long = webhookPayload(REC({ message: 'x'.repeat(5000) }), LOOKUPS, 'chat');
  assert.equal(long.content.length, 1990);
});

test('webhookPayload returns one Slack attachment with a Block Kit card', () => {
  const p = webhookPayload(REC(), LOOKUPS, 'slack');
  assert.equal(Array.isArray(p), false);
  assert.equal(p.event, undefined);
  assert.equal(p.notification, undefined);
  assert.equal(typeof p.text, 'string');
  assert.equal(p.attachments.length, 1);
  assert.equal(p.attachments[0].color, '#d97706');
  assert.deepEqual(blocks(p).map((b) => b.type), ['header', 'section', 'section', 'context']);
});

test('slackColor maps each severity and falls back to info', () => {
  assert.equal(slackColor('error'), '#dc2626');
  assert.equal(slackColor('warning'), '#d97706');
  assert.equal(slackColor('info'), '#2563eb');
  assert.equal(slackColor('other'), '#2563eb');
  assert.equal(slackColor(undefined), '#2563eb');
});

test('the Slack header carries a severity emoji', () => {
  assert.match(headerText(webhookPayload(REC({ severity: 'error' }), LOOKUPS, 'slack')), /^:rotating_light:/);
  assert.match(headerText(webhookPayload(REC({ severity: 'warning' }), LOOKUPS, 'slack')), /^:warning:/);
  assert.match(headerText(webhookPayload(REC({ severity: 'info' }), LOOKUPS, 'slack')), /^:information_source:/);
});

test('Slack fields carry severity, server, site and the created time', () => {
  const p = webhookPayload(REC(), LOOKUPS, 'slack');
  const text = fields(p).map((f) => f.text).join('\n');
  assert.match(text, /\*Severity\*/);
  assert.match(text, /web1 \(203\.0\.113\.10\)/);
  assert.match(text, /https:\/\/example\.com/);
  assert.match(text, /\*Created\*/);
});

test('Slack omits unknown server and site fields but keeps Created', () => {
  const p = webhookPayload(REC({ server_id: null, site_id: null }), {}, 'slack');
  const text = fields(p).map((f) => f.text).join('\n');
  assert.match(text, /\*Severity\*/);
  assert.doesNotMatch(text, /\*Server\*/);
  assert.doesNotMatch(text, /\*Site\*/);
  assert.match(text, /\*Created\*/);
});

test('Slack escapes &, < and > in the fallback, header and message', () => {
  const p = webhookPayload(REC(), LOOKUPS, 'slack');
  assert.match(p.text, /&lt;full&gt;/);
  assert.match(p.text, /&amp;/);
  assert.doesNotMatch(headerText(p), /[<>]/);
  assert.doesNotMatch(messageText(p), /[<>]/);
  assert.match(messageText(p), /&lt;full&gt;/);
});

test('escapeSlack replaces the Slack control characters', () => {
  assert.equal(escapeSlack('a & b <c>'), 'a &amp; b &lt;c&gt;');
  assert.equal(escapeSlack(undefined), '');
});

test('truncate only shortens past the limit and marks the cut', () => {
  assert.equal(truncate('short', 10), 'short');
  assert.equal(truncate('1234567890', 10), '1234567890');
  assert.equal(truncate('12345678901', 10), '123456789…');
  assert.equal(truncate('abcdef', 1), '…');
});

test('Slack truncates a long message to the section limit', () => {
  const p = webhookPayload(REC({ message: 'x'.repeat(10000) }), LOOKUPS, 'slack');
  assert.equal(messageText(p).length, 3000);
  assert.ok(messageText(p).endsWith('…'));
});

test('Slack truncates a long title to the header limit', () => {
  const p = webhookPayload(REC({ title: 'T'.repeat(300) }), LOOKUPS, 'slack');
  assert.equal(headerText(p).length, 150);
  assert.ok(headerText(p).endsWith('…'));
});

test('Slack omits the message section for an empty message', () => {
  const p = webhookPayload(REC({ message: '' }), LOOKUPS, 'slack');
  assert.equal(messageText(p), undefined);
  assert.ok(blocks(p).some((b) => b.type === 'header'));
});

test('an unknown format falls back to full JSON', () => {
  const p = webhookPayload(REC(), LOOKUPS, 'nope');
  assert.equal(p.event, 'gridpane.notification');
  assert.equal(p.attachments, undefined);
});
