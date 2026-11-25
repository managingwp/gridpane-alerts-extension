import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readPng, writePng } from '../scripts/png.mjs';
import { flattenPng, hexColour, parseColour } from '../scripts/flatten-screenshots.mjs';

const SCRIPT = resolve(fileURLToPath(new URL('../scripts/flatten-screenshots.mjs', import.meta.url)));

function rgbaPattern(width, height, alpha = 255) {
  const pixels = Buffer.alloc(width * height * 4);
  for (let i = 0; i < pixels.length; i += 4) {
    pixels[i] = (i / 4) & 0xff;
    pixels[i + 1] = (i * 3) & 0xff;
    pixels[i + 2] = (i * 7) & 0xff;
    pixels[i + 3] = alpha;
  }
  return pixels;
}

function run(args) {
  const result = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function workspace(t) {
  const dir = mkdtempSync(join(tmpdir(), 'gp-shots-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/* ------------------------------------------------------------------ colours */

test('parseColour accepts the shapes a person will type', () => {
  assert.deepEqual(parseColour('#ffffff'), { r: 255, g: 255, b: 255 });
  assert.deepEqual(parseColour('fff'), { r: 255, g: 255, b: 255 });
  assert.deepEqual(parseColour('#0000FF'), { r: 0, g: 0, b: 255 });
  assert.equal(hexColour({ r: 0, g: 128, b: 255 }), '#0080ff');
});

test('parseColour refuses anything that is not a colour', () => {
  assert.throws(() => parseColour('white'), /not a colour/);
  assert.throws(() => parseColour('#ffff'), /not a colour/);
});

/* ---------------------------------------------------------------- decisions */

test('flattenPng rewrites an opaque RGBA capture as RGB', () => {
  const width = 4;
  const height = 2;
  const pixels = rgbaPattern(width, height);
  const result = flattenPng(writePng({ width, height, colorType: 6, pixels }), { width, height });

  assert.equal(result.status, 'fixed');
  assert.equal(result.reason, 'RGBA → RGB');

  const round = readPng(result.data);
  assert.equal(round.colorType, 2);
  assert.equal(round.width, width);
  assert.equal(round.height, height);

  const original = readPng(writePng({ width, height, colorType: 6, pixels })).pixels;
  const expected = Buffer.alloc(width * height * 3);
  for (let i = 0, o = 0; i < original.length; i += 4, o += 3) {
    expected[o] = original[i];
    expected[o + 1] = original[i + 1];
    expected[o + 2] = original[i + 2];
  }
  assert.deepEqual(round.pixels, expected);
});

test('flattenPng leaves an RGB file alone', () => {
  const result = flattenPng(writePng({ width: 2, height: 2, colorType: 2, pixels: Buffer.alloc(12, 9) }), { width: 2, height: 2 });
  assert.deepEqual(result, { status: 'ok', reason: 'already RGB' });
});

test('flattenPng refuses to resize a wrong-sized capture', () => {
  const result = flattenPng(writePng({ width: 1200, height: 800, colorType: 6, pixels: rgbaPattern(1200, 800) }));
  assert.equal(result.status, 'problem');
  assert.match(result.reason, /1200x800, expected 1280x800/);
  assert.match(result.reason, /does not resize/);
});

test('flattenPng will not silently flatten real transparency', () => {
  const png = writePng({ width: 2, height: 1, colorType: 6, pixels: Buffer.from([0, 0, 0, 128, 10, 20, 30, 255]) });

  const refused = flattenPng(png, { width: 2, height: 1 });
  assert.equal(refused.status, 'problem');
  assert.match(refused.reason, /real transparency \(alpha 128\)/);

  const flattened = flattenPng(png, { width: 2, height: 1, background: { r: 255, g: 255, b: 255 } });
  assert.equal(flattened.status, 'fixed');
  assert.match(flattened.reason, /flattened onto #ffffff/);
  assert.deepEqual(readPng(flattened.data).pixels, Buffer.from([127, 127, 127, 10, 20, 30]));
});

/* ---------------------------------------------------------------------- cli */

test('the cli fixes a capture in place and leaves the pixels alone', (t) => {
  const dir = workspace(t);
  const file = join(dir, '01-archive.png');
  const pixels = rgbaPattern(8, 4);
  writeFileSync(file, writePng({ width: 8, height: 4, colorType: 6, pixels }));

  const run1 = run(['--width', '8', '--height', '4', dir]);
  assert.equal(run1.status, 0, run1.stderr);
  assert.match(run1.stdout, /fixed: .*01-archive\.png \(RGBA → RGB\)/);
  assert.match(run1.stdout, /1 file\(s\), 1 fixed, 0 problem\(s\)/);

  const fixed = readPng(readFileSync(file));
  assert.equal(fixed.colorType, 2);
  assert.equal(fixed.pixels.length, 8 * 4 * 3);

  const run2 = run(['--width', '8', '--height', '4', dir]);
  assert.equal(run2.status, 0);
  assert.match(run2.stdout, /ok: .*already RGB/);
  assert.match(run2.stdout, /0 fixed/);
});

test('--dry-run reports without touching the file', (t) => {
  const dir = workspace(t);
  const file = join(dir, 'shot.png');
  writeFileSync(file, writePng({ width: 2, height: 2, colorType: 6, pixels: rgbaPattern(2, 2) }));

  const result = run(['--dry-run', '--width', '2', '--height', '2', dir]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /would fix: .*shot\.png/);
  assert.match(result.stdout, /1 file\(s\), 1 fixable, 0 problem\(s\)/);
  assert.equal(readPng(readFileSync(file)).colorType, 6);
});

test('the cli exits 1 on a wrong-sized capture and does not write it', (t) => {
  const dir = workspace(t);
  const file = join(dir, 'wide.png');
  writeFileSync(file, writePng({ width: 1200, height: 800, colorType: 6, pixels: rgbaPattern(1200, 800) }));

  const result = run([dir]);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /problem: .*1200x800, expected 1280x800/);
  assert.equal(readPng(readFileSync(file)).colorType, 6);
});

test('the cli refuses transparency without --background', (t) => {
  const dir = workspace(t);
  const file = join(dir, 'alpha.png');
  writeFileSync(file, writePng({ width: 2, height: 1, colorType: 6, pixels: Buffer.from([9, 9, 9, 10, 9, 9, 9, 255]) }));

  const refused = run(['--width', '2', '--height', '1', dir]);
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /pass --background/);

  const accepted = run(['--width', '2', '--height', '1', '--background', '#000000', dir]);
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.equal(readPng(readFileSync(file)).colorType, 2);
});

test('the cli flags a doubled extension without failing the run', (t) => {
  const dir = workspace(t);
  writeFileSync(join(dir, '01-archive.png.png'), writePng({ width: 2, height: 2, colorType: 2, pixels: Buffer.alloc(12, 1) }));

  const result = run(['--width', '2', '--height', '2', dir]);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /warning: .*doubled extension \(\.png\.png\)/);
});

test('the cli reports an empty directory and bad options', (t) => {
  const dir = workspace(t);

  const empty = run([dir]);
  assert.equal(empty.status, 1);
  assert.match(empty.stderr, /no PNG files in this directory/);

  const usage = run(['--background']);
  assert.equal(usage.status, 2);
  assert.match(usage.stderr, /--background needs a colour/);

  const missing = run([join(dir, 'nope.png')]);
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /no such file or directory/);

  const unknown = run(['--resize', '2x']);
  assert.equal(unknown.status, 2);
  assert.match(unknown.stderr, /unknown option: --resize/);
});
