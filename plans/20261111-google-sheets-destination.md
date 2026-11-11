# 20261111-google-sheets-destination

**Version:** 6
**Status:** ⏸ On Hold
**Type:** feature

## Original Prompt

> You should draft all options.
>
> Drafted from the decision record `docs/reference/storage-decisions.md` as option E. This revives the design in `plans/20261110-google-sheets-destination.md`, which remains abandoned as historical context; the differences are the current Settings/outbox code and the release-assigned version target. Parked on hold until the storage decision chooses it. Do not execute while any sibling option is chosen instead.

## Plan Contract

- **Mission:** Add an opt-in Google Sheets destination that creates a spreadsheet in the user's own Drive and appends every new GridPane alert as one row, retries independently of the webhook, never appends a row that was already appended, and keeps the existing webhook and local archive unchanged.
- **Execution Size:** large — pure sheet/outbox models, OAuth and sheet creation, outbox delivery, documentation, and verification.
- **Session Title:** Google Sheets archive destination
- **Scope:** In scope: `lib/sheets.js` (OAuth scope, spreadsheet/tab names, 11-column order, A1 ranges, URLs, the id-column parser) and `lib/outbox.js` (legacy migration and per-destination due/sent/failed transitions) with Node tests; `sheetRow()` in `normalize.js`; the `identity` permission, `oauth2` block and `https://sheets.googleapis.com/*` host permission in `manifest.json`; interactive `chrome.identity.getAuthToken` / `removeCachedAuthToken`, spreadsheet creation with a frozen header, `values.append`, 401 refresh and 429 `Retry-After` in `background.js`; the per-destination outbox, batching, the `sheetsent` marker and the reconcile read; the Settings card, queue text and sync-log column in `app.html`/`app.js`; `RUNTIME_FILES` and an OAuth-scope guard in `scripts/package.mjs`; `store/listing.json`, `store/description.md`, `README.md`, `docs/PRIVACY.md`, `docs/CHROME-WEB-STORE.md`. Out of scope: Apps Script or a public web app; `launchWebAuthFlow` for Brave/Edge (a documented follow-up); a picker for an existing sheet; Drive sharing or configuring Claude's Sheets connector; Google OAuth verification; copying the existing archive into a new sheet; per-server tabs, formatting, formulas or conditional formatting; Google Picker; multiple Google accounts; changing the GridPane fetch, overlap/backfill, webhook payload or stored alert shape; tagging, releasing or uploading to the Chrome Web Store.
- **Success Metrics:** With Sheets off, `node --test` and `node scripts/package.mjs --check` pass and a webhook-only run keeps the same outbox, ordering, retry and discard behaviour, with no Sheets API request. **Connect** creates exactly one spreadsheet titled **GridPane Alerts**, tab **Alerts**, with a frozen header row and the 11 columns in the documented order; the card shows a working **Open the sheet** link; a second Connect reuses the stored sheet when the token can read it. A new alert appends exactly one row; a second flush, a service-worker restart and **Retry now** append no duplicate because of the `sheetsent` marker; the sync log records the sheet count. A failing webhook does not delay or duplicate the sheet row, and a failing sheet does not stop the webhook or change `state.status` to a sync error or rate limit. Legacy outbox rows deliver to the webhook only and never appear in the sheet. A 401 refreshes the cached token once and retries; a 429 schedules the next attempt from `Retry-After`. History import appends only with the sheet backfill checkbox on and only for alerts the import newly stores. `manifest.json` declares `identity`, exactly the `drive.file` scope, the Sheets host permission and a matching version; every declared permission has a store justification.
- **Touched paths:** lib/sheets.js, lib/outbox.js, normalize.js, tests/sheets.test.mjs, tests/outbox.test.mjs, tests/package.test.mjs, manifest.json, background.js, db.js, app.html, app.js, scripts/package.mjs, store/listing.json, store/description.md, README.md, docs/PRIVACY.md, docs/CHROME-WEB-STORE.md, plans/tests.md, plans/20261111-google-sheets-destination.md
- **Version Target:** release-assigned (git-squash-release)
- **Version Note:** The abandoned plan expected 1.4.0. The release helper owns the version now; this plan does not bump it.
- **Approach / Architectural Fit:** The extension already has the two things Sheets needs: an outbox with per-record backoff and a place to shape a plain-text alert (`webhookPayload(...).notification`). Keep that path and add a second destination beside it. A standalone `lib/sheets.js` owns the OAuth scope, the spreadsheet/tab names, the 11-column schema, the A1 ranges and the URL builders, so the header, the row and the append range cannot drift apart; `normalize.js` adds `sheetRow()` and maps `webhookPayload(rec, lookups, 'full').notification` onto the columns, so the sheet uses the same resolved names and ISO timestamps as the webhook. `lib/outbox.js` owns the migration from the current webhook-only record to `{ webhook: {...}, sheet: {...} }` and the due/sent/failed transitions, so Node can prove the destinations retry independently while Chrome integration stays in `background.js`. The interactive token is requested from the Connect click in `app.js`, where Chrome still sees a user gesture; the service worker uses the cached token and never persists it. The manifest carries `identity`, the `oauth2` block with the exact `drive.file` scope, and the Sheets host permission. **Connect** creates the spreadsheet, writes the header with `valueInputOption=RAW` (so alert text beginning with `=` is stored literally) and freezes row 1; only after all three calls succeed are the id and URL saved. Reconnecting reuses the stored sheet when the token can still read it, otherwise it creates a new one. Delivery is opt-in and reuses the outbox: `storeNew` queues a fresh alert for either destination, and `doFlush` handles each destination on its own gate, attempt count and `next_at`. Due sheet rows are appended oldest first in one `values.append` per batch (capped at 500 rows) with `valueInputOption=RAW` and `insertDataOption=INSERT_ROWS`. A per-alert `sheetsent` marker (DB v3) prevents a re-append; the marker is written after a successful append, and before each append the outbox records `attempted_at`, so the only reconcile case is a worker kill between the append and the marker write. A 401 removes the cached token, fetches a new non-interactive token and retries once; a 429 is a typed error whose `Retry-After` feeds the same backoff. Sheet failures are recorded in `state.lastSheetError` and the sync log, never in `state.status`. With the sheet off, every new branch is skipped and the webhook path is unchanged.
- **References:** `background.js` (`DEFAULTS`, `storeNew`, `syncNew`, `importHistory`, `postWebhook`, `flushOutbox`/`doFlush`, `testWebhook`, `startRun`, `handlers`), `normalize.js` (`webhookPayload`, `resolve`, `summaryText`), `db.js` (`DB_VERSION`, `putMany`, `getAll`, `kvGet`/`kvSet`), `manifest.json`, `app.html` (Webhook card), `app.js` (`loadSettings`, `saveSettings`, `renderSettingsInfo`, `renderLog`, `showView`, the `sSave`/`sTest`/`sRetry`/`sClearOutbox` handlers), `scripts/package.mjs` (`RUNTIME_FILES`, `validateManifest`, `assertStoreListing`), `store/listing.json`, `store/description.md`, `docs/PRIVACY.md`, `docs/CHROME-WEB-STORE.md`, `plans/20261110-google-sheets-destination.md` (the full design and assumptions), Google Sheets API (`spreadsheets.create`, `values.append`, `values.get`, `spreadsheets.batchUpdate`), Google OAuth `drive.file`, skills `plan-generation-skill`, `lmt-skills-development-workflow` and `chrome-extensions`.

### Assumptions (marked, veto any of these before execution)

- **The real OAuth client_id is supplied before Phase 2.** The Google Cloud project, consent screen and Chrome-extension OAuth client are human setup; the plan does not invent a client_id. A `REPLACE…`/empty value fails the Phase 2 validation, so the executor stops and asks.
- **Only `https://www.googleapis.com/auth/drive.file` is requested.** No `drive`, `spreadsheets` or other scope, so the extension cannot see files it did not create and no Google verification review is needed.
- **`package.mjs` enforces the scope too.** A broader or extra `oauth2.scopes` entry fails `node scripts/package.mjs --check`, so the scope rule is a build gate.
- **One spreadsheet and one tab:** title **GridPane Alerts**, tab **Alerts**, 11 columns A:K, header row frozen. The names and columns are not user-configurable.
- **Connect reuses the stored spreadsheet when readable, otherwise creates a new one.** There is no existing-sheet picker, and a new sheet is not automatically shared.
- **Two new runtime files:** `lib/sheets.js` and `lib/outbox.js` are added to `RUNTIME_FILES`. `sheetRow()` stays in `normalize.js`.
- **The outbox record shape changes with a safe migration.** A legacy record (no `webhook`/`sheet` keys) becomes a webhook-only record; no notification, outbox id or `created_at` is lost, and a legacy row is never sent to the sheet.
- **A per-alert marker lives in a new DB v3 `sheetsent` store**, pruned to the newest 5,000 ids. The marker plus `attempted_at` and a reconcile read make "never re-append" true; the reconcile read does not run on the normal path.
- **At most 500 rows per append** (`SHEETS_BATCH_MAX`). A larger backlog takes more than one call; order stays oldest first.
- **`sheetsIncludeBackfill` mirrors `webhookIncludeBackfill` and defaults to off.** Connecting a sheet does not copy the existing archive.
- **Disconnect drops pending sheet halves and clears the marker store.** The spreadsheet stays in the user's Drive and is deleted there by the user.

## Skills Used

- **Creation:** `plan-generation-skill` (PGF format, contract, testing phase), `lmt-skills-development-workflow` (explicit-path commits, push, secret-scan cadence).
- **Implementation:** `plan-generation-skill`, `lmt-skills-development-workflow`, `chrome-extensions` (MV3 identity/OAuth and optional host permissions), Google Sheets API and OAuth documentation.

## Phases

### Phase 1: Sheet and outbox models (pure, tested)

**Goal:** Fix the column schema, row shape, outbox migration and retry transitions before any OAuth or Chrome call.

#### Tasks

- [ ] Create `lib/sheets.js` exporting `SHEETS_SCOPE = 'https://www.googleapis.com/auth/drive.file'`, `SHEET_TITLE = 'GridPane Alerts'`, `SHEET_TAB = 'Alerts'`, `SHEET_COLUMNS` (created_at, severity, title, message, server_label, server_ip, site_url, team_id, alert id, action_url, sent_at), `SHEET_HEADER`, `columnLetter(n)`, `appendRange(rowCount)`, `sheetUrl(id)` and `parseSheetId(input)`.
- [ ] Create `lib/outbox.js` exporting `migrateOutbox(record)` (legacy → `{ webhook: {...}, sheet: {...} }`), `outboxDue(record, destination, now)`, `outboxSent(record, destination)`, `outboxFailed(record, destination, error, now)` and `outboxDestinations(record)`. The webhook half keeps the old attempt/backoff semantics; the sheet half starts with `attempts: 0`, `next_at: 0`.
- [ ] In `normalize.js`, add `sheetRow(rec, lookups, sentAt)` that maps `webhookPayload(rec, lookups, 'full').notification` onto `SHEET_COLUMNS`, using the ISO created_at and the resolved server/site names.
- [ ] Add `SHEETS_BATCH_MAX = 500` and the two new files to `RUNTIME_FILES` in `scripts/package.mjs`; add an OAuth-scope guard that fails the package check unless `oauth2.scopes` is exactly `[SHEETS_SCOPE]` once the `oauth2` block exists.
- [ ] Add `tests/sheets.test.mjs` (columns, letter, range, URL, id parser, one row per alert, `RAW`-safe text) and `tests/outbox.test.mjs` (legacy migration, independent due/sent/failed, no cross-destination loss, 500 cap).
- [ ] **Validation:** `node --test` exits 0; `node scripts/package.mjs --check` exits 0; `test "$(grep -c 'SHEETS_SCOPE' lib/sheets.js)" -ge 1`; `test "$(grep -c 'sheetRow' normalize.js)" -ge 1`; `test "$(grep -c 'lib/sheets.js' scripts/package.mjs)" -ge 1`; `test "$(grep -c 'lib/outbox.js' scripts/package.mjs)" -ge 1`.

### Phase 2: OAuth, manifest and Connect

**Goal:** Let the user connect a Google account, create the sheet once, and see it in Settings.

#### Tasks

- [ ] In `manifest.json`, add `identity` to `permissions`, an `oauth2` block with `client_id` and exactly the `drive.file` scope, and `https://sheets.googleapis.com/*` to `host_permissions`. Add a matching justification to `store/listing.json`; the summary stays within 132 characters.
- [ ] In `background.js`, add `sheetsEnabled: false`, `sheetsSpreadsheetId: ''`, `sheetsUrl: ''` and `sheetsIncludeBackfill: false` to `DEFAULTS`; add `connectSheets(token)` (reuse the stored sheet when readable, otherwise create one, write the header with `valueInputOption=RAW`, freeze row 1 with `batchUpdate`, save the id/URL, enable the destination), `disconnectSheets()` (remove the cached token, clear the id/URL and disable; drop pending sheet halves and markers), `testSheet(token)` (append one row from the newest stored alert or a synthetic test alert, never queue or mark it) and `sheetsStatus()` (`{ connected, enabled, url, lastError, lastOk }`). Add the handlers.
- [ ] In `app.js`, import `SHEETS_SCOPE`; add a callback-wrapped interactive `getAuthToken` for the Connect click; load the four settings; make `saveSettings` merge into the stored settings instead of replacing the object, so saving the webhook cannot drop the sheet id/URL; add `saveSheetSettings` that merges only `sheetsEnabled`/`sheetsIncludeBackfill` and refuses to enable without a sheet id; add `renderSheetsInfo`; wire Connect, Test, Save, Disconnect and the Open link.
- [ ] In `app.html`, add a **Google Sheets** card: Connect, the linked sheet URL with **Open**, Disconnect, Send test, the backfill checkbox, and a status line.
- [ ] **Validation:** `node --test` exits 0; `node scripts/package.mjs --check` exits 0; `test "$(grep -c 'identity' manifest.json)" -ge 1`; `test "$(grep -c 'drive.file' manifest.json)" -ge 1`; `test "$(grep -c 'sheets.googleapis.com' manifest.json)" -ge 1`; `test "$(grep -c 'getAuthToken' app.js)" -ge 1`; `python3 -c "import json,sys; m=json.load(open('manifest.json')); o=m.get('oauth2',{}); sys.exit(0 if o.get('scopes')==['https://www.googleapis.com/auth/drive.file'] else 1)"`.

### Phase 3: Delivery, batching and duplicate protection

**Goal:** Append each new alert once, retry independently of the webhook, and make a retry safe.

#### Tasks

- [ ] In `db.js`, raise `DB_VERSION` to 3 and create the `sheetsent` store (keyPath `id`); prune to the newest 5,000 ids when writing.
- [ ] In `background.js`, change `storeNew` to queue the destination halves via `lib/outbox.js`; migrate existing `outbox` records on read; make `doFlush` process the webhook and sheet halves independently (separate gate, attempts and `next_at`), and add `flushSheets(force)` that appends due rows oldest first in one `values.append` per batch, capped at `SHEETS_BATCH_MAX`.
- [ ] On append, record `attempted_at` on the sheet half; after success, write the `sheetsent` marker and clear the half; on failure, use the existing backoff and record `lastSheetError`. A 401 removes the cached token, fetches a new non-interactive token and retries once; a 429 uses `Retry-After`.
- [ ] On startup or the first sheet flush after a restart, reconcile: if `attempted_at` is set and the marker is missing, read `Alerts!I2:I` once and skip ids already present before appending. This is the only read on the normal path.
- [ ] Add the sheet count to the sync-log row and its CSV/table column; keep the existing webhook count. Leave `state.status` untouched by sheet failures.
- [ ] **Validation:** `node --test` exits 0; `node scripts/package.mjs --check` exits 0; `test "$(grep -c 'sheetsent' db.js)" -ge 1`; `test "$(grep -c 'SHEETS_BATCH_MAX' background.js)" -ge 1`; `test "$(grep -c 'flushSheets' background.js)" -ge 1`; `test "$(grep -c 'sheetsSent' app.js)" -ge 1`.

### Phase 4: Documentation, privacy, store and version note

**Goal:** Explain the Google setup, the data that leaves the browser, the reviewer steps and the exact scope.

#### Tasks

- [ ] Update `README.md`: the Google Cloud project, Sheets API, consent screen, Chrome-extension OAuth client and `client_id` setup; the `drive.file` scope; the sheet/tab/columns; the 500-row batch; the 401/429 behaviour; the connection between the unpacked and Web Store extension ids.
- [ ] Update `docs/PRIVACY.md`: alert text and metadata are written to a spreadsheet in the user's own Drive through Google; the extension sees only files it created; the sheet remains after Disconnect.
- [ ] Update `store/description.md`, `store/listing.json` (`dataUse`, `testInstructions`, the new permission justification) and `docs/CHROME-WEB-STORE.md` so a reviewer can connect a sheet and see rows without guessing.
- [ ] Confirm the version note: the release helper owns the version; do not tag or publish in this plan.
- [ ] **Validation:** `node --test` exits 0; `node scripts/package.mjs --check` exits 0; `test "$(grep -c 'drive.file' README.md)" -ge 1`; `test "$(grep -c 'Google Cloud' README.md)" -ge 1`; `test "$(grep -c 'sheets.googleapis.com' docs/PRIVACY.md)" -ge 1`; `python3 -c "import json,sys; l=json.load(open('store/listing.json')); sys.exit(0 if 'identity' in l.get('justifications',{}) and 'https://sheets.googleapis.com/*' in l.get('justifications',{}) else 1)"`.

### Phase 5: Testing & Verification

**Goal:** Prove the row shape, the one-append guarantee, the independent retries and the unchanged webhook path.

#### Tasks

- [ ] Run every command in **How to Test** and confirm each exits 0.
- [ ] Record the outcome of each **Manual / UI Checks** step in the closing reply.
- [ ] Record the test outcomes with `pgf test run 20261111-google-sheets-destination`.
- [ ] **Validation:** every command in **How to Test** produces the expected output.

#### How to Test

Prerequisites: Node 22 and `python3`; no build step and no npm dependencies. The Sheets API calls are a manual check with a real OAuth client and a Google account.

```bash
node --test
node scripts/package.mjs --check
test "$(grep -c 'SHEETS_SCOPE' lib/sheets.js)" -ge 1
test "$(grep -c 'sheetRow' normalize.js)" -ge 1
test "$(grep -c 'lib/sheets.js' scripts/package.mjs)" -ge 1
test "$(grep -c 'lib/outbox.js' scripts/package.mjs)" -ge 1
test "$(grep -c 'sheetsent' db.js)" -ge 1
test "$(grep -c 'flushSheets' background.js)" -ge 1
node -e "import('./lib/sheets.js').then(({ SHEET_COLUMNS, columnLetter, appendRange }) => { if (SHEET_COLUMNS.length !== 11 || columnLetter(11) !== 'K' || appendRange(2) !== 'Alerts!A2:K3') process.exit(1); })"
node -e "import('./normalize.js').then(({ sheetRow }) => { const rec = { id: 'a', created_at: 1793900000, title: 't', message: 'm', severity: 'info', icon: '', server_id: null, site_id: null, team_id: 1, creator_name: '', creator_email: '', read: false, action_url: '' }; const r = sheetRow(rec, {}, '2026-11-11T00:00:00.000Z'); if (r.length !== 11 || r[0] !== '2026-11-05T00:13:20.000Z') process.exit(1); })"
python3 -c "import json,sys; m=json.load(open('manifest.json')); o=m.get('oauth2',{}); p=m.get('permissions',[]); sys.exit(0 if 'identity' in p and o.get('scopes')==['https://www.googleapis.com/auth/drive.file'] and 'https://sheets.googleapis.com/*' in m.get('host_permissions',[]) else 1)"
```

Expected: every command exits 0; `node --test` passes all tests including the new sheet/outbox cases; the package check reports the new runtime files and the exact scope; the manifest declares `identity`, only `drive.file`, and the Sheets host permission.

#### Manual / UI Checks

1. Create the Google Cloud project, enable the Sheets API, configure the consent screen, create the Chrome-extension OAuth client, put the `client_id` in `manifest.json`, reload the unpacked extension, and press **Connect**. Confirm exactly one spreadsheet titled **GridPane Alerts** with tab **Alerts**, a frozen header row, and the 11 columns in order.
2. Press **Send test** and confirm exactly one row. Press it again and confirm no duplicate. Reload the page, connect again, and confirm the stored sheet is reused rather than a second one created.
3. Let a new alert arrive, or press **Sync now**, and confirm one row per alert; restart the service worker and press **Retry now**; confirm no duplicate rows and a sheet count in the Sync log.
4. Force a 401 by revoking the token and a 429 by exceeding the quota. Confirm the 401 refreshes once and retries, the 429 schedules the next attempt from `Retry-After`, the webhook still delivers, and `state.status` is not a sync error.
5. Turn the sheet off and confirm no Sheets request is made while the webhook still works. Disconnect and confirm the card clears and the spreadsheet remains in Drive.

## Summary

To be completed at close-out: what was asked, what was achieved, files changed, how to test, manual checks, skills used, skill feedback, known issues and commits.
