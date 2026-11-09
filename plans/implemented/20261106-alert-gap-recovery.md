# 20261106-alert-gap-recovery

**Version:** 6
**Status:** ✅ Implemented (2026-11-06)
**Commit:** `453cb61` — `docs: record phase 5 of 20261106-alert-gap-recovery`
**Type:** fix

## Original Prompt

> Create PGF.
>
> It looks like we're not getting all alerts, I can see the alerts in the browser as pop-ups but the extension isn't getting them. Thoughts? How can we debug?

## Plan Contract

- **Mission:** Make the sync walk store every alert the bell endpoint still serves, including alerts that appear below the cursor, and make any future gap visible and recoverable.
- **Execution Size:** large — five phases run back to back, each with its own validation and commit.
- **Session Title:** Missing alerts
- **Scope:** In scope: the `syncNew` stop condition and cursor advance in `background.js`; a pure `scan.js` helper with Node tests; per-run diagnostics in the sync log; a read-only gap audit in Settings; the README. Out of scope: changing the GridPane endpoint or adding team parameters; capturing toast/websocket notifications that never reach `/notifications/recent`; multi-team support; webhook payload and retry behaviour; a user-facing overlap setting (the 2-hour overlap stays a constant for now); history-import behaviour beyond clearing the gap flag and resetting the cursor.
- **Success Metrics:** `hitCursor` is gone; a page whose oldest alert is older than `cursor.created_at − 2h` ends the walk; the cursor does not move when the 50-page cap is hit; `state.syncGap` is set on a cap, keeps automatic checks to page 1, and clears after a completed import or deep walk; the sync log records cursor from/to and the floor; the gap audit reports missing ids without writing anything; `node --test` and `pgf check` pass; the seven known gaps are recovered by the manual import and the audit then reports none in the newest 96.
- **Touched paths:** background.js, lib/scan.js, lib/package.json, tests/scan.test.mjs, package.json, app.js, app.html, README.md, plans/tests.md, plans/todos.md
- **Version Target:** release-assigned (git-squash-release)
- **Approach / Architectural Fit:** `background.js:238` breaks the page loop on the first alert with `created_at < cursor.created_at`, treating "older than the newest alert I stored" as "already seen". GridPane inserts some notifications out of order (the 2026-11-05 14:31–14:44 provisioning burst is the evidence), so those alerts sort below the cursor and are never requested again. Replace the timestamp break with a scan floor: keep storing unseen ids until a page's oldest `created_at` is below `cursor.created_at − OVERLAP_SEC`, or `willLoadMoreNoti` is false. Extract the decisions (`pageOldest`, `shouldStop`, `nextCursor`, `missingIds`) into `scan.js` so Node can test them without Chrome. `background.js:265` also advances the cursor even when the walk was capped; route it through `nextCursor` and gate on `reached`. A capped walk sets `syncGap`, which keeps automatic checks to page 1 so new alerts still arrive, and a Settings audit exposes the gap instead of hiding it.
- **References:** `background.js` (`syncNew`, `importHistory`, `startRun`, `handlers`), `app.js` (`renderStatus`, `renderLog`, `renderSettingsInfo`), `app.html` (Sync log table, Settings Sync card), `README.md` (How it works, Limits), `plans/implemented/20261106-full-alert-messages.md` (PGF style and CLI-assertion pattern), `normalize.js` (stored record shape).

> **Pre-flight (runtime, not a code change):** before or right after Phase 1, recover the seven known gaps with Settings → **Start over from page 1** → **Import older history**. The fix prevents new gaps; the import backfills the existing ones. Leave *Also send alerts found during a full history import* off unless those recovered alerts should reach the webhook.

## Skills Used

- **Creation:** `plan-generation-skill` (PGF format, contract, testing phase), `lmt-skills-development-workflow` (explicit-path commits, push, session checks).
- **Implementation:** `plan-generation-skill` (phase execution and close-out), `lmt-skills-development-workflow` (explicit-path commits, push, secret scans).

## Phases

### Phase 1: Extract and test the scan rules

**Goal:** Put the stop, cursor and comparison decisions in a pure module that Node can test without Chrome.

#### Tasks

- [x] Create `lib/scan.js` exporting `pageOldest(items)`, `shouldStop({ more, oldest, floor })`, `nextCursor({ reached, newest, current })` and `missingIds(remote, localIds)`; it must not import `chrome.*`, `db.js` or `normalize.js`.
- [x] Add `lib/package.json` with `"type": "module"` so Node treats the helper as an ES module; the extension keeps loading plain `.js`, and a root `package.json` (which would activate the release gate with no version) is avoided.
- [x] Add `tests/scan.test.mjs` covering: an empty page has oldest `0`; `more: false` stops; `oldest < floor` stops; `oldest === floor` continues; `nextCursor` keeps `current` when `reached` is false, advances to `newest` when true, and falls back to `current` when `newest` is null; `missingIds` compares string ids and preserves remote order.
- [x] **Validation:** `node --test` exits 0 and reports at least four passing tests.

> **Notes:** The helper and test were first added as `scan.js` / `tests/scan.test.js` with a root `package.json`; that file made `pgf release` read an undefined version and report drift. They were moved under `lib/` with `lib/package.json`, and the test renamed to `.mjs`, so Node still loads ESM while the release gate stays silent.

**Commit:** `b597cdd` — `feat: extract alert walk decisions into scan.js`

### Phase 2: Overlap walk and cursor guard

**Goal:** Stop treating "older than the cursor" as "already seen", and never advance the cursor past an unfinished walk.

#### Tasks

- [x] In `background.js`, import `pageOldest`, `shouldStop` and `nextCursor` from `./scan.js`, and add `const OVERLAP_SEC = 2 * 3600;` with a comment explaining the late-arrival case.
- [x] Rewrite the `syncNew` page loop: compute `floor = cursor ? cursor.created_at - OVERLAP_SEC : 0`; normalize and store every item on each page (id dedupe already handles re-reads); track the page's oldest `created_at`; stop when `shouldStop({ more: j.willLoadMoreNoti, oldest, floor })` or the page is empty; keep the first-run page-1-only break.
- [x] Remove `hitCursor` and the `created_at < cursor.created_at` break entirely; `cursor` becomes a scan floor, not a sentinel.
- [x] Return `cursor: nextCursor({ reached, newest, current: cursor })`; when `MAX_SYNC_PAGES` is reached without a stop, keep the old cursor, set `state.syncGap = true` and add a note saying the gap needs the history import.
- [x] In `sync()`, when `state.syncGap` is set and the trigger is automatic, run a page-1-only shallow sync that still stores new alerts but leaves the cursor untouched; a manual sync still attempts the full walk.
- [x] On a completed deep walk, clear `syncGap`; on `importHistory` completion, return `{ historyDone: true, historyNextPage: 1, syncGap: false, cursor: <newest stored alert> }` so the next walk does not re-scan the whole history.
- [x] **Validation:** `node --test` exits 0; `test -z "$(grep 'hitCursor' background.js)"`; `test "$(grep -c 'nextCursor' background.js)" -ge 1`; `test "$(grep -c 'syncGap' background.js)" -ge 1`.

> **Notes:** A shallow run leaves the cursor where it was. Advancing it would let a later manual sync start above the old gap and clear `syncGap` without filling it; the import resets the cursor when it completes.

**Commit:** `ccfe7f4` — `fix: scan below the cursor instead of stopping at it`

### Phase 3: Make gaps visible

**Goal:** Record each walk's decisions and give the user a read-only audit that compares GridPane with the archive.

#### Tasks

- [x] Add `cursorFrom`, `cursorTo`, `floor` and `capped` to the sync-log entry in `startRun`; capture `cursorFrom` before `fn` and `cursorTo` after, and record `run.floor`/`run.capped` set by `syncNew`.
- [x] Store a rolling `syncDebug` buffer (last 20 runs) in `kv` with per-page `{ page, count, first, last, oldest, more }`, so a future miss can be diagnosed without a manual API replay.
- [x] Add a `gapAudit` handler: page 1..`GAP_AUDIT_PAGES` (12) with `gpGet` and `PAGE_DELAY`, compare ids with `missingIds` against `store.getAll('notifications')`, and return `{ ok: true, checked, pages, missingCount, missing: <newest 50> }`; read-only, no writes, no webhook queueing.
- [x] Add a **Check for gaps** button and result line to the Settings Sync card (`app.html`, `app.js`); render "no gaps in the newest N alerts" or "M alerts on GridPane are not stored" with the newest few titles/times and a pointer to **Import older history**.
- [x] Show a banner in `renderStatus` when `state.syncGap` is set: new alerts are still collected, and **Import older history** fills the rest.
- [x] Add a **Cursor** column to the Sync log table (`app.html`) and render `from → to` in `renderLog` (short local times, `–` when absent).
- [x] **Validation:** `node --test` exits 0; `test "$(grep -c 'gapAudit' background.js)" -ge 1`; `test "$(grep -c 'sGapAudit' app.html)" -ge 1`; `test "$(grep -c 'syncGap' app.js)" -ge 1`; `test "$(grep -c 'Cursor' app.html)" -ge 1`.

> **Notes:** Also corrected the Sync card paragraph in `app.html`, which still claimed each check only goes back to the last synced alert.

**Commit:** `10f0c02` — `feat: add gap audit and cursor diagnostics`

### Phase 4: Document the overlap and recovery

**Goal:** Replace the README's "nothing older is requested" promise with the real behaviour and document the audit.

#### Tasks

- [x] In `README.md` **How it works**, replace the cursor bullet: each check pages back through the newest alerts plus a 2-hour overlap, stores any unseen id, and stops only after the walk passes that floor; late-arriving alerts below the last synced alert are still picked up.
- [x] Add a **Gaps** paragraph to `README.md` covering **Check for gaps**, the `syncGap` banner, and **Import older history** as the recovery path.
- [x] In `README.md` **Limits**, note that transient pop-ups GridPane never stores in the bell remain out of reach, and that the gap audit compares only what the bell still serves.
- [x] **Validation:** `test "$(grep -c '2-hour overlap' README.md)" -ge 1`; `test "$(grep -c 'Check for gaps' README.md)" -ge 1`; `test -z "$(grep 'Nothing older is requested' README.md)"`.

**Commit:** `3059bb3` — `docs: describe the overlap walk and gap audit`

### Phase 5: Testing & Verification

**Goal:** Prove the new walk stores late-arriving alerts, keeps the cursor honest, and gives the user a repeatable check.

#### Tasks

- [x] Run every command in **How to Test** and confirm each exits 0.
- [x] Record the **Manual / UI Checks** outcome, including the seven recovered ids and the audit result.
- [x] Record the test outcomes with `pgf test run 20261106-alert-gap-recovery`.
- [x] **Validation:** every command in `How to Test` produces the expected output.

> **Notes:** All 11 `How to Test` commands passed and were recorded in `plans/tests.md`
> (11 passed, 0 failed). The browser checks were not run here: they need the user's Chrome
> profile, the unpacked extension, and a signed-in GridPane session, including the pre-flight
> history import that recovers the seven known gaps. They are filed as a todo.

#### How to Test

Prerequisites: Node 18+ (this checkout was verified with Node 22), `bash`, and Chrome with the unpacked extension for the manual checks. No build step and no npm dependencies.

```bash
node --test
test -z "$(grep 'hitCursor' background.js)"
test "$(grep -c 'OVERLAP_SEC' background.js)" -ge 1
test "$(grep -c 'nextCursor' background.js)" -ge 1
test "$(grep -c 'syncGap' background.js)" -ge 1
test "$(grep -c 'gapAudit' background.js)" -ge 1
test "$(grep -c 'sGapAudit' app.html)" -ge 1
test "$(grep -c 'syncGap' app.js)" -ge 1
test "$(grep -c 'Cursor' app.html)" -ge 1
test "$(grep -c '2-hour overlap' README.md)" -ge 1
test "$(grep -c 'Check for gaps' README.md)" -ge 1
```

Expected: `node --test` prints `pass` for every test and exits 0; every `test` line exits 0. The `hitCursor` line fails on the pre-fix tree, so it proves the timestamp break is gone rather than merely that the file parses.

#### Manual / UI Checks

1. Open `chrome://extensions`, turn on **Developer mode**, and press **Reload** on the "GridPane Alerts Archive" card.
2. Settings → **Check for gaps**. After the pre-flight import, expect a result covering the newest 96 alerts with no gaps; the seven 2026-11-05 14:31–14:44 provisioning alerts are now in the archive.
3. In the service-worker console, simulate the cap path: `chrome.storage.local.get('state').then(({ state }) => chrome.storage.local.set({ state: { ...state, syncGap: true } }))`. Open the archive and confirm the gap banner appears; then clear the flag with `syncGap: false` and confirm it disappears.
4. Wait for or trigger one new alert, press **Sync now**, and confirm it is stored, the badge increments, and the Sync log row shows a Cursor `from → to`.

**Commit:** `453cb61` — `docs: record phase 5 of 20261106-alert-gap-recovery`

## Summary

- **What was asked:** "Create PGF. It looks like we're not getting all alerts, I can see the alerts in the browser as pop-ups but the extension isn't getting them. Thoughts? How can we debug?"
- **What was achieved:** The sync walk no longer treats "older than the cursor" as "already seen". It stores every alert on each page and keeps paging until it passes a 2-hour overlap floor below the cursor or reaches the end of history, so late-inserted provisioning notices and same-second batches are stored. The cursor advances only after a completed walk; a 50-page cap keeps the old cursor, sets `syncGap`, and limits automatic checks to page 1 until **Import older history** fills the gap. Each run logs the cursor from/to and the floor, keeps a 20-run `syncDebug` page buffer, and Settings has a read-only **Check for gaps** audit. The README documents the overlap, the audit, and the bell-only limit.
- **Files changed:** `background.js`, `lib/scan.js`, `lib/package.json`, `tests/scan.test.mjs`, `app.js`, `app.html`, `README.md`, `plans/tests.md`, `plans/todos.md`, `plans/20261106-alert-gap-recovery.md`. A root `package.json` was added for Node ESM and then removed so `pgf release` would not read an undefined version.
- **How to test:** from the repository root, with Node 18+ and no build step:

  ```bash
  node --test
  test -z "$(grep 'hitCursor' background.js)"
  test "$(grep -c 'OVERLAP_SEC' background.js)" -ge 1
  test "$(grep -c 'nextCursor' background.js)" -ge 1
  test "$(grep -c 'syncGap' background.js)" -ge 1
  test "$(grep -c 'gapAudit' background.js)" -ge 1
  test "$(grep -c 'sGapAudit' app.html)" -ge 1
  test "$(grep -c 'syncGap' app.js)" -ge 1
  test "$(grep -c 'Cursor' app.html)" -ge 1
  test "$(grep -c '2-hour overlap' README.md)" -ge 1
  test "$(grep -c 'Check for gaps' README.md)" -ge 1
  ```

  Expected: `node --test` prints `pass` for all 10 tests and exits 0; every `test` line exits 0. The browser checks (reload the unpacked extension; Settings → **Start over from page 1** → **Import older history**; **Check for gaps** should report no gaps in the newest 96; simulate `syncGap` and confirm the banner; confirm a new alert lands with a Cursor `from → to` row) were not run here because they need the user's Chrome profile and GridPane session. They are filed as a follow-up todo.
- **Skills used:** creation — `plan-generation-skill`, `lmt-skills-development-workflow`; implementation — `plan-generation-skill`, `lmt-skills-development-workflow`.
- **Skill feedback:** None.
- **Known issues / suggestions:** The seven 2026-11-05 gaps and the browser checks still need the user's Chrome profile and GridPane session — run **Start over from page 1** → **Import older history**, then **Check for gaps**. The 2-hour overlap is a constant; consider a setting if a busier fleet needs a different window. The 50-page cap still requires the manual history import, now surfaced by the banner.
- **Commits:** `b597cdd` feat: extract alert walk decisions into scan.js; `ccfe7f4` fix: scan below the cursor instead of stopping at it; `10f0c02` feat: add gap audit and cursor diagnostics; `3059bb3` docs: describe the overlap walk and gap audit; `453cb61` docs: record phase 5; `3edda48` chore: move scan helpers under lib for Node ESM; close-out recorded in the follow-up commit.
