#!/usr/bin/env node
// Minimal PNG codec for the store kit.
//
// Chrome writes every capture as 8-bit RGBA (colour type 6) even when nothing is
// transparent, and the Chrome Web Store rejects an alpha channel. Rewriting the
// image as RGB (colour type 2) needs an inflate, an unfilter and a deflate — not
// a toolchain — so this stays on node:zlib like the rest of scripts/, and the
// store kit keeps working without ImageMagick or a Python/PIL install.
//
// Only what the screenshots need is supported: 8-bit RGB and RGBA, not
// interlaced. Anything else is refused with a named error rather than guessed
// at.

import { deflateSync, inflateSync } from 'node:zlib';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// Bytes per pixel for the two colour types this codec understands.
const CHANNELS = { 2: 3, 6: 4 };

// Chunks that describe the old colour type or palette. They cannot survive a
// change of channel count, so they are dropped; every other ancillary chunk
// (sRGB, gAMA, pHYs, tEXt, ...) is carried across the rewrite.
const COLOUR_DEPENDENT = new Set(['PLTE', 'tRNS', 'bKGD', 'hIST', 'sBIT']);

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/* ------------------------------------------------------------------- chunks */

export function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) crc = CRC_TABLE[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'latin1');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, data.length + 8)), data.length + 8);
  return out;
}

function readHeader(data) {
  if (data.length !== 13) throw new Error('IHDR is not 13 bytes');
  const header = {
    width: data.readUInt32BE(0),
    height: data.readUInt32BE(4),
    bitDepth: data[8],
    colorType: data[9],
    interlace: data[12],
  };
  if (header.width <= 0 || header.height <= 0) throw new Error('IHDR declares an empty image');
  if (header.bitDepth !== 8) {
    throw new Error(`bit depth ${header.bitDepth} is not supported (8 only)`);
  }
  if (!CHANNELS[header.colorType]) {
    throw new Error(`colour type ${header.colorType} is not supported (2 = RGB, 6 = RGBA)`);
  }
  if (header.interlace !== 0) throw new Error('interlaced PNGs are not supported');
  return header;
}

/* ------------------------------------------------------------------ filters */

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

// Undo the per-row filter byte, in place per row, back to raw pixel bytes.
function unfilter(raw, width, height, bpp) {
  const rowBytes = width * bpp;
  const stride = rowBytes + 1;
  const pixels = Buffer.alloc(rowBytes * height);

  for (let y = 0; y < height; y++) {
    const filter = raw[y * stride];
    const line = raw.subarray(y * stride + 1, (y + 1) * stride);
    const row = pixels.subarray(y * rowBytes, (y + 1) * rowBytes);
    const prev = y === 0 ? Buffer.alloc(rowBytes) : pixels.subarray((y - 1) * rowBytes, y * rowBytes);
    line.copy(row);

    for (let i = 0; i < rowBytes; i++) {
      const a = i >= bpp ? row[i - bpp] : 0;
      const b = prev[i];
      const c = i >= bpp ? prev[i - bpp] : 0;
      switch (filter) {
        case 0:
          break;
        case 1:
          row[i] = (row[i] + a) & 0xff;
          break;
        case 2:
          row[i] = (row[i] + b) & 0xff;
          break;
        case 3:
          row[i] = (row[i] + ((a + b) >> 1)) & 0xff;
          break;
        case 4:
          row[i] = (row[i] + paeth(a, b, c)) & 0xff;
          break;
        default:
          throw new Error(`unknown filter type ${filter} on row ${y}`);
      }
    }
  }

  return pixels;
}

/* --------------------------------------------------------------- read/write */

export function readPng(buffer) {
  if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer);
  if (buffer.length < SIGNATURE.length || !buffer.subarray(0, 8).equals(SIGNATURE)) {
    throw new Error('not a PNG (bad signature)');
  }

  let offset = SIGNATURE.length;
  let header = null;
  const idat = [];
  const ancillary = [];

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString('latin1', offset + 4, offset + 8);
    if (offset + 12 + length > buffer.length) throw new Error(`truncated ${type} chunk`);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    const expected = buffer.readUInt32BE(offset + 8 + length);
    if (crc32(buffer.subarray(offset + 4, offset + 8 + length)) !== expected) {
      throw new Error(`${type} chunk has a bad CRC`);
    }
    offset += 12 + length;

    if (type === 'IHDR') header = readHeader(data);
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    else if (!COLOUR_DEPENDENT.has(type)) ancillary.push({ type, data: Buffer.from(data) });
  }

  if (!header) throw new Error('no IHDR chunk');
  if (!idat.length) throw new Error('no IDAT chunk');

  const bpp = CHANNELS[header.colorType];
  const stride = header.width * bpp + 1;
  const inflated = inflateSync(Buffer.concat(idat));
  if (inflated.length !== stride * header.height) {
    throw new Error(`expected ${stride * header.height} bytes of image data, found ${inflated.length}`);
  }

  return { ...header, ancillary, pixels: unfilter(inflated, header.width, header.height, bpp) };
}

export function writePng({ width, height, colorType, pixels, ancillary = [] }) {
  const bpp = CHANNELS[colorType];
  if (!bpp) throw new Error(`cannot write colour type ${colorType} (2 = RGB, 6 = RGBA)`);
  const rowBytes = width * bpp;
  if (pixels.length !== rowBytes * height) {
    throw new Error(`pixel buffer is ${pixels.length} bytes, expected ${rowBytes * height}`);
  }

  // Filter 0 (None) on every row: the bytes are what we verified, and deflate
  // recovers the size lost to unfiltered rows.
  const raw = Buffer.alloc((rowBytes + 1) * height);
  for (let y = 0; y < height; y++) {
    pixels.copy(raw, y * (rowBytes + 1) + 1, y * rowBytes, (y + 1) * rowBytes);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = colorType;

  const parts = [SIGNATURE, chunk('IHDR', ihdr)];
  for (const entry of ancillary) {
    if (!COLOUR_DEPENDENT.has(entry.type)) parts.push(chunk(entry.type, entry.data));
  }
  // PNG carries a zlib stream (RFC 1950) in IDAT, not a raw deflate stream.
  parts.push(chunk('IDAT', deflateSync(raw, { level: 9 })));
  parts.push(chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}

/* ------------------------------------------------------------------- colour */

export function alphaRange(pixels) {
  if (pixels.length % 4) throw new Error('an RGBA pixel buffer must be a multiple of 4 bytes');
  let min = 255;
  let max = 0;
  for (let i = 3; i < pixels.length; i += 4) {
    const value = pixels[i];
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return { min, max };
}

// Drop the alpha channel, compositing any real transparency onto `background`.
// A fully opaque pixel comes out byte-for-byte unchanged.
export function toRgb(pixels, background = { r: 255, g: 255, b: 255 }) {
  if (pixels.length % 4) throw new Error('an RGBA pixel buffer must be a multiple of 4 bytes');
  const out = Buffer.alloc((pixels.length / 4) * 3);
  for (let i = 0, o = 0; i < pixels.length; i += 4, o += 3) {
    const alpha = pixels[i + 3];
    if (alpha === 255) {
      out[o] = pixels[i];
      out[o + 1] = pixels[i + 1];
      out[o + 2] = pixels[i + 2];
      continue;
    }
    const inverse = 255 - alpha;
    out[o] = Math.round((pixels[i] * alpha + background.r * inverse) / 255);
    out[o + 1] = Math.round((pixels[i + 1] * alpha + background.g * inverse) / 255);
    out[o + 2] = Math.round((pixels[i + 2] * alpha + background.b * inverse) / 255);
  }
  return out;
}
