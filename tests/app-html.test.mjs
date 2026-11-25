import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(resolve(ROOT, 'app.html'), 'utf8');

function ids() {
  return [...html.matchAll(/\bid\s*=\s*["']([^"']+)["']/g)].map((match) => match[1]);
}

test('app.html has no duplicate element ids', () => {
  const seen = new Set();
  const duplicates = new Set();
  for (const id of ids()) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }
  assert.deepEqual([...duplicates], []);
});

test('the sync save button starts disabled until settings are painted', () => {
  const button = html.match(/<button[^>]*\bid\s*=\s*["']sSaveSync["'][^>]*>/);
  assert.ok(button, 'app.html has no sync save button');
  assert.match(button[0], /\bdisabled\b/);
});
