# 20261111-sync-resilience

**Version:** 6
**Status:** ✅ Implemented (2026-11-11)
**Commit:** `b3e54ff` — `docs: close out 20261111-sync-resilience`
**Type:** feature

## Original Prompt

> Can you take the todos and create a PGF?
>
> Source todos (from `plans/todos.md` before the move): #5 — "Consider making the 2-hour overlap a setting if a busier fleet needs a different window"; #10 — "Consider retrying the sync once the GridPane tab finishes loading (chrome.tabs.onUpdated) instead of asking the user to press Sync now".
>
> Scaffolded with `pgf todo plan --only 5,10 --move --name sync-resilience`.

## Plan Contract

- **Mission:** Make the catch-up overlap a bounded setting (2 hours by default) and retry an automatic sync once when a GridPane tab finishes loading after a no-tab check, so a newly opened panel catches up without the user pressing **Sync now**.
- **Execution Size:** medium — pure helpers and tests, background wiring, Settings copy and docs, then verification.
- **Session Title:** Sync resilience settings
- **Scope:** In scope: `overlapSeconds()` in `lib/scan.js`; `shouldRetryOnTabLoad()` in `lib/tabs.js`; `DEFAULTS.overlapHours` and the `syncNew` floor in `background.js`; a `chrome.tabs.onUpdated` listener with a cooldown; the Settings **Sync** card input and `loadSettings`/`saveSettings`; the README, `docs/PRIVACY.md` and the store test instructions. Out of scope: changing the cursor algorithm, backfill budgets, rate-limit backoff, gap audit or webhook behaviour; retrying after a sign-out, error or 429; watching tab URLs for any host other than `my.gridpane.com`; a second retry loop or a timer; adding the `tabs` permission; changing the minimum poll interval; a version bump.
- **Success Metrics:** Settings shows a **Catch-up overlap** input defaulting to 2 hours; saving 0.5 stores `overlapHours: 0.5` and the next run's floor is 30 minutes below the cursor; saving 48 clamps to 24 hours; a non-numeric value falls back to 2 hours. With `state.status` at `no_tab`, opening `https://my.gridpane.com/` and letting it finish loading starts exactly one automatic sync within the cooldown; a second/third GridPane tab completing within 30 seconds starts no further run, and a reload after the cooldown starts one more. A tab completing while the status is `ok`, `signed_out`, `error` or `rate_limited` starts no run. The retry obeys `backoffUntil`, so a 429 pause is not bypassed. `node --test`, `node scripts/package.mjs --check` and `pgf check` pass; `manifest.json` gains no permission.
- **Touched paths:** lib/scan.js, lib/tabs.js, tests/scan.test.mjs, tests/tabs.test.mjs, background.js, app.html, app.js, README.md, docs/PRIVACY.md, store/listing.json, plans/tests.md, plans/20261111-sync-resilience.md
- **Version Target:** release-assigned (git-squash-release)
- **Version Note:** No version bump in this plan; the release helper owns the version.
- **Approach / Architectural Fit:** Both changes refine the existing "keep the archive current" loop and reuse decisions that are already pure. The overlap is currently `OVERLAP_SEC = 2 * 3600` in `background.js`, used once for `floor = cursor.created_at - OVERLAP_SEC` and again in the capped-walk note. Move the conversion into `lib/scan.js` as `overlapSeconds(hours)`: default 2 hours for a missing or invalid value, clamp to 0.5–24 hours, and return whole seconds. `syncNew` reads `settings.overlapHours` through it, so the default behaviour is byte-identical while a busier fleet can widen or narrow the window. The retry is event-driven, not a poll: `chrome.tabs.onUpdated` already fires for a `my.gridpane.com` tab because the existing host permission exposes its URL, so no `tabs` permission is needed. The decision lives in `lib/tabs.js` as `shouldRetryOnTabLoad({ status, complete, url, now, lastRetryAt, cooldownMs })`: only `status === 'no_tab'`, a completed load on an exact `https:` GridPane URL, and a 30-second cooldown qualify. The listener reads current state, calls the existing `sync('auto')` (which honours `backoffUntil` and the single-run guard), and records the retry timestamp in memory. A retry after a successful load clears `no_tab` on its own; a sign-out sets `signed_out`, which the predicate rejects, so there is no loop. Settings load/save both cap and coerce the value, and the muted copy names the default and range.
- **References:** `background.js` (`OVERLAP_SEC`, `DEFAULTS`, `syncNew` floor and capped note, `sync`, `startRun`, `updateBadge`, alarm/listener wiring, `handleRunError`), `lib/scan.js` (`pageOldest`, `shouldStop`, `nextCursor`), `lib/tabs.js` (`isGridPaneUrl`, `pickGridPaneTab`), `tests/scan.test.mjs` and `tests/tabs.test.mjs` (test style), `app.html` (Settings **Sync** card), `app.js` (`loadSettings`, `saveSettings`), `README.md` (How it works, Needs an open GridPane tab), `docs/PRIVACY.md` (stored settings), `store/listing.json` (`testInstructions`), `plans/implemented/20261106-alert-gap-recovery.md` (overlap origin and settings style), `plans/implemented/20261107-require-gridpane-tab.md` (tab preflight and the deferred retry), Chrome `tabs.onUpdated` documentation (`changeInfo.status`, URL visibility with host permission), skills `plan-generation-skill`, `lmt-skills-development-workflow` and `chrome-extensions`.

### Assumptions (marked, veto any of these before execution)

- **The overlap is expressed in hours**, default 2, allowed 0.5–24, step 0.5. This covers a busier fleet that needs a wider window and a fast fleet that needs a narrower one without exposing seconds in the UI.
- **The retry is one event, not a loop.** Only a real `complete` load of an exact `https://my.gridpane.com` tab qualifies, only while the last state is `no_tab`, and at most once per 30 seconds. There is no timer, no polling and no retry after sign-out/error/429.
- **The retry uses `sync('auto')`**, so it takes the automatic backfill batch, respects `backoffUntil`, and writes a normal automatic Sync log row when it runs. It never pretends to be a manual run.
- **A tab that loads while the status is not `no_tab` is ignored.** If an alarm run already cleared the state or replaced it with `signed_out`, the user still presses **Sync now**; the retry is for the missing-tab case only.
- **No new permission.** `https://my.gridpane.com/*` already exposes the tab URL to `onUpdated`; do not add `tabs`.
- **The default stays 2 hours**, so existing behaviour and the README's current description remain true unless the user changes the setting.
- **The overlap setting is part of the stored settings object**, so it is disclosed in the privacy policy alongside the check interval.

## Skills Used

- **Creation:** `plan-generation-skill` (PGF format, contract, testing phase), `lmt-skills-development-workflow` (explicit-path commits, push, secret-scan cadence).
- **Implementation:** `plan-generation-skill` (phase execution and close-out), `lmt-skills-development-workflow` (phase commits, pushes, secret scans), `chrome-extensions` (MV3 `tabs.onUpdated` and host-permission URL visibility).

## Phases

### Phase 1: Pure overlap and retry decisions

**Goal:** Put both new decisions in Node-testable modules before wiring any Chrome event.

#### Tasks

- [x] Add `overlapSeconds(hours)` to `lib/scan.js`: `Number(hours)`; a non-finite or `<= 0` value becomes 2 hours; clamp to 1,800–86,400 seconds (0.5–24 hours); return `Math.round(hours * 3600)`. Document that the default preserves the old `OVERLAP_SEC`.
- [x] Add `shouldRetryOnTabLoad({ status, complete, url, now, lastRetryAt, cooldownMs = 30000 })` to `lib/tabs.js`: return `true` only when `complete` is true, `status === 'no_tab'`, `isGridPaneUrl(url)` is true, and `now - Number(lastRetryAt || 0) >= cooldownMs`. A missing/zero `lastRetryAt` counts as never retried.
- [x] Extend `tests/scan.test.mjs` with the overlap cases: `undefined`, `NaN`, `'abc'` and `0` → 7,200; `0.5` → 1,800; `1` → 3,600; `1.25` → 4,500; `2` → 7,200; `24` → 86,400; `48` → 86,400; `'2'` → 7,200.
- [x] Extend `tests/tabs.test.mjs` with the retry cases: true for `no_tab` + complete + valid URL after the cooldown; false for `ok`, `signed_out`, `error`, `rate_limited`, an incomplete load, `http://`, a subdomain, a lookalike host, and a call inside the cooldown; true exactly at the cooldown boundary; true when `lastRetryAt` is missing or zero.
- [x] **Validation:** `node --test` exits 0 and reports the new cases; `node scripts/package.mjs --check` exits 0; `test "$(grep -c 'function overlapSeconds' lib/scan.js)" -ge 1`; `test "$(grep -c 'function shouldRetryOnTabLoad' lib/tabs.js)" -ge 1`.

**Commit:** `7d01390` — `feat: add overlap and tab-load retry helpers`

### Phase 2: Background wiring and settings

**Goal:** Read the overlap from settings, keep the default identical, and retry exactly once when a missing GridPane tab finishes loading.

#### Tasks

- [x] In `background.js`, import `overlapSeconds` from `./lib/scan.js` and `shouldRetryOnTabLoad` from `./lib/tabs.js`; add `overlapHours: 2` to `DEFAULTS` with the allowed range in a comment.
- [x] In `syncNew`, replace `OVERLAP_SEC` with `const overlap = overlapSeconds(settings.overlapHours)` and `const floor = cursor ? cursor.created_at - overlap : 0`. Update the capped-walk note to name the effective window (`overlap / 3600` hours) instead of the constant. Remove `OVERLAP_SEC` if nothing else uses it.
- [x] Add a module-level `let lastTabRetry = 0;` and a top-level `chrome.tabs.onUpdated` listener. On `changeInfo.status === 'complete'`, read `getState()` and build the predicate inputs with `url: tab?.url || changeInfo.url`. When `shouldRetryOnTabLoad` is true, set `lastTabRetry = Date.now()` and `await sync('auto')`; wrap the body in `try {} catch {}` so a storage hiccup cannot break tab updates.
- [x] Confirm the retry cannot loop or bypass a pause: `sync('auto')` already returns `waiting` while `backoffUntil` is in the future, `startRun` rejects a concurrent run, and a successful retry sets `status: 'ok'` while a sign-out sets `signed_out`, both of which the predicate rejects. Do not add a timer, alarm or second listener.
- [x] In `app.js` `loadSettings`, default and load `overlapHours` into `#sOverlap`; in `saveSettings`, parse it as a float, fall back to 2 for a non-number, clamp to 0.5–24, and include it in the saved settings object. Leave the other keys unchanged.
- [x] **Validation:** `node --test` exits 0; `test "$(grep -c 'overlapSeconds' background.js)" -ge 1`; `test "$(grep -c 'shouldRetryOnTabLoad' background.js)" -ge 1`; `test "$(grep -c 'chrome.tabs.onUpdated' background.js)" -ge 1`; `test "$(grep -c 'overlapHours' background.js)" -ge 1`; `test "$(grep -c 'overlapHours' app.js)" -ge 1`; `python3 -c "import json,sys; m=json.load(open('manifest.json')); sys.exit(0 if 'tabs' not in m.get('permissions',[]) else 1)"`.

**Commit:** `e5b0257` — `feat: wire the overlap setting and tab-load retry`

### Phase 3: Settings UI and documentation

**Goal:** Make the window configurable without reading the code, and describe the automatic retry accurately.

#### Tasks

- [x] In `app.html` (Settings **Sync** card), add `Catch-up overlap <input id="sOverlap" type="number" min="0.5" max="24" step="0.5"> hours` beside the poll interval, and rewrite the muted paragraph to say the overlap is configurable (2 hours by default, 0.5–24) and that alerts GridPane adds late are still stored.
- [x] Update `README.md` **How it works**: replace "a 2-hour overlap" with the configurable window and its default/range; add one sentence to **Needs an open my.gridpane.com tab** that opening the tab after a no-tab check retries the sync automatically, once per load, and that sign-out, errors and rate limits are not auto-retried.
- [x] Update `docs/PRIVACY.md` so the stored settings list names the overlap window, and update `store/listing.json` `testInstructions` with one sentence that the first check runs when the signed-in tab finishes loading. Keep the summary and justifications unchanged.
- [x] **Validation:** `node --test` exits 0; `node scripts/package.mjs --check` exits 0; `test "$(grep -c 'sOverlap' app.html)" -ge 1`; `test "$(grep -c 'Catch-up overlap' app.html)" -ge 1`; `test "$(grep -c '0.5–24' README.md)" -ge 1`; `test "$(grep -c 'retries the sync' README.md)" -ge 1`; `test "$(grep -c 'overlap window' docs/PRIVACY.md)" -ge 1`.

**Commit:** `a37b702` — `docs: describe the overlap setting and tab-load retry`; `17a4846` — `docs: clarify the tab-load retry copy`

### Phase 4: Testing & Verification

**Goal:** Prove the setting changes the floor without changing the default, and that the retry fires once for a missing tab and never for the other states.

#### Tasks

- [x] Run every command in **How to Test** and confirm each exits 0.
- [x] Record the outcome of each **Manual / UI Checks** step in the closing reply.
- [x] Record the test outcomes with `pgf test run 20261111-sync-resilience`.
- [x] **Validation:** every command in **How to Test** produces the expected output.

> **Notes:** all 13 `How to Test` commands passed on 2026-11-11 and are recorded in `plans/tests.md`. The five **Manual / UI Checks** need a live Chrome profile with the unpacked extension; they were not run in this session and are filed as a follow-up todo, with the outcome stated in the closing reply.

#### How to Test

Prerequisites: Node 22 and `python3`; no build step and no npm dependencies. The `node -e` checks exercise the pure helpers without Chrome.

```bash
node --test
node scripts/package.mjs --check
test "$(grep -c 'function overlapSeconds' lib/scan.js)" -ge 1
test "$(grep -c 'function shouldRetryOnTabLoad' lib/tabs.js)" -ge 1
test "$(grep -c 'overlapSeconds' background.js)" -ge 1
test "$(grep -c 'shouldRetryOnTabLoad' background.js)" -ge 1
test "$(grep -c 'chrome.tabs.onUpdated' background.js)" -ge 1
test "$(grep -c 'sOverlap' app.html)" -ge 1
test "$(grep -c 'Catch-up overlap' app.html)" -ge 1
test "$(grep -c 'retries the sync' README.md)" -ge 1
node -e "import('./lib/scan.js').then(({ overlapSeconds }) => { if (overlapSeconds(undefined) !== 7200 || overlapSeconds(0) !== 7200 || overlapSeconds(2) !== 7200 || overlapSeconds(48) !== 86400 || overlapSeconds('abc') !== 7200) process.exit(1); })"
node -e "import('./lib/tabs.js').then(({ shouldRetryOnTabLoad }) => { const base = { status: 'no_tab', complete: true, url: 'https://my.gridpane.com/servers', now: 60000, lastRetryAt: 0 }; if (!shouldRetryOnTabLoad(base)) process.exit(1); if (shouldRetryOnTabLoad({ ...base, status: 'ok' })) process.exit(1); if (shouldRetryOnTabLoad({ ...base, url: 'http://my.gridpane.com/' })) process.exit(1); if (shouldRetryOnTabLoad({ ...base, lastRetryAt: 45000 })) process.exit(1); })"
python3 -c "import json,sys; m=json.load(open('manifest.json')); sys.exit(0 if 'tabs' not in m.get('permissions',[]) else 1)"
```

Expected: `node --test` passes all 60 tests; the package check reports 13 runtime files; every `test` line exits 0; both `node -e` checks exit 0; the manifest still has no `tabs` permission.

#### Manual / UI Checks

1. Load `dist/unpacked/`, open Settings, and confirm **Catch-up overlap** reads `2` hours. Change it to `0.5`, save, and confirm it persists after reloading the page.
2. With a GridPane tab open, press **Sync now**, then inspect the service worker console with `chrome.storage.local.get('syncDebug')`. Confirm the newest entry's `floor` is 1,800 seconds below the cursor's `created_at` (not 7,200). Set the value to `48`, save, run again, and confirm the saved value clamps to 24 and the floor is 86,400 seconds.
3. Close every GridPane tab and press **Sync now**. Confirm the usual no-tab status, banner and badge appear. Open `https://my.gridpane.com/`, sign in if needed, and let it finish loading. Confirm a sync starts without pressing **Sync now** and that the Sync log records one automatic run; the status clears on success.
4. Reload the GridPane tab twice within 30 seconds. Confirm no extra sync runs. Wait more than 30 seconds, reload once, and confirm one more automatic run.
5. Regression: with the extension signed out (or a forced 429 pause), open a GridPane tab. Confirm no automatic run starts; the existing sign-out/rate-limit banner and **Sync now** behaviour are unchanged.

## Summary

- **What was asked:** "Consider making the 2-hour overlap a setting if a busier fleet needs a different window" and "Consider retrying the sync once the GridPane tab finishes loading (chrome.tabs.onUpdated) instead of asking the user to press Sync now".
- **What was achieved:** The catch-up overlap is now `settings.overlapHours` (default 2 hours, clamped to 0.5–24) and `lib/scan.js` owns the conversion through `overlapSeconds()`. A missing, invalid or `<= 0` value keeps the old two-hour default, so existing behaviour is unchanged. `syncNew` uses the effective window in both the cursor floor and the capped-walk note. `lib/tabs.js` adds `shouldRetryOnTabLoad()`, and `background.js` registers a top-level `chrome.tabs.onUpdated` listener that retries `sync('auto')` once when an exact `https://my.gridpane.com` tab finishes loading after a `no_tab` run. The listener filters unrelated tab loads before reading stored state, uses a 30-second in-memory cooldown, obeys `backoffUntil`, defers to `startRun`'s single-run guard, and ignores `ok`, `signed_out`, `error` and `rate_limited` states. Settings gains a **Catch-up overlap** input (0.5–24 hours, step 0.5); load and save both coerce and clamp the value. `manifest.json` gains no permission.
- **Files changed:** `lib/scan.js`, `lib/tabs.js`, `tests/scan.test.mjs`, `tests/tabs.test.mjs`, `background.js`, `app.html`, `app.js`, `README.md`, `docs/PRIVACY.md`, `store/listing.json`, `plans/tests.md`, `plans/20261111-sync-resilience.md`.
- **How to test:** from the repository root, Node 22 and `python3`; no build step and no npm dependencies. All 13 commands in **How to Test** passed on 2026-11-11 and are recorded in `plans/tests.md`; `node --test` reports 60 passing tests and the package check reports 13 runtime files.
- **Manual checks:** not run — all five need a live Chrome profile with the signed-in unpacked extension. They are filed as a follow-up todo: the overlap defaults to 2 and persists at 0.5/24, the floor changes from 7,200 to 1,800/86,400 seconds, opening a tab after a no-tab run starts one automatic sync, rapid reloads stay inside the 30-second cooldown, and sign-out/429 states do not auto-retry.
- **Skills used:** creation — `plan-generation-skill`, `lmt-skills-development-workflow`; implementation — `plan-generation-skill`, `lmt-skills-development-workflow`, `chrome-extensions`.
- **Skill feedback:** None.
- **Known issues / suggestions:**
  - The five **Manual / UI Checks** have not been run — load `dist/unpacked/` in Chrome and follow the plan's steps.
  - A tab that is already open when the no-tab check runs does not fire `onUpdated`; only a fresh load (or reload) triggers the retry, which matches the todo's wording. Retrying against an already-open tab would need a separate trigger.
  - `pgf next` still ranks the abandoned Google Sheets plan at #3. It holds no lock and was not started; archiving it when convenient would make #4 the first queue item.
- **Commits:** `7d01390` feat: add overlap and tab-load retry helpers; `d16fc89` docs: record phase 1; `e5b0257` feat: wire the overlap setting and tab-load retry; `28bf633` docs: record phase 2; `a37b702` docs: describe the overlap setting and tab-load retry; `17a4846` docs: clarify the tab-load retry copy; `b3e54ff` docs: close out 20261111-sync-resilience.
