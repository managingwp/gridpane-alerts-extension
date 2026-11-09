#!/usr/bin/env node
// Check that the store screenshots are the size the Chrome Web Store accepts,
// and warn about an alpha channel, which the store rejects.
//
//   node scripts/check-screenshots.mjs store/screenshots
//   node scripts/check-screenshots.mjs --width 128 --height 128 icons/icon128.png
//
// Exits 1 on any unreadable file or dimension mismatch.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 800;

function pngHeader(data) {
  if (data.length < 26) return null;
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < signature.length; i++) if (data[i] !== signature[i]) return null;
  if (data.toString('latin1', 12, 16) !== 'IHDR') return null;
  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20),
    bitDepth: data[24],
    colorType: data[25],
  };
}

function expand(paths) {
  const files = [];
  for (const path of paths) {
    const absolute = resolve(path);
    if (!existsSync(absolute)) {
      files.push({ path, error: 'no such file or directory' });
      continue;
    }
    if (statSync(absolute).isDirectory()) {
      const pngs = readdirSync(absolute).filter((name) => name.toLowerCase().endsWith('.png')).sort();
      if (!pngs.length) files.push({ path, error: 'no PNG files in this directory' });
      for (const name of pngs) files.push({ path: join(path, name), absolute: join(absolute, name) });
    } else {
      files.push({ path, absolute });
    }
  }
  return files;
}

function main(argv) {
  let width = DEFAULT_WIDTH;
  let height = DEFAULT_HEIGHT;
  const paths = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--width') {
      width = Number(argv[++i]);
      if (!Number.isInteger(width) || width <= 0) throw new Error('--width needs a positive integer');
    } else if (arg === '--height') {
      height = Number(argv[++i]);
      if (!Number.isInteger(height) || height <= 0) throw new Error('--height needs a positive integer');
    } else if (arg === '--help' || arg === '-h') {
      console.log(`usage: node scripts/check-screenshots.mjs [--width ${DEFAULT_WIDTH}] [--height ${DEFAULT_HEIGHT}] <path|dir>...`);
      return 0;
    } else if (arg.startsWith('-')) {
      throw new Error(`unknown option: ${arg}`);
    } else {
      paths.push(arg);
    }
  }

  if (!paths.length) throw new Error('give at least one PNG path or directory');

  const files = expand(paths);
  const problems = [];
  const warnings = [];

  for (const file of files) {
    if (file.error) {
      problems.push(`${file.path}: ${file.error}`);
      continue;
    }
    const header = pngHeader(readFileSync(file.absolute));
    if (!header) {
      problems.push(`${file.path}: not a readable PNG`);
      continue;
    }
    const note = [];
    if (header.width !== width || header.height !== height) {
      problems.push(`${file.path}: ${header.width}x${header.height}, expected ${width}x${height}`);
    }
    if (header.colorType === 4 || header.colorType === 6) {
      note.push('has an alpha channel — flatten it outside a transparent background, the store rejects alpha');
      warnings.push(`${file.path}: alpha channel`);
    }
    console.log(`${file.path}: ${header.width}x${header.height} color type ${header.colorType}${note.length ? ' (warning)' : ''}`);
  }

  for (const warning of warnings) console.log(`warning: ${warning}`);
  for (const problem of problems) console.error(`problem: ${problem}`);
  console.log(`${files.length} file(s), ${problems.length} problem(s)`);

  return problems.length ? 1 : 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  console.error(`check-screenshots: ${error.message}`);
  process.exitCode = 2;
}
