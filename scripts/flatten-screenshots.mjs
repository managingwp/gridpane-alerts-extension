#!/usr/bin/env node
// Flatten Chrome's alpha channel out of the store screenshots, in place.
//
// Chrome writes every capture as RGBA (colour type 6) even when nothing is
// transparent, and `check-screenshots.mjs` warns about the alpha channel because
// the Chrome Web Store rejects it. This rewrites the file as RGB (colour type 2)
// without resampling a single pixel: an opaque image comes out byte-for-byte
// identical apart from the dropped channel.
//
//   node scripts/flatten-screenshots.mjs store/screenshots
//   node scripts/flatten-screenshots.mjs --dry-run store/screenshots
//   node scripts/flatten-screenshots.mjs --background '#ffffff' shot.png
//
// It deliberately refuses to resize. A capture that is not the size the store
// expects is re-taken at an emulated 1280x800 viewport; padding or stretching it
// to fit would hide the mistake instead of fixing it. Exit 1 means a file still
// needs a person.

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { alphaRange, readPng, toRgb, writePng } from './png.mjs';

const DEFAULT_WIDTH = 1280;
const DEFAULT_HEIGHT = 800;

/* ------------------------------------------------------------------ helpers */

export function parseColour(value) {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value).trim());
  if (!match) throw new Error(`"${value}" is not a colour (use #rrggbb or #rgb)`);
  let hex = match[1];
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
}

export function hexColour({ r, g, b }) {
  return `#${[r, g, b].map((part) => part.toString(16).padStart(2, '0')).join('')}`;
}

// The decision for one image, with no file I/O so it is cheap to test.
export function flattenPng(buffer, options = {}) {
  const width = options.width ?? DEFAULT_WIDTH;
  const height = options.height ?? DEFAULT_HEIGHT;
  const png = readPng(buffer);

  if (png.width !== width || png.height !== height) {
    return {
      status: 'problem',
      reason: `${png.width}x${png.height}, expected ${width}x${height} — re-capture at an emulated ${width}x${height} viewport; this script does not resize`,
    };
  }

  if (png.colorType === 2) return { status: 'ok', reason: 'already RGB' };

  const alpha = alphaRange(png.pixels);
  if (alpha.min < 255 && !options.background) {
    return {
      status: 'problem',
      reason: `has real transparency (alpha ${alpha.min}); pass --background '#rrggbb' to flatten it deliberately`,
    };
  }

  const data = writePng({
    width: png.width,
    height: png.height,
    colorType: 2,
    pixels: toRgb(png.pixels, options.background),
    ancillary: png.ancillary,
  });

  const reason = alpha.min < 255 ? `RGBA → RGB, flattened onto ${hexColour(options.background)}` : 'RGBA → RGB';
  return { status: 'fixed', reason, data };
}

function expand(paths) {
  const files = [];
  const warnings = [];
  for (const path of paths) {
    const absolute = resolve(path);
    if (!existsSync(absolute)) {
      files.push({ path, error: 'no such file or directory' });
      continue;
    }
    if (statSync(absolute).isDirectory()) {
      const pngs = readdirSync(absolute).filter((name) => name.toLowerCase().endsWith('.png')).sort();
      if (!pngs.length) files.push({ path, error: 'no PNG files in this directory' });
      for (const name of pngs) {
        if (/\.png\.png$/i.test(name)) {
          warnings.push(`${join(path, name)}: doubled extension (.png.png) — store/screenshots/README.md expects ${name.slice(0, -4)}`);
        }
        files.push({ path: join(path, name), absolute: join(absolute, name) });
      }
    } else {
      files.push({ path, absolute });
    }
  }
  return { files, warnings };
}

/* --------------------------------------------------------------------- main */

function parseArgs(argv) {
  const options = { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT, dryRun: false, background: null, paths: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run' || arg === '-n') options.dryRun = true;
    else if (arg === '--width') {
      options.width = Number(argv[++i]);
      if (!Number.isInteger(options.width) || options.width <= 0) throw new Error('--width needs a positive integer');
    } else if (arg === '--height') {
      options.height = Number(argv[++i]);
      if (!Number.isInteger(options.height) || options.height <= 0) throw new Error('--height needs a positive integer');
    } else if (arg === '--background') {
      const value = argv[++i];
      if (!value) throw new Error("--background needs a colour such as '#ffffff'");
      options.background = parseColour(value);
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg.startsWith('-')) {
      throw new Error(`unknown option: ${arg}`);
    } else {
      options.paths.push(arg);
    }
  }
  if (!options.help && !options.paths.length) throw new Error('give at least one PNG path or directory');
  return options;
}

function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`flatten-screenshots: ${error.message}`);
    return 2;
  }

  if (options.help) {
    console.log('usage: node scripts/flatten-screenshots.mjs [--dry-run] [--background <#rrggbb>] [--width 1280] [--height 800] <path|dir>...');
    return 0;
  }

  const { files, warnings } = expand(options.paths);
  const problems = [];
  let fixed = 0;

  for (const file of files) {
    if (file.error) {
      problems.push(`${file.path}: ${file.error}`);
      continue;
    }

    let result;
    try {
      result = flattenPng(readFileSync(file.absolute), options);
    } catch (error) {
      problems.push(`${file.path}: ${error.message}`);
      continue;
    }

    if (result.status === 'problem') {
      problems.push(`${file.path}: ${result.reason}`);
      continue;
    }
    if (result.status === 'ok') {
      console.log(`ok: ${file.path} (${result.reason})`);
      continue;
    }

    if (!options.dryRun) writeFileSync(file.absolute, result.data);
    fixed++;
    console.log(`${options.dryRun ? 'would fix' : 'fixed'}: ${file.path} (${result.reason})`);
  }

  for (const warning of warnings) console.log(`warning: ${warning}`);
  for (const problem of problems) console.error(`problem: ${problem}`);
  console.log(`${files.length} file(s), ${fixed} ${options.dryRun ? 'fixable' : 'fixed'}, ${problems.length} problem(s)`);

  return problems.length ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  process.exitCode = main(process.argv.slice(2));
}
