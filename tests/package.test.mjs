import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  RUNTIME_FILES,
  collectFiles,
  validateManifest,
  assertStoreListing,
  buildZip,
  sha256,
  pngSize,
} from '../scripts/package.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const files = collectFiles(ROOT);
const manifest = JSON.parse(files.find((file) => file.name === 'manifest.json').data.toString('utf8'));

function listingFor(target) {
  const permissions = [
    ...(target.permissions || []),
    ...(target.host_permissions || []),
    ...(target.optional_host_permissions || []),
  ];
  return {
    name: target.name,
    summary: target.description,
    privacyPolicyUrl: 'https://example.test/privacy',
    justifications: Object.fromEntries(permissions.map((permission) => [permission, 'because'])),
  };
}

test('collectFiles returns exactly the runtime allowlist', () => {
  assert.deepEqual(files.map((file) => file.name).sort(), [...RUNTIME_FILES].sort());
});

test('collectFiles refuses a tree that is missing a runtime file', () => {
  const empty = mkdtempSync(join(tmpdir(), 'gp-package-'));
  try {
    assert.throws(() => collectFiles(empty), /missing runtime file: manifest\.json/);
  } finally {
    rmSync(empty, { recursive: true, force: true });
  }
});

test('pngSize reads the declared dimensions', () => {
  const icon = files.find((file) => file.name === 'icons/icon128.png');
  assert.deepEqual(pngSize(icon.data), { width: 128, height: 128 });
  assert.equal(pngSize(Buffer.from('not a png')), null);
});

test('validateManifest accepts the shipped manifest', () => {
  assert.deepEqual(validateManifest(manifest, files), []);
});

test('validateManifest accepts a 132-character description', () => {
  const atLimit = { ...manifest, description: 'x'.repeat(132) };
  assert.deepEqual(validateManifest(atLimit, files), []);
});

test('validateManifest rejects a description over the store limit', () => {
  const overLimit = { ...manifest, description: 'x'.repeat(133) };
  const errors = validateManifest(overLimit, files);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /limit is 132/);
});

test('validateManifest rejects an icon that is not in the package', () => {
  const errors = validateManifest({ ...manifest, icons: { 16: 'icons/icon99.png' } }, files);
  assert.match(errors.join('\n'), /icons\/icon99\.png, which is not in the package/);
});

test('validateManifest rejects an icon whose size disagrees with the manifest', () => {
  const errors = validateManifest({ ...manifest, icons: { 16: 'icons/icon32.png' } }, files);
  assert.match(errors.join('\n'), /32x32; the manifest declares 16x16/);
});

test('validateManifest rejects a key or update_url', () => {
  const errors = validateManifest({ ...manifest, key: 'abc', update_url: 'https://example.test/updates.xml' }, files);
  assert.match(errors.join('\n'), /key must not be shipped/);
  assert.match(errors.join('\n'), /update_url must not be set/);
});

test('buildZip writes manifest.json first and counts every entry', () => {
  const archive = buildZip(files);
  assert.equal(archive.readUInt32LE(0), 0x04034b50);
  const nameLength = archive.readUInt16LE(26);
  assert.equal(archive.toString('utf8', 30, 30 + nameLength), 'manifest.json');
  assert.equal(archive.readUInt16LE(archive.length - 14), files.length);
});

test('buildZip is byte-reproducible', () => {
  const first = buildZip(files);
  const second = buildZip([...files].reverse());
  assert.deepEqual(first, second);
  assert.equal(sha256(first), sha256(second));
});

test('assertStoreListing passes when every permission is justified', () => {
  assert.deepEqual(assertStoreListing(manifest, listingFor(manifest)), []);
});

test('assertStoreListing is skipped when no listing exists', () => {
  assert.deepEqual(assertStoreListing(manifest, null), []);
});

test('assertStoreListing rejects a permission with no justification', () => {
  const listing = listingFor(manifest);
  delete listing.justifications.storage;
  const errors = assertStoreListing(manifest, listing);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /no justification for "storage"/);
});

test('assertStoreListing rejects a justification the manifest never requests', () => {
  const listing = listingFor(manifest);
  listing.justifications.tabs = 'because';
  const errors = assertStoreListing(manifest, listing);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /justifies "tabs"/);
});

test('assertStoreListing rejects a summary that drifts from the manifest', () => {
  const listing = { ...listingFor(manifest), summary: 'a different promise' };
  const errors = assertStoreListing(manifest, listing);
  assert.match(errors.join('\n'), /summary must equal manifest\.json description/);
});
