# 20261107-backfill-and-audit

**Version:** 6
**Status:** Not Started
**Type:** fix

## Original Prompt

> It looks like we're syncing older entries first, then only syncing for instance 8 items. This was done moments ago.
>
> I've also attached the log
>
> started | finished | kind | trigger | status | pages | requests | rate_limited | new_alerts | webhook_sent | webhook_failed | error | notes
> 2026-11-07T14:41:42.118Z | 2026-11-07T14:41:44.028Z | sync | manual | ok | 2 | 2 | 0 | 8 | 0 | 0 | |
> 2026-11-07T14:40:35.148Z | 2026-11-07T14:40:51.188Z | sync | auto | ok | 1 | 10 | 0 | 8 | 0 | 0 | | first run: started tracking from the newest alerts · server/site names refreshed (new server or site seen)
>
> Then I clicked check gaps.
>
> 80 alerts on GridPane are not stored, newest: Cloning/Migrate Notice (11/6/2026, 7:50:46 AM); Cloning/Migrate Notice (11/6/2026, 7:50:20 AM); Cloning/Migrate Notice (11/6/2026, 7:49:59 AM). Run Import older history.
> 16 alerts stored · names known for 9 servers and 77 sites (updated 3 min ago)
>
> But it left 16 alerts stored · names known for 9 servers and 77 sites (updated 3 min ago)
>
> So something is still not working correctly.
>
> This is what I see in the interface.
>
> SYS_SWAP_MEM 75% Usage Warning … FILESYSTEM Capacity Warning > 95% … (eight alerts, 14:40–14:45)
>
> *(A CSV of 15 GridPane alerts dated 2026-11-06 was attached, showing the history that used to be stored.)*
>
> Create PGF.

## Plan Contract

- **Mission:** Make the archive fill the whole GridPane bell on its own, in throttled resumable batches, and make **Check for gaps** report the truth about what is still missing.
- **Execution Size:** large — four code phases plus verification, each with its own validation and commit, run back to back in one continuous execution request.
- **Session Title:** Backfill older alerts
- **Scope:** In scope: the `syncNew` walk in `background.js` (batch cap, backfill cursor, first-run continuation), a persisted `state.backfill` replacing `historyNextPage`/`historyDone`, `newestOf`/`backfillStart`/`batchDone`/`sortNewestFirst` in `lib/scan.js` with Node tests, a whole-bell gap audit, the busy-run reply, the Settings/banner/sync-log copy in `app.js`/`app.html`, the README, and the superseded follow-up todo. Out of scope: the GridPane endpoint, team selection, webhook payload/retry/queueing, the GridPane-tab preflight (the separate `20261107-require-gridpane-tab` plan), CSV/JSON import, a user-facing overlap setting, and the stored alert shape.
- **Success Metrics:** a first run stores page 1 then consumes up to 20 older pages in the same run; each automatic run consumes at most `AUTO_BACKFILL_PAGES` (20) backfill pages and each manual run at most `MANUAL_BACKFILL_PAGES` (100); `state.backfill.nextPage` only advances past pages that were stored, and `state.backfill.done` flips only when GridPane reports no more pages; `state.syncGap` is `!backfill.done`, so the banner stays until the bell ends; the cursor is the maximum `created_at` on page 1 and never moves backwards; the audit walks up to `MAX_WALK_PAGES` (50) pages, reports `checked`/`pages`/`done`, and sorts `missing` newest-first; a second run while a run is in flight returns `{ ok: false, status: 'busy' }` without writing state; `node --test`, `node scripts/package.mjs --check`, `pgf check` and `pgf test run 20261107-backfill-and-audit` pass; a fresh install reaches the full 96+ alert bell without pressing anything.
- **Touched paths:** background.js, lib/scan.js, tests/scan.test.mjs, app.js, app.html, README.md, plans/todos.md, plans/tests.md
- **Version Target:** release-assigned (git-squash-release)
- **Approach / Architectural Fit:** The current walk stops at `cursor.created_at − 2h` (`OVERLAP_SEC`) and only a manual import ever reads below that floor, so a fresh install holds page 1 (8 alerts) forever while the audit reports the rest as missing. Keep the overlap walk for pages inside the 2-hour window, then continue into a **backfill loop** anchored on `state.backfill.nextPage`; start it at `max(nextPage, lastWalkedPage + 1)` so a busy walk never re-reads from page 1 and never skips. Page numbers shift down when new alerts arrive, so resuming at the recorded page can only re-read already-stored ids (id dedupe handles it); it cannot skip. The first run stores page 1 (as documented) and immediately continues into the backfill batch, keeping `countAsUnseen` false and sending backfilled alerts to the webhook only when *Also send alerts found during a full history import* is on. **Import older history** becomes the same walk with the larger manual batch, and **Start over from page 1** resets `state.backfill`. The audit's 12-page window becomes the whole bell up to the same 50-page cap, and its first three entries are sorted by time instead of remote order.
- **References:** `background.js` (`syncNew`, `importHistory`, `sync`, `gapAudit`, `startRun`, `handlers`), `normalize.js` (`normalize`), `lib/scan.js` and `tests/scan.test.mjs`, `app.js` (`renderStatus`, `renderSettingsInfo`, `renderLog`, `$('sHistory')`, `$('sGapAudit')`), `app.html` (Sync card, Older history card), `README.md` (How it works, Gaps, Limits), `plans/implemented/20261106-alert-gap-recovery.md` (the 2-hour overlap and gap audit this plan supersedes), `plans/todos.md` (the end-to-end Chrome follow-up), skills `plan-generation-skill` and `lmt-skills-development-workflow`.

### Assumptions (marked, veto any of these before execution)

- **A 20-page batch per automatic run** is the throttle: 160 alerts at 1.5 s between pages is roughly 30–45 s per run at the 5-minute default, and a 96-alert bell therefore completes in two runs.
- **The manual batch is 100 pages** because the user pressed the button and is watching; it stays page-paced and rate-limit aware.
- **Backfilled alerts keep the existing webhook gate** (`webhookIncludeBackfill`), so a first-run or catch-up import does not replay old alerts unless the user asked for it.
- **The audit stays read-only.** It reports and never writes; the banner is driven by `state.backfill`, not by a stored audit result.
- **The auto sync keeps page 1 every run** even while backfilling, so new alerts are never delayed behind older pages.

## Skills Used

- **Creation:** `plan-generation-skill` (v6 layout, contract, final `How to Test` phase), `lmt-skills-development-workflow` (explicit-path commits, push, test ledger).
- **Implementation:** none yet.

## Phases

### Phase 1: Walk helpers and tests

**Goal:** Put the newest-alert, backfill-resume and batch-budget decisions in the pure module so Node can prove them without Chrome.

#### Tasks

- [ ] In `lib/scan.js`, add `newestOf(items)`: return the item with the largest `created_at` (the first one wins on a tie), and `null` for an empty or missing list. It must not assume `items[0]` is the newest.
- [ ] Add `backfillStart({ nextPage, lastWalkedPage })`: return `Math.max(<valid nextPage or 1>, lastWalkedPage + 1)` so the backfill resumes after the page the new-alert walk reached.
- [ ] Add `batchDone({ page, startPage, batch, more })`: return true when GridPane has no more pages (`!more`) or when `page - startPage + 1 >= batch`.
- [ ] Add `sortNewestFirst(items)`: return a copy ordered by `created_at` descending, treating a missing or non-numeric `created_at` as `0`; never mutate the input.
- [ ] Update `nextCursor` so it never regresses: when `current.created_at >= newest.created_at`, keep `current`; otherwise advance to `newest`. A capped walk still returns `current`.
- [ ] Extend `tests/scan.test.mjs` with cases for: `newestOf` picks the maximum and not the first, `newestOf` returns `null` for empty/missing, `backfillStart` uses `lastWalkedPage + 1` when it is ahead, `backfillStart` uses `nextPage` when it is ahead, `batchDone` is false below the budget and true at it, `batchDone` is true when `more` is false, `sortNewestFirst` orders descending without mutating, and `nextCursor` keeps a newer current cursor.
- [ ] **Validation:** `node --test` exits 0; `test "$(grep -c 'newestOf' lib/scan.js)" -ge 2`; `test "$(grep -c 'backfillStart' lib/scan.js)" -ge 1`; `test "$(grep -c 'batchDone' lib/scan.js)" -ge 1`; `test "$(grep -c 'sortNewestFirst' lib/scan.js)" -ge 1`.

**Commit:** `<hash>` — `feat: add backfill and newest-alert scan helpers`

### Phase 2: Resumable backfill in the sync walk

**Goal:** Replace the manual-only history import with a persisted, batched backfill that runs inside the normal sync and survives a stopped or rate-limited run.

#### Tasks

- [ ] Add `AUTO_BACKFILL_PAGES = 20`, `MANUAL_BACKFILL_PAGES = 100` and `MAX_WALK_PAGES = 50` in `background.js`; retire `MAX_SYNC_PAGES` in favour of `MAX_WALK_PAGES` and keep the existing `OVERLAP_SEC`.
- [ ] Add `backfillState(state)`: return `state.backfill` when present; otherwise migrate `{ nextPage: 1, done: true }` when `state.historyDone` is set, and `{ nextPage: state.historyNextPage || 1, done: false }` otherwise. Stop writing `historyNextPage` and `historyDone` from the new code.
- [ ] Rewrite `syncNew(r, { batch })` as two loops: the existing page-1/overlap walk (stop on `shouldStop` or the end of the bell, break after page 1 on a first run, `newest = newestOf(items)` for the cursor), then a backfill loop that starts at `backfillStart({ nextPage, lastWalkedPage })`, fetches page by page with `PAGE_DELAY`, stores with `storeNew(normalize(items), { sendToWebhook: sendBackfill })`, and ends when `batchDone` is true or the bell ends.
- [ ] Persist `{ nextPage: <next unconsumed page>, done: !more, updatedAt: Date.now() }` after the backfill loop; on a capped new-alert walk, force the backfill from `lastWalkedPage + 1` even when `done` was true.
- [ ] Split the webhook gates: `sendNew` for the page-1/overlap walk (first run included when `webhookIncludeBackfill` is on) and `sendBackfill = webhookEnabled && webhookUrl && webhookIncludeBackfill` for backfill pages; keep `storeNew`'s `sendToWebhook` flag as the only writer of `outbox`.
- [ ] Return `{ cursor: next, syncGap: !backfill.done }` from `syncNew`; add notes for `backfill: pages A–B`, `backfill complete (reached the oldest alert)`, and `backfill paused at page N (batch)`.
- [ ] In `sync(trigger)`, drop `shallow` and pass `{ batch: trigger === 'manual' ? MANUAL_BACKFILL_PAGES : AUTO_BACKFILL_PAGES }`; on a first run the same walk stores page 1 and immediately consumes the automatic batch.
- [ ] Replace `importHistory(r)` with a call to `syncNew(r, { batch: MANUAL_BACKFILL_PAGES })` from the `importHistory` handler (kind `history`, trigger `manual`); change `resetHistory` to write `{ backfill: { nextPage: 1, done: false } }`; keep the handler names so `app.js` keeps working.
- [ ] Make `startRun` return `{ ok: false, status: 'busy', error: 'A run is already in progress' }` instead of the in-flight promise when `running` is set, and add the same reply when the run is already busy so the archive page can say so.
- [ ] Record `backfillFrom`/`backfillTo`/`backfillDone` on the sync-log entry (and the `syncDebug` page buffer) so a stopped backfill is visible without reading `state`.
- [ ] **Validation:** `node --test` exits 0; `test -z "$(grep 'shallow' background.js)"`; `test "$(grep -c 'AUTO_BACKFILL_PAGES' background.js)" -ge 2`; `test "$(grep -c 'MANUAL_BACKFILL_PAGES' background.js)" -ge 2`; `test "$(grep -c 'backfillState' background.js)" -ge 1`; `test "$(grep -c 'backfillStart' background.js)" -ge 1`; `test "$(grep -c 'batchDone' background.js)" -ge 1`; `test "$(grep -c "'busy'" background.js)" -ge 1`.

**Commit:** `<hash>` — `fix: backfill older alerts automatically in batches`

### Phase 3: Whole-bell gap audit and honest cursor

**Goal:** Make Check for gaps compare the entire bell GridPane still serves and report its newest gap by time, not by remote order.

#### Tasks

- [ ] Walk `gapAudit` from page 1 to `MAX_WALK_PAGES`, stopping on an empty page or `!willLoadMoreNoti`, and return `{ ok, checked, pages, done, missingCount, newest, oldest, missing }`.
- [ ] Sort `missing` with `sortNewestFirst`; return `newest` and `oldest` as `{ id, created_at, title }` (or `null`), and keep `missing` at 50 entries.
- [ ] Keep the audit read-only: no `setState`, no `outbox` writes, no cursor changes.
- [ ] Use `newestOf(items)` when a `syncNew` run records its cursor, and leave `nextCursor`'s never-regress guard in place.
- [ ] **Validation:** `node --test` exits 0; `test "$(grep -c 'MAX_WALK_PAGES' background.js)" -ge 2`; `test "$(grep -c 'sortNewestFirst' background.js)" -ge 1`; `test "$(grep -c 'newestOf' background.js)" -ge 2`; `test "$(grep -c 'oldest' background.js)" -ge 1`.

**Commit:** `<hash>` — `fix: audit the whole bell and sort gaps by time`

### Phase 4: Backfill progress in the archive page and docs

**Goal:** Show the backfill as it happens, turn the audit's advice into a button, and document the new behaviour.

#### Tasks

- [ ] In `app.html`, rename the manual history button to **Fill older history**, keep **Start over from page 1**, and add `<button id="sGapImport" class="btn ghost small" hidden>Import now</button>` beside `#sGapInfo`; update the card copy to say the backfill runs automatically and the button only catches up sooner.
- [ ] In `app.js` `renderSettingsInfo`, read `state.backfill` instead of `historyNextPage`/`historyDone`: label the button **Continue backfill (page N)** while unfinished, show «Older history complete.» when done, and leave the data line's `N alerts stored` intact.
- [ ] In `renderStatus`, when a run is not in progress and `state.backfill && !state.backfill.done`, show `Backfilling older alerts · next page N`; keep the existing signed-out, rate-limit, error and gap precedence.
- [ ] In the `state.syncGap` banner branch, say older alerts are still being collected automatically and offer **Fill older history**; update the copy from "run Import older history" to the button name.
- [ ] In `$('sGapAudit').onclick`, include `checked` and `pages` in the result, add `(stopped at the 50-page cap)` when `!r.done`, and reveal `#sGapImport` when `missingCount > 0`; wire `#sGapImport` to send `{ type: 'importHistory' }`.
- [ ] In `$('sHistory').onclick` and the import progress line, handle the new `busy` reply (`A run is already in progress`) without re-enabling the button.
- [ ] In `$('sWipe')`, reset `backfill: { nextPage: 1, done: false }` instead of `historyNextPage`/`historyDone`.
- [ ] In `README.md`, replace the "first sync stores only the newest page" and "manual import" wording: the first run starts the automatic backfill, each run collects a batch, **Fill older history** catches up sooner, and the audit covers the whole bell (up to 50 pages) with a truthful newest/oldest gap.
- [ ] Update the end-to-end Chrome follow-up in `plans/todos.md` to the new flow (reload, let the count reach the bell total, **Fill older history** for an immediate catch-up, audit reports no gaps, a forced 429 resumes at the same page).
- [ ] **Validation:** `node --test` exits 0; `test "$(grep -c 'Fill older history' app.html)" -ge 1`; `test "$(grep -c 'sGapImport' app.html)" -ge 1`; `test "$(grep -c 'sGapImport' app.js)" -ge 2`; `test "$(grep -c 'backfill' app.js)" -ge 3`; `test "$(grep -c 'automatic backfill' README.md)" -ge 1`; `test "$(grep -c 'whole bell' README.md)" -ge 1`.

**Commit:** `<hash>` — `feat: show backfill progress and whole-bell gaps`

### Phase 5: Testing & Verification

**Goal:** Prove the backfill finishes, the cursor stays honest and the audit reports the whole bell, and give the user a repeatable way to test it.

#### Tasks

- [ ] Run every command in **How to Test** and confirm each exits 0.
- [ ] Record the outcome of each **Manual / UI Checks** step in the closing reply.
- [ ] Record the test outcomes with `pgf test run 20261107-backfill-and-audit`.
- [ ] **Validation:** every command in `How to Test` produces the expected output.

#### How to Test

Prerequisites: Node 22, `python3`, and (for the manual checks) Chrome with the unpacked extension loaded and signed in to my.gridpane.com. No build step and no npm dependencies.

```bash
node --test
node scripts/package.mjs --check
test -z "$(grep 'shallow' background.js)"
test "$(grep -c 'newestOf' lib/scan.js)" -ge 2
test "$(grep -c 'backfillStart' lib/scan.js)" -ge 1
test "$(grep -c 'batchDone' lib/scan.js)" -ge 1
test "$(grep -c 'sortNewestFirst' lib/scan.js)" -ge 1
test "$(grep -c 'AUTO_BACKFILL_PAGES' background.js)" -ge 2
test "$(grep -c 'MANUAL_BACKFILL_PAGES' background.js)" -ge 2
test "$(grep -c 'backfillState' background.js)" -ge 1
test "$(grep -c 'MAX_WALK_PAGES' background.js)" -ge 2
test "$(grep -c 'sortNewestFirst' background.js)" -ge 1
test "$(grep -c "'busy'" background.js)" -ge 1
test "$(grep -c 'sGapImport' app.html)" -ge 1
test "$(grep -c 'backfill' app.js)" -ge 3
test "$(grep -c 'Fill older history' app.html)" -ge 1
test "$(grep -c 'automatic backfill' README.md)" -ge 1
```

Expected: `node --test` prints `pass` for every test and exits 0 (the new helpers add at least eight cases); the package check exits 0; every `test` line exits 0.

#### Manual / UI Checks

1. Reload the unpacked extension in `chrome://extensions`, keep a signed-in GridPane tab open, and press **Sync now**. Confirm the Sync log row reports `backfill: pages 2–21` (or up to the bell's end), the alert count in Settings rises by more than 8, and the status line reads `Backfilling older alerts · next page N` while more remains.
2. Wait for the next automatic run (or press **Sync now**) and confirm the count keeps climbing, then settles at the bell total; the banner clears when `state.backfill.done` is true.
3. Press **Check for gaps** with the backfill complete: confirm `No gaps in the newest N alerts (P pages)` with `N` equal to the whole bell the extension can see, and no misleading "newest" from an out-of-order insert (the three entries are sorted by time).
4. Delete all stored alerts, press **Fill older history**, and confirm the count reaches the bell total in one run without pressing anything else; confirm **Fill older history** during a run answers `A run is already in progress` instead of silently doing nothing.
5. Force a failure mid-backfill (sign out of GridPane or throttle the network), confirm the Sync log shows a `History import` row with `backfill paused at page N` and the next run resumes at that page rather than restarting at 1.

**Commit:** `<hash>` — `docs: record 20261107-backfill-and-audit verification`

## Summary

To be completed at close-out: what was asked, what was achieved, files changed, how to test, skills used, skill feedback, known issues, and commits.
