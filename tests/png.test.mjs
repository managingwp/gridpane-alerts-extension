import test from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';

import { alphaRange, crc32, readPng, toRgb, writePng } from '../scripts/png.mjs';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function chunk(type, data) {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'latin1');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, data.length + 8)), data.length + 8);
  return out;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

// Build a PNG by hand so the decoder is exercised against every filter type,
// which writePng never emits.
function buildPng({ width, height, colorType = 6, pixels, filters = [], bitDepth = 8, interlace = 0 }) {
  const bpp = colorType === 6 ? 4 : 3;
  const rowBytes = width * bpp;
  const stride = rowBytes + 1;
  const raw = Buffer.alloc(stride * height);

  for (let y = 0; y < height; y++) {
    const filter = filters[y] ?? 0;
    raw[y * stride] = filter;
    for (let i = 0; i < rowBytes; i++) {
      const a = i >= bpp ? pixels[y * rowBytes + i - bpp] : 0;
      const b = y === 0 ? 0 : pixels[(y - 1) * rowBytes + i];
      const c = i >= bpp && y > 0 ? pixels[(y - 1) * rowBytes + i - bpp] : 0;
      let predictor = 0;
      if (filter === 1) predictor = a;
      else if (filter === 2) predictor = b;
      else if (filter === 3) predictor = (a + b) >> 1;
      else if (filter === 4) predictor = paeth(a, b, c);
      raw[y * stride + 1 + i] = (pixels[y * rowBytes + i] - predictor) & 0xff;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = bitDepth;
  ihdr[9] = colorType;
  ihdr[12] = interlace;

  return Buffer.concat([SIGNATURE, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

test('crc32 matches the standard check value', () => {
  assert.equal(crc32(Buffer.from('123456789')), 0xcbf43926);
});

test('writePng and readPng round-trip RGBA pixels unchanged', () => {
  const width = 3;
  const height = 2;
  const pixels = Buffer.from([
    1, 2, 3, 255, 4, 5, 6, 128, 7, 8, 9, 0,
    10, 11, 12, 255, 13, 14, 15, 64, 16, 17, 18, 255,
  ]);

  const png = readPng(writePng({ width, height, colorType: 6, pixels }));

  assert.equal(png.width, width);
  assert.equal(png.height, height);
  assert.equal(png.colorType, 6);
  assert.equal(png.bitDepth, 8);
  assert.deepEqual(png.pixels, pixels);
});

test('readPng undoes the sub, up, average and paeth filters', () => {
  const width = 3;
  const height = 4;
  const bpp = 4;
  const pixels = Buffer.alloc(width * height * bpp);
  for (let i = 0; i < pixels.length; i++) pixels[i] = (i * 37) & 0xff;

  const png = readPng(buildPng({ width, height, pixels, filters: [1, 2, 3, 4] }));

  assert.deepEqual(png.pixels, pixels);
});

test('readPng refuses formats the store kit cannot rewrite', () => {
  const pixels = Buffer.alloc(2 * 2 * 4, 200);

  assert.throws(() => readPng(buildPng({ width: 2, height: 2, pixels, bitDepth: 16 })), /bit depth 16/);
  assert.throws(() => readPng(buildPng({ width: 2, height: 2, pixels, interlace: 1 })), /interlaced/);
  assert.throws(() => readPng(buildPng({ width: 2, height: 2, pixels: Buffer.alloc(2 * 2 * 3), colorType: 0 })), /colour type 0/);
});

test('readPng refuses bad input instead of guessing', () => {
  assert.throws(() => readPng(Buffer.from('not a png at all')), /bad signature/);

  const png = buildPng({ width: 2, height: 2, pixels: Buffer.alloc(16, 90) });
  png[png.length - 20] ^= 0xff;
  assert.throws(() => readPng(png), /bad CRC|image data/);
});

test('writePng refuses a pixel buffer of the wrong length', () => {
  assert.throws(
    () => writePng({ width: 2, height: 2, colorType: 2, pixels: Buffer.alloc(11) }),
    /expected 12/,
  );
  assert.throws(() => writePng({ width: 2, height: 2, colorType: 0, pixels: Buffer.alloc(12) }), /colour type 0/);
});

test('toRgb drops an opaque alpha channel byte for byte', () => {
  const pixels = Buffer.from([10, 20, 30, 255, 40, 50, 60, 255]);
  assert.deepEqual(toRgb(pixels), Buffer.from([10, 20, 30, 40, 50, 60]));
});

test('toRgb composites real transparency onto the background', () => {
  const half = Buffer.from([0, 0, 0, 128]);
  assert.deepEqual(toRgb(half, { r: 255, g: 255, b: 255 }), Buffer.from([127, 127, 127]));
  assert.deepEqual(toRgb(half, { r: 0, g: 0, b: 0 }), Buffer.from([0, 0, 0]));
  assert.throws(() => toRgb(Buffer.alloc(3)), /multiple of 4/);
});

test('alphaRange reports whether a capture is really transparent', () => {
  assert.deepEqual(alphaRange(Buffer.from([1, 2, 3, 255, 4, 5, 6, 255])), { min: 255, max: 255 });
  assert.deepEqual(alphaRange(Buffer.from([1, 2, 3, 255, 4, 5, 6, 0])), { min: 0, max: 255 });
  assert.throws(() => alphaRange(Buffer.alloc(6)), /multiple of 4/);
});
