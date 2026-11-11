# 20261111-notion-destination

**Version:** 6
**Status:** ⏸ On Hold
**Type:** feature

## Original Prompt

> You should draft all options.
>
> Drafted from the decision record `docs/reference/storage-decisions.md` as option D, the runner-up. Parked on hold until the storage decision chooses it. Do not execute while any sibling option is chosen instead.

## Plan Contract

- **Mission:** Add an opt-in Notion database destination beside the webhook, so each new GridPane alert becomes one Notion page with a readable title, severity, server/site, created time and message, de-duplicated by the alert id, while the local archive, webhook and export stay unchanged.
- **Execution Size:** medium — a pure Notion model, the extension settings/outbox path, documentation, and verification.
- **Session Title:** Notion archive destination
- **Scope:** In scope: `lib/notion.js` (property mapping, message chunking, query/create bodies, retry classification) with Node tests; a `notionoutbox` IndexedDB store (DB v3) and `flushNotion` in `background.js`; a **Notion archive** Settings card with integration token, database id, enable/backfill, Send test and status; the optional host permission for `https://api.notion.com/*`; README, `docs/PRIVACY.md`, `store/description.md` and `store/listing.json`. Out of scope: OAuth or a public Notion app; creating the database or its properties (the user creates and shares it); a Worker or middleware; changing the webhook outbox/payloads; querying arbitrary Notion pages; attachments/images; a custom Notion layout or rollups; migrating the existing archive into Notion; a version bump.
- **Success Metrics:** With **Notion archive** off, `node --test` and `node scripts/package.mjs --check` pass, no Notion request is made, and the webhook/local archive behave as before. Saving the token and database id asks for the `api.notion.com` origin; `manifest.json` gains no Google-style `identity` permission. A new alert queues one `notionoutbox` record. A flush queries the database for the alert id, creates one page only when absent, truncates a long message into at most 20 child paragraphs of 2,000 characters, and appends the page. A retry, a service-worker restart or **Send test** creates no duplicate page. A 401/403 stops the destination and surfaces the error without touching `state.status`; a 429/529 waits for `Retry-After`; a 400 names the schema/property problem in Settings. A failing Notion destination does not delay or duplicate the webhook. `GET`-free: the plan adds no read API of its own; Notion is the read surface.
- **Touched paths:** lib/notion.js, tests/notion.test.mjs, background.js, db.js, app.html, app.js, README.md, docs/PRIVACY.md, store/description.md, store/listing.json, plans/tests.md, plans/20261111-notion-destination.md
- **Version Target:** release-assigned (git-squash-release)
- **Version Note:** No version bump in this plan; the release helper owns the version.
- **Approach / Architectural Fit:** Notion is a presentation store, not a queue. The existing outbox/backoff shape still applies, but one page per alert means the destination runs one request pair (query then create) per alert and must be paced. Add a separate `notionoutbox` store so the webhook outbox is untouched and the two destinations retry independently. `lib/notion.js` owns the property mapping, the message chunks, the query/create bodies and the retry classification; `background.js` owns the token, the 350 ms spacing and the error state. The title property carries the alert title; an `Alert ID` rich-text property carries the id used by the query filter. The message goes into the `Message` property for its first 2,000 characters and into child paragraph blocks for the rest, capped at 20 blocks; Notion's rich-text limit is 2,000 characters and a request carries at most 100 blocks and 500 KB. The destination is opt-in, and its failures set `lastNotionError`, never `state.status`, so a Notion outage cannot pause GridPane sync. The optional host permission for `https://api.notion.com/*` is requested when the token is saved, exactly like the webhook host.
- **References:** `background.js` (`storeNew`, `syncNew`, `doFlush`, `handlers`, `DEFAULTS`), `db.js` (`DB_VERSION`, `putMany`, `getAll`), `normalize.js` (`webhookPayload` full notification), `app.html` (Webhook card), `app.js` (`loadSettings`, `saveSettings`, `renderSettingsInfo`, the optional host permission request), `scripts/package.mjs` (`RUNTIME_FILES`), `docs/reference/storage-decisions.md` (option D and the Notion limits), `plans/implemented/20261111-storage-destinations.md` (decision gate), Notion API request limits and page/property documentation, skills `plan-generation-skill`, `lmt-skills-development-workflow`, `chrome-extensions` and `notion-knowledge-capture` (property conventions).

### Assumptions (marked, veto any of these before execution)

- **The integration, token, database and share are human setup.** The plan does not create a Notion integration, database or token. The user creates a database with the documented properties and shares it with the integration.
- **The database is identified by id, not by a picker.** The user pastes the database id (or URL); the extension validates it by reading the schema once before enabling the destination.
- **One page per alert, with a query-before-create de-duplication.** Notion has no idempotency key on page creation, so a duplicate is prevented by querying `Alert ID` first; the cost is one read per alert.
- **The message is chunked, not silently dropped.** The `Message` property holds the first 2,000 characters; the rest goes into at most 20 paragraph blocks (2,000 each). The page states when the message was truncated at the cap.
- **The destination is paced at about 3 requests/second.** A standard Notion plan allows 180 requests/minute per connection and about 3 queries/second; a 350 ms gap keeps the extension inside that budget, with `Retry-After` on 429/529.
- **No new manifest permission.** `optional_host_permissions` already covers `https://api.notion.com/*`; the Save action asks for that origin.
- **The remote copy is additive.** The local archive remains the source of truth and is never deleted because Notion accepted a page.

## Skills Used

- **Creation:** `plan-generation-skill` (PGF format, contract, testing phase), `lmt-skills-development-workflow` (explicit-path commits, push, secret-scan cadence).
- **Implementation:** `plan-generation-skill`, `lmt-skills-development-workflow`, `chrome-extensions` (MV3 optional host permission, outbox/backoff), Notion API documentation, `notion-knowledge-capture` (database/property conventions).

## Phases

### Phase 1: Pure Notion model and tests

**Goal:** Put the page shape, message chunks, query filter and retry decisions in a pure module Node can test.

#### Tasks

- [ ] Create `lib/notion.js` exporting `NOTION_MESSAGE_CHARS = 2000`, `NOTION_MAX_BLOCKS = 20`, `notionProperties(rec, lookups)` (title, alert id, created, severity, server, site, message, received), `notionChunks(message, max = NOTION_MAX_BLOCKS)` (paragraph blocks of 2,000 characters, never an empty block), `notionCreateBody(databaseId, rec, lookups)` (parent, properties, children), `notionQueryBody(alertId)` (filter on `Alert ID` rich_text equals) and `notionRetry(status)` (`401`/`403` → `stop`; `429`/`529`/`5xx` → `retry`; `2xx` → `ok`; `400` → `schema`; anything else → `error`).
- [ ] Add `lib/notion.js` to `RUNTIME_FILES` in `scripts/package.mjs`.
- [ ] Add `tests/notion.test.mjs` covering: the property values and title; server/site omitted when unknown; the created/received dates; a 5,000-character message split into three blocks with no loss; a 50,000-character message capped at 20 blocks and marked truncated; an empty message producing no child block; the query filter; the create body parent/database id; and every retry classification.
- [ ] **Validation:** `node --test` exits 0; `node scripts/package.mjs --check` exits 0; `test "$(grep -c 'NOTION_MESSAGE_CHARS' lib/notion.js)" -ge 1`; `test "$(grep -c 'lib/notion.js' scripts/package.mjs)" -ge 1`.

### Phase 2: Extension destination, schema check and Settings

**Goal:** Queue new alerts, create one page per alert with a de-duplication read, and expose the destination in Settings.

#### Tasks

- [ ] In `db.js`, raise `DB_VERSION` to 3 and create a `notionoutbox` object store (`keyPath: 'id'`). Do not change the existing `outbox` shape.
- [ ] In `background.js`, add `notionEnabled: false`, `notionToken: ''`, `notionDatabaseId: ''` and `notionIncludeBackfill: false` to `DEFAULTS`; in `storeNew`, write a `notionoutbox` record when the destination is enabled and the alert is new; add `validateNotion()` (read the database schema once, confirm the required properties), `flushNotion(force)` (query by alert id, create the page only when absent, 350 ms between alerts, delete accepted ids, apply `notionRetry`), and `testNotion()` (create one page from the newest stored alert or a synthetic test alert, never queue or persist it).
- [ ] Handle 401/403 by setting `lastNotionError` and stopping the flush; handle 429/529 with `Retry-After` and the existing backoff; handle 400 by naming the missing property. Never set `state.status`.
- [ ] Call `flushNotion()` after the webhook flush in `startRun`, and add `notionStatus`, `testNotion`, `validateNotion` and `flushNotion` handlers.
- [ ] In `app.html`, add a **Notion archive** card: token (password field), database id/URL, **Validate database**, **Send new alerts**, **Also send history**, **Send test**, **Retry now**, and a status line. In `app.js`, load/save the four settings, request `https://api.notion.com/*` with `chrome.permissions.request`, render the status and keep the webhook path untouched.
- [ ] Confirm `manifest.json` needs no change: the existing `optional_host_permissions` covers the Notion origin; do not add a fixed host permission or `identity`.
- [ ] **Validation:** `node --test` exits 0; `node scripts/package.mjs --check` exits 0; `test "$(grep -c 'notionoutbox' background.js)" -ge 1`; `test "$(grep -c 'flushNotion' background.js)" -ge 1`; `test "$(grep -c 'Notion archive' app.html)" -ge 1`; `test "$(grep -c 'notionDatabaseId' app.js)" -ge 1`; `python3 -c "import json,sys; m=json.load(open('manifest.json')); sys.exit(0 if 'identity' not in m.get('permissions',[]) else 1)"`.

### Phase 3: Documentation, privacy and store text

**Goal:** Explain the Notion setup, the message cap, the rate limit and the data flow.

#### Tasks

- [ ] Update `README.md` with a **Notion archive** section: create the integration, create a database with the documented properties, share it, paste the token and database id, and what a page contains. State the 2,000-character rich-text cap, the 20-block message cap and the ~3 requests/second pacing.
- [ ] Update `docs/PRIVACY.md`: alert text, server names and IPs, and the alert author's name leave the browser for the user's own Notion workspace; the extension author operates no intermediary; uninstalling the extension does not delete the pages.
- [ ] Update `store/description.md` and `store/listing.json` `dataUse`/`testInstructions` to name the Notion destination and the optional host permission. Keep the summary within 132 characters and every permission justified.
- [ ] **Validation:** `node --test` exits 0; `node scripts/package.mjs --check` exits 0; `test "$(grep -c 'Notion archive' README.md)" -ge 1`; `test "$(grep -c '2,000' README.md)" -ge 1`; `test "$(grep -c 'Notion archive' docs/PRIVACY.md)" -ge 1`.

### Phase 4: Testing & Verification

**Goal:** Prove the page shape, de-duplication and failure handling, and that the webhook path is unchanged.

#### Tasks

- [ ] Run every command in **How to Test** and confirm each exits 0.
- [ ] Record the outcome of each **Manual / UI Checks** step in the closing reply.
- [ ] Record the test outcomes with `pgf test run 20261111-notion-destination`.
- [ ] **Validation:** every command in **How to Test** produces the expected output.

#### How to Test

Prerequisites: Node 22; no build step and no npm dependencies. The Notion API calls are a manual check with a real integration token.

```bash
node --test
node scripts/package.mjs --check
test "$(grep -c 'NOTION_MESSAGE_CHARS' lib/notion.js)" -ge 1
test "$(grep -c 'lib/notion.js' scripts/package.mjs)" -ge 1
test "$(grep -c 'notionoutbox' background.js)" -ge 1
test "$(grep -c 'flushNotion' background.js)" -ge 1
test "$(grep -c 'Notion archive' app.html)" -ge 1
node -e "import('./lib/notion.js').then(({ notionProperties, notionChunks, notionQueryBody, notionRetry }) => { const rec = { id: 'a', created_at: 1, title: 't', message: 'x'.repeat(5000), severity: 'warning', server_id: null, site_id: null, team_id: 1, creator_name: '', creator_email: '', read: false, action_url: '' }; const p = notionProperties(rec, {}); if (p['Alert ID'].rich_text[0].text.content !== 'a') process.exit(1); if (notionChunks(rec.message).length !== 3) process.exit(1); if (notionQueryBody('a').filter.property !== 'Alert ID') process.exit(1); if (notionRetry(401) !== 'stop' || notionRetry(429) !== 'retry' || notionRetry(400) !== 'schema') process.exit(1); })"
python3 -c "import json,sys; m=json.load(open('manifest.json')); sys.exit(0 if 'identity' not in m.get('permissions',[]) else 1)"
```

Expected: every command exits 0; `node --test` passes all tests including the new Notion cases; the package check still reports only the runtime files; the manifest has no `identity` permission.

#### Manual / UI Checks

1. Create a Notion integration, a database with `Alert`, `Alert ID`, `Created`, `Severity`, `Server`, `Site`, `Message` and `Received`, and share it with the integration. Paste the token and database id into Settings, press **Validate database**, and confirm it reports the required properties.
2. Press **Send test**. Confirm one page appears with the alert title, severity, server/site and message; press **Send test** again and confirm the same page count (the query-before-create skips the duplicate).
3. Let a new alert arrive, or press **Sync now**, and confirm one page per alert. Restart the service worker and press **Retry now**; confirm no duplicate pages.
4. Send a very long alert (or use a stored one). Confirm the `Message` property holds the first 2,000 characters and the page's child paragraphs hold the rest, with a truncation note at the 20-block cap. Confirm no `validation_error` for property size.
5. Force a 401 by changing the token and a 429 by making the integration hit the rate limit. Confirm Settings names the error, the webhook still delivers, and `state.status` is not a sync error. Restore the token and confirm the next flush succeeds.

## Summary

To be completed at close-out: what was asked, what was achieved, files changed, how to test, manual checks, skills used, skill feedback, known issues and commits.
