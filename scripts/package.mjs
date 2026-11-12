#!/usr/bin/env node
// Build the Chrome Web Store / Load unpacked package from the working tree.
//
// The extension has no build step: this script copies an allowlist of runtime
// files into a flat zip whose first entry is manifest.json. It validates the
// manifest before writing, and the archive is byte-reproducible so two builds of
// the same tree compare equal.
//
//   node scripts/package.mjs                 build dist/gridpane-alerts-<version>.zip
//   node scripts/package.mjs --check         validate only, write nothing
//   node scripts/package.mjs --out <dir>     build somewhere else
//   node scripts/package.mjs --no-unpacked   skip dist/unpacked/

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Every file the browser needs, and nothing else. Keep this list flat and
// explicit: anything not named here stays out of the package, including the
// tests, plans, docs and store kit.
export const RUNTIME_FILES = [
  'manifest.json',
  'background.js',
  'db.js',
  'normalize.js',
  'demo.js',
  'lib/scan.js',
  'lib/tabs.js',
  'app.html',
  'app.js',
  'app.css',
  'icons/icon16.png',
  'icons/icon32.png',
  'icons/icon48.png',
  'icons/icon128.png',
];

const ZIP_NAME = 'gridpane-alerts';
const DESCRIPTION_LIMIT = 132;

// A local file marked as a remote entry is a Chrome Web Store rejection; an
// eval is remote code in disguise. Both are cheap to detect at build time.
const SOURCE_PATTERNS = [
  { pattern: /<script[^>]+src\s*=\s*["']https?:/i, label: 'remote <script src>' },
  { pattern: /\beval\s*\(/, label: 'eval(' },
  { pattern: /\bnew\s+Function\s*\(/, label: 'new Function(' },
];

/* ------------------------------------------------------------------ files */

export function collectFiles(root = ROOT) {
  return RUNTIME_FILES.map((name) => {
    const path = join(root, name);
    if (!existsSync(path)) throw new Error(`missing runtime file: ${name}`);
    if (!statSync(path).isFile()) throw new Error(`not a file: ${name}`);
    return { name, data: readFileSync(path) };
  });
}

export function pngSize(data) {
  if (data.length < 24) return null;
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < signature.length; i++) if (data[i] !== signature[i]) return null;
  if (data.toString('latin1', 12, 16) !== 'IHDR') return null;
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

/* -------------------------------------------------------------- validation */

export function validateManifest(manifest, files) {
  const errors = [];
  const byName = new Map(files.map((file) => [file.name, file]));

  if (manifest.manifest_version !== 3) errors.push('manifest_version must be 3');
  if (!manifest.name) errors.push('name is required');
  if (!manifest.version) errors.push('version is required');
  else if (!/^\d+(\.\d+){0,3}$/.test(manifest.version)) {
    errors.push(`version "${manifest.version}" is not 1 to 4 dot-separated integers`);
  }

  const description = manifest.description || '';
  if (!description) errors.push('description is required');
  else if (description.length > DESCRIPTION_LIMIT) {
    errors.push(`description is ${description.length} characters; the Chrome Web Store limit is ${DESCRIPTION_LIMIT}`);
  }

  if (manifest.key) errors.push('key must not be shipped: the store assigns the extension id');
  if (manifest.update_url) errors.push('update_url must not be set for a Chrome Web Store item');
  if (!manifest.icons || !Object.keys(manifest.icons).length) errors.push('icons are required for the store listing');

  for (const [size, path] of Object.entries(manifest.icons || {})) {
    const file = byName.get(path);
    if (!file) {
      errors.push(`icons["${size}"] points at ${path}, which is not in the package`);
      continue;
    }
    const dims = pngSize(file.data);
    if (!dims) {
      errors.push(`${path} is not a readable PNG`);
      continue;
    }
    if (dims.width !== Number(size) || dims.height !== Number(size)) {
      errors.push(`${path} is ${dims.width}x${dims.height}; the manifest declares ${size}x${size}`);
    }
  }

  return errors;
}

export function scanSources(files) {
  const errors = [];
  const text = files.filter((file) => /\.(js|html|css|json)$/.test(file.name));
  for (const file of text) {
    const body = file.data.toString('utf8');
    for (const { pattern, label } of SOURCE_PATTERNS) {
      if (pattern.test(body)) errors.push(`${file.name} contains ${label}`);
    }
  }
  return errors;
}

// A permission with no justification, or a justification with no permission, is
// the difference between an approved item and a rejection email. The store
// listing file is the single copy of that text, so compare it with the manifest.
export function assertStoreListing(manifest, listing) {
  if (!listing) return [];
  const errors = [];

  if (listing.name !== manifest.name) errors.push(`store/listing.json name "${listing.name}" does not match the manifest "${manifest.name}"`);

  const summary = listing.summary || '';
  if (summary.length > DESCRIPTION_LIMIT) errors.push(`store/listing.json summary is ${summary.length} characters; the limit is ${DESCRIPTION_LIMIT}`);
  if (summary !== manifest.description) errors.push('store/listing.json summary must equal manifest.json description');

  const declared = new Set([
    ...(manifest.permissions || []),
    ...(manifest.host_permissions || []),
    ...(manifest.optional_host_permissions || []),
  ]);
  const justified = new Set(Object.keys(listing.justifications || {}));
  for (const permission of declared) {
    if (!justified.has(permission)) errors.push(`no justification for "${permission}" in store/listing.json`);
  }
  for (const permission of justified) {
    if (!declared.has(permission)) errors.push(`store/listing.json justifies "${permission}" but the manifest never requests it`);
  }

  if (!/^https:\/\//.test(listing.privacyPolicyUrl || '')) errors.push('store/listing.json privacyPolicyUrl must be an https URL');

  return errors;
}

/* --------------------------------------------------------------------- zip */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

// 1980-01-01 00:00:00 in MS-DOS time, so every build stamps the same dates.
const DOS_TIME = 0;
const DOS_DATE = 0x0021;

export function buildZip(entries) {
  const files = [...entries].sort((a, b) => {
    if (a.name === 'manifest.json') return -1;
    if (b.name === 'manifest.json') return 1;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const raw = file.data;
    const packed = deflateRawSync(raw, { level: 9 });
    const crc = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(DOS_TIME, 10);
    local.writeUInt16LE(DOS_DATE, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(DOS_TIME, 12);
    central.writeUInt16LE(DOS_DATE, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(packed.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    central.writeUInt32LE(offset, 42);

    locals.push(local, name, packed);
    centrals.push(central, name);
    offset += local.length + name.length + packed.length;
  }

  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, ...centrals, end]);
}

export function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

/* -------------------------------------------------------------------- main */

function parseArgs(argv) {
  const options = { check: false, unpacked: true, out: join(ROOT, 'dist') };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--check') options.check = true;
    else if (arg === '--no-unpacked') options.unpacked = false;
    else if (arg === '--out') {
      const value = argv[++i];
      if (!value) throw new Error('--out needs a directory');
      options.out = resolve(value);
    } else if (arg === '--help' || arg === '-h') options.help = true;
    else throw new Error(`unknown option: ${arg}`);
  }
  return options;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function main(argv) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(`package: ${error.message}`);
    return 2;
  }
  if (options.help) {
    console.log('usage: node scripts/package.mjs [--check] [--out <dir>] [--no-unpacked]');
    return 0;
  }

  let files;
  try {
    files = collectFiles(ROOT);
  } catch (error) {
    console.error(`package: ${error.message}`);
    return 1;
  }

  const manifest = JSON.parse(files.find((file) => file.name === 'manifest.json').data.toString('utf8'));
  const listingPath = join(ROOT, 'store', 'listing.json');
  const listing = existsSync(listingPath) ? readJson(listingPath) : null;

  const errors = [...validateManifest(manifest, files), ...scanSources(files), ...assertStoreListing(manifest, listing)];
  if (!listing) errors.push('store/listing.json is required: it is the source for the store listing copy and the permission justifications');
  if (!existsSync(join(ROOT, 'docs', 'PRIVACY.md'))) errors.push('docs/PRIVACY.md is required: the store privacy policy is published from it');
  if (errors.length) {
    console.error(`package: ${errors.length} problem(s) in the ${manifest.version} package`);
    for (const error of errors) console.error(`  - ${error}`);
    return 1;
  }

  const zipName = `${ZIP_NAME}-${manifest.version}.zip`;

  if (options.check) {
    console.log(`OK: ${files.length} runtime files, manifest ${manifest.name} ${manifest.version}`);
    console.log(`Would write: ${join(options.out, zipName)}`);
    if (listing) console.log(`Store listing: ${Object.keys(listing.justifications || {}).length} justification(s) match the manifest`);
    return 0;
  }

  mkdirSync(options.out, { recursive: true });
  for (const entry of readdirSync(options.out)) {
    if (/^gridpane-alerts-.*\.zip$/.test(entry)) unlinkSync(join(options.out, entry));
  }

  const archive = buildZip(files);
  const zipPath = join(options.out, zipName);
  writeFileSync(zipPath, archive);

  if (options.unpacked) {
    const unpacked = join(options.out, 'unpacked');
    rmSync(unpacked, { recursive: true, force: true });
    for (const file of files) {
      const target = join(unpacked, file.name);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, file.data);
    }
  }

  console.log(`Version:  ${manifest.version}`);
  console.log(`Entries:  ${files.length}`);
  console.log(`Size:     ${archive.length} bytes`);
  console.log(`SHA256:   ${sha256(archive)}`);
  console.log(`Package:  ${zipPath}`);
  if (options.unpacked) console.log(`Unpacked: ${join(options.out, 'unpacked')}`);
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  process.exitCode = main(process.argv.slice(2));
}
