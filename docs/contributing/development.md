---
title: Development
description: Run the tests, validate the package and understand the runtime-file allowlist; there is no build step.
---

There is no build step. `scripts/package.mjs` copies the runtime files into a flat zip with `manifest.json` at the root, validates the manifest (version format, 132-character description, icon sizes, no `key`/`update_url`, no remote code), and prints the archive's sha256. `dist/` is ignored by git.

```bash
node --test
node scripts/package.mjs          # dist/gridpane-alerts-<version>.zip and dist/unpacked/
node scripts/package.mjs --check  # validate only, write nothing
```

## Runtime files

`scripts/package.mjs` ships a whitelist. A new runtime module has to be added to `RUNTIME_FILES`; documentation, the `website/` tree, `tests/` and `store/` are never packaged. `node scripts/package.mjs --check` fails when the manifest and the store listing disagree about a permission.

## Tests

`node --test` runs the pure helpers (`lib/scan.js`, `lib/tabs.js`, the Slack payload, the packager) and the manifest checks. Chrome APIs are not exercised; the UI and sync checks are manual and tracked in `plans/todos.md`.

## Code map

| File | Owns |
|---|---|
| `background.js` | service worker: sync, backfill, gap audit, lookups, webhook delivery, outbox |
| `app.html`, `app.js`, `app.css` | archive page, Settings, Sync log |
| `db.js` | IndexedDB `gp-alerts` (notifications, outbox, kv, synclog) |
| `normalize.js` | alert normalisation and webhook/Slack payloads |
| `lib/scan.js`, `lib/tabs.js` | pure cursor/backfill helpers and the GridPane tab checks |
| `scripts/package.mjs` | packaging and manifest/store validation |
