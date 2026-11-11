# 20261111-cloudflare-d1-destination

**Version:** 6
**Status:** ⏸ On Hold
**Type:** feature

## Original Prompt

> You should draft all options.
>
> Drafted from the decision record `docs/reference/storage-decisions.md` as option B, the recommended destination. Parked on hold until the storage decision chooses it. Do not execute while any sibling option is chosen instead.

## Plan Contract

- **Mission:** Add an opt-in Cloudflare Worker + D1 archive destination beside the webhook, so new alerts are batched from the extension to an authenticated Worker, stored idempotently in D1, and readable as JSON/SQL by Claude and scripts, while the local archive, webhook and existing export stay unchanged.
- **Execution Size:** large — a pure batching model, a separate deployable Worker with a testable handler and D1 schema, the extension settings/outbox path, documentation, and verification.
- **Session Title:** Cloudflare D1 archive destination
- **Scope:** In scope: `lib/cloud.js` (payload mapping, batching, retry classification) with Node tests; a `worker/` deployable (`src/index.js`, `schema.sql`, `wrangler.toml`, `README.md`) with a testable `handle(request, env)`; a `cloudoutbox` IndexedDB store (DB v3) and a `flushCloud` path in `background.js`; a **Cloud archive** Settings card with URL, token, enable/backfill, Send test and status; the optional host permission for the Worker origin; README, `docs/PRIVACY.md`, `store/description.md` and `store/listing.json`. Out of scope: OAuth or the `identity` permission; changing the webhook outbox, payloads, HMAC headers or retry/backoff; a fixed Cloudflare account id or secret in the repository; the GridPane fetch/backfill logic; a custom domain (a `workers.dev` URL is enough); migrating the existing archive into D1; deleting local data when the remote copy succeeds; a version bump.
- **Success Metrics:** With **Cloud archive** off, `node --test` and `node scripts/package.mjs --check` pass, no request is made to the Worker, and the webhook/local archive behave exactly as before. Saving a Worker URL asks for that one origin through the existing optional-host-permission flow; `manifest.json` gains no permission. A new alert queues one `cloudoutbox` record; a flush posts at most 100 alerts oldest first to `POST /v1/alerts`, and a retry, a service-worker restart or **Send test** inserts no duplicate row because `alerts.id` is the primary key and the Worker uses `INSERT OR IGNORE`. A 401/403 stops the destination and surfaces the error in Settings without touching `state.status`; a 429/5xx schedules the next attempt with the existing backoff. A failing Cloud archive does not delay or duplicate the webhook. `GET /v1/alerts?since=…&limit=…` returns the stored rows as JSON, newest first. The Worker has no committed secret; the extension package still contains exactly its runtime files and no Worker source.
- **Touched paths:** lib/cloud.js, tests/cloud.test.mjs, tests/worker.test.mjs, worker/src/index.js, worker/schema.sql, worker/wrangler.toml, worker/README.md, background.js, db.js, app.html, app.js, README.md, docs/PRIVACY.md, store/description.md, store/listing.json, plans/tests.md, plans/20261111-cloudflare-d1-destination.md
- **Version Target:** release-assigned (git-squash-release)
- **Version Note:** No version bump in this plan; the release helper owns the version.
- **Approach / Architectural Fit:** The extension already has the right delivery shape: an outbox with oldest-first ordering and backoff, a stable per-alert id, and a pure payload adapter. Keep the webhook path untouched and add a second, independent store rather than reshaping the existing outbox: `cloudoutbox` holds `{ id, created_at, attempts, next_at }`, `storeNew` writes one when the destination is enabled, and `flushCloud` posts a batch. `lib/cloud.js` owns the batch size, the record-to-payload mapping and the retry classification, so Node can prove the behaviour without Chrome. The Worker is a separate deployable with no effect on the extension package: `package.mjs` copies only `RUNTIME_FILES`, so `worker/` is never shipped in the zip. `handle(request, env)` takes a fake D1 in tests, which keeps the SQL path testable without `wrangler`. Auth is a bearer token or HMAC, stored as a Worker secret and as an extension setting, the same trust model as the existing webhook secret. `POST /v1/alerts` validates and inserts with `ON CONFLICT(id) DO NOTHING`; `GET /v1/alerts` is the read path. The destination is opt-in and its failures set `lastCloudError`, never `state.status`, so a Cloudflare problem cannot pause GridPane sync.
- **References:** `background.js` (`storeNew`, `syncNew`, `doFlush`, `postWebhook`, `handlers`, `DEFAULTS`), `db.js` (`DB_VERSION`, `putMany`, `getAll`, `kvGet`/`kvSet`), `normalize.js` (`webhookPayload` full notification), `app.html` (Webhook card), `app.js` (`loadSettings`, `saveSettings`, `renderSettingsInfo`), `app.js` optional host permission request, `scripts/package.mjs` (`RUNTIME_FILES`, `collectFiles`), `docs/reference/storage-decisions.md` (option B and the schema sketch), `plans/implemented/20261111-storage-destinations.md` (decision gate), Cloudflare D1/Workers documentation, skills `plan-generation-skill`, `lmt-skills-development-workflow`, `chrome-extensions` and `cloudflare`.

### Assumptions (marked, veto any of these before execution)

- **The Cloudflare account, Worker, D1 database and secret are human setup.** The plan does not create an account, deploy a Worker or invent a token. The extension is usable only after the user supplies the Worker URL and token.
- **A `workers.dev` URL is enough.** No custom domain, route or DNS change is required.
- **Bearer token is the default; HMAC is optional.** The token is stored in `chrome.storage.local` like the webhook secret. The Worker secret is set with `wrangler secret put`, never committed.
- **One table, one row per alert.** `alerts.id` is the idempotency key; `INSERT OR IGNORE` makes a retry harmless. There is no per-destination marker beyond the row itself.
- **At most 100 alerts per request.** A larger backlog takes more than one flush; order stays oldest first.
- **A separate `cloudoutbox` store avoids migrating the webhook outbox.** The two destinations retry independently and a failure in one never blocks the other.
- **The Worker is not packaged with the extension.** `worker/` is a separate deployable; `RUNTIME_FILES` is unchanged except for `lib/cloud.js`.
- **No new manifest permission.** The existing `optional_host_permissions` covers the user-chosen Worker origin; the Save action asks for that one origin.
- **The remote copy is additive.** The local archive remains the source of truth and is never deleted because D1 accepted a row.

## Skills Used

- **Creation:** `plan-generation-skill` (PGF format, contract, testing phase), `lmt-skills-development-workflow` (explicit-path commits, push, secret-scan cadence).
- **Implementation:** `plan-generation-skill`, `lmt-skills-development-workflow`, `chrome-extensions` (MV3 optional host permission, outbox/backoff), `cloudflare` (Workers/D1 selection and limits), Cloudflare Workers and D1 documentation.

## Phases

### Phase 1: Batch model and tests

**Goal:** Put the destination's payload, batch size and retry decisions in a pure module Node can test.

#### Tasks

- [ ] Create `lib/cloud.js` exporting `CLOUD_BATCH_MAX = 100`, `cloudRecord(rec)` (the same full notification object as the webhook's `notification`, plus `sent_at`), `cloudBatches(records, max = CLOUD_BATCH_MAX)` (oldest first, at most `max` per batch, never drops a record) and `cloudRetry(status)` (`401`/`403` → `stop`; `429`/`5xx` → `retry`; `2xx` → `ok`; anything else → `error`).
- [ ] Add `lib/cloud.js` to `RUNTIME_FILES` in `scripts/package.mjs`.
- [ ] Add `tests/cloud.test.mjs` covering: the payload shape and id; batching order and the 100 cap; a batch of 101 records producing two batches; an empty list producing no batches; 401/403/429/500/200 classification; and that the input array is not mutated.
- [ ] **Validation:** `node --test` exits 0; `node scripts/package.mjs --check` exits 0; `test "$(grep -c 'CLOUD_BATCH_MAX' lib/cloud.js)" -ge 1`; `test "$(grep -c 'lib/cloud.js' scripts/package.mjs)" -ge 1`.

### Phase 2: Worker, schema and handler tests

**Goal:** Make the remote side a small, testable service with idempotent ingest and a read endpoint.

#### Tasks

- [ ] Create `worker/schema.sql` with the `alerts` table from the decision record: `id TEXT PRIMARY KEY`, `created_at INTEGER NOT NULL`, `severity TEXT NOT NULL`, `title TEXT NOT NULL`, `message TEXT NOT NULL`, `server_label TEXT`, `server_ip TEXT`, `site_url TEXT`, `team_id INTEGER`, `action_url TEXT`, `received_at INTEGER NOT NULL`, plus indexes on `created_at` and `severity`.
- [ ] Create `worker/src/index.js` exporting `handle(request, env)`: `POST /v1/alerts` verifies `Authorization: Bearer <env.ARCHIVE_TOKEN>`, validates each alert (id, created_at, severity, title), inserts with `INSERT ... ON CONFLICT(id) DO NOTHING`, and returns `{ inserted, skipped }`; `GET /v1/alerts` accepts `since`, `limit`, `severity` and `server`, returns JSON newest first with a documented cap; `GET /v1/health` verifies the token. Reject a missing/incorrect token with 401 and a malformed body with 400.
- [ ] Create `worker/wrangler.toml` with the D1 binding and `worker/README.md` with the human setup (create the database, apply `schema.sql`, `wrangler secret put ARCHIVE_TOKEN`, deploy) and the curl checks. No secret in either file.
- [ ] Add `tests/worker.test.mjs` with a fake D1 that records statements: 401 without a token; 400 for a malformed body; a valid insert; a duplicate id skipped; `GET` filtering by `since`/`severity` and the limit cap; `health`.
- [ ] **Validation:** `node --test` exits 0; `test -f worker/schema.sql`; `test -f worker/wrangler.toml`; `test "$(grep -c 'ON CONFLICT' worker/src/index.js)" -ge 1`; `test "$(grep -c 'ARCHIVE_TOKEN' worker/src/index.js)" -ge 1`; `test -z "$(grep -R 'Bearer [A-Za-z0-9]' worker || true)"`.

### Phase 3: Extension destination and Settings

**Goal:** Send new alerts from the extension without disturbing the webhook, and expose the destination in Settings.

#### Tasks

- [ ] In `db.js`, raise `DB_VERSION` to 3 and create a `cloudoutbox` object store (`keyPath: 'id'`). Do not change the existing `outbox` shape.
- [ ] In `background.js`, add `cloudEnabled: false`, `cloudUrl: ''`, `cloudToken: ''` and `cloudIncludeBackfill: false` to `DEFAULTS`; in `storeNew`, write a `cloudoutbox` record when the destination is enabled and the alert is new; add `flushCloud(force)` that reads due records, builds batches with `cloudBatches`, posts to `${cloudUrl}/v1/alerts` with `Authorization: Bearer ${cloudToken}`, deletes accepted ids, and applies the existing backoff to `429`/`5xx`. A `401`/`403` sets `lastCloudError` and stops the flush; it never sets `state.status`.
- [ ] Call `flushCloud()` after the webhook flush in `startRun`, and add `cloudStatus`, `testCloud` and `flushCloud` handlers. The test alert must not be queued or persisted.
- [ ] In `app.html`, add a **Cloud archive** card: URL, token (password field), **Send new alerts**, **Also send history**, **Send test**, **Retry now**, and a status line. In `app.js`, load/save the four settings, request the Worker origin with `chrome.permissions.request({ origins: [origin + '/*'] })`, render the status, and keep the webhook permission path untouched.
- [ ] Confirm `manifest.json` needs no change: the existing `optional_host_permissions` covers the Worker origin; do not add a fixed Cloudflare host permission.
- [ ] **Validation:** `node --test` exits 0; `node scripts/package.mjs --check` exits 0; `test "$(grep -c 'cloudoutbox' background.js)" -ge 1`; `test "$(grep -c 'flushCloud' background.js)" -ge 1`; `test "$(grep -c 'Cloud archive' app.html)" -ge 1`; `test "$(grep -c 'cloudUrl' app.js)" -ge 1`; `python3 -c "import json,sys; m=json.load(open('manifest.json')); sys.exit(0 if m.get('optional_host_permissions') else 1)"`.

### Phase 4: Documentation, privacy and store text

**Goal:** Explain the setup, the data flow and the failure model without overstating the guarantee.

#### Tasks

- [ ] Update `README.md`: a **Cloud archive** section with the Worker setup summary, the `POST /v1/alerts`/`GET /v1/alerts` shape, the bearer token, the 100-alert batch and the fact that the remote copy is additive.
- [ ] Update `docs/PRIVACY.md`: alert text, server names and IPs, and the alert author's name leave the browser for the user's own Cloudflare account; the extension author operates no intermediary; uninstalling the extension does not delete the remote rows.
- [ ] Update `store/description.md` and `store/listing.json` `dataUse`/`testInstructions` to name the new destination and the optional host permission. Keep the summary within 132 characters and every permission justified.
- [ ] **Validation:** `node --test` exits 0; `node scripts/package.mjs --check` exits 0; `test "$(grep -c 'Cloud archive' README.md)" -ge 1`; `test "$(grep -c 'Cloudflare' README.md)" -ge 1`; `test "$(grep -c 'Cloud archive' docs/PRIVACY.md)" -ge 1`.

### Phase 5: Testing & Verification

**Goal:** Prove the extension, Worker and tests agree, and that the existing webhook path is unchanged.

#### Tasks

- [ ] Run every command in **How to Test** and confirm each exits 0.
- [ ] Record the outcome of each **Manual / UI Checks** step in the closing reply.
- [ ] Record the test outcomes with `pgf test run 20261111-cloudflare-d1-destination`.
- [ ] **Validation:** every command in **How to Test** produces the expected output.

#### How to Test

Prerequisites: Node 22; no build step and no npm dependencies for the extension. The Worker tests use a fake D1; deploying the Worker is a manual check.

```bash
node --test
node scripts/package.mjs --check
test -f worker/schema.sql
test -f worker/wrangler.toml
test "$(grep -c 'CLOUD_BATCH_MAX' lib/cloud.js)" -ge 1
test "$(grep -c 'lib/cloud.js' scripts/package.mjs)" -ge 1
test "$(grep -c 'ON CONFLICT' worker/src/index.js)" -ge 1
test "$(grep -c 'cloudoutbox' background.js)" -ge 1
test "$(grep -c 'flushCloud' background.js)" -ge 1
test "$(grep -c 'Cloud archive' app.html)" -ge 1
node -e "import('./lib/cloud.js').then(({ cloudBatches, cloudRecord, cloudRetry }) => { const rec = { id: 'a', created_at: 1, title: 't', message: 'm', severity: 'info' }; const b = cloudBatches([rec], 100); if (b.length !== 1 || b[0][0].id !== 'a') process.exit(1); if (cloudRetry(401) !== 'stop' || cloudRetry(429) !== 'retry' || cloudRetry(200) !== 'ok') process.exit(1); if (cloudRecord(rec).notification.id !== 'a') process.exit(1); })"
python3 -c "import json,sys; m=json.load(open('manifest.json')); sys.exit(0 if 'identity' not in m.get('permissions',[]) else 1)"
```

Expected: every command exits 0; `node --test` passes all tests including the new cloud and Worker cases; the package check still reports only the runtime files and no `worker/` path; the manifest has no `identity` permission.

#### Manual / UI Checks

1. Create a D1 database, apply `worker/schema.sql`, set `ARCHIVE_TOKEN`, deploy the Worker, and call `GET /v1/health` with the token. Confirm 200 with the token and 401 without it.
2. Load `dist/unpacked/`, open Settings, enter the Worker URL and token, save (grant the host permission), and press **Send test**. Confirm `GET /v1/alerts` shows exactly one test row and a second **Send test** adds no duplicate.
3. Let a new alert arrive, or press **Sync now**, and confirm one batch request in the Worker log and one row per alert in D1. Restart the service worker and press **Retry now**; confirm no duplicate rows.
4. Force a 401 by changing the token, and a 429 by temporarily making the Worker return it. Confirm the Settings status names the error, the webhook still delivers, and `state.status` is not a sync error. Restore the token and confirm the next flush succeeds.
5. Confirm `manifest.json` still has no `identity` permission and the packaged zip contains no `worker/` files.

## Summary

To be completed at close-out: what was asked, what was achieved, files changed, how to test, manual checks, skills used, skill feedback, known issues and commits.
