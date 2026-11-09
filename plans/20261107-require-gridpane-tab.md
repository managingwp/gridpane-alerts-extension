# 20261107-require-gridpane-tab

**Version:** 6
**Status:** Not Started
**Type:** feature

## Original Prompt

> Create PGF.
>
> When clicking sync alerts, we have to make sure that https://my.gridpane.com/ is an open tab. add this as a check!

## Plan Contract

- **Mission:** Refuse to start a GridPane read unless a my.gridpane.com tab is open, report the missing tab as its own state instead of a misleading sign-out, and let the user open or focus that tab in one click.
- **Execution Size:** medium — three code phases plus verification, each validated and committed separately.
- **Session Title:** GridPane tab check
- **Scope:** In scope: a pure tab-matching helper in `lib/tabs.js` with Node tests; a preflight in `background.js` for sync, history import, the gap audit and the manual name refresh; a `no_tab` state, badge and sync-log result; the archive page status label and banner with an **Open GridPane** action; the `scripts/package.mjs` runtime allowlist; the README and the store test instructions. Out of scope: auto-retrying a sync once the tab finishes loading; requiring the root path specifically; adding a `tabs` permission; changing `fetchDirect`, the overlap/cursor rules, rate limiting, webhook delivery or the stored alert shape; opening a tab from the automatic alarm; a new settings option for the check.
- **Success Metrics:** With no my.gridpane.com tab open, pressing **Sync now** makes zero GridPane requests, sets `state.status` to `no_tab`, shows the banner and the `!` badge, and records one manual sync-log entry; an automatic alarm in the same state updates the status without adding a sync-log entry per alarm; the banner's **Open GridPane** action focuses an existing tab or opens `https://my.gridpane.com/`, and the next **Sync now** succeeds; `fetchViaTab` never targets a discarded tab; `node --test`, `node scripts/package.mjs --check` and `pgf check` pass; the packaged zip contains `lib/tabs.js`; `manifest.json` gains no permission.
- **Touched paths:** lib/tabs.js, tests/tabs.test.mjs, background.js, app.js, scripts/package.mjs, README.md, store/listing.json, plans/tests.md
- **Version Target:** release-assigned (git-squash-release)
- **Approach / Architectural Fit:** Chrome withholds GridPane's session cookie from the extension's direct `fetch`, so the working path is `fetchViaTab` — a request executed inside an open `my.gridpane.com` tab. Today that need is discovered only after a failed direct fetch, and the failure is reported as "Not signed in", which sends the user to the login page when the real fix is to open the panel. Add a preflight to `startRun` (the only entry point for sync and history import): query tabs for `https://my.gridpane.com/*`, which the existing `host_permissions` already covers, and throw a typed `NoTabError` before any request. `handleRunError` maps it to `status: 'no_tab'`; `updateBadge` treats it as a warning; the archive page banner offers the one-click open. Manual GridPane actions that bypass `startRun` (gap audit, name refresh) call the same `requireGridPaneTab()`. The URL decision lives in `lib/tabs.js` so `node --test` can prove the matching rules without Chrome; `pickGridPaneTab` prefers a non-discarded tab, and `fetchViaTab` reuses it so the fallback cannot script an unloaded tab. Automatic no-tab runs deliberately write no sync-log row: at a five-minute alarm that would add 288 rows a day and push real runs out of the 1,000-entry log. The check needs no manifest change because URL-filtered `chrome.tabs.query` is allowed by the existing host permission.
- **References:** `background.js` (`startRun`, `handleRunError`, `fetchViaTab`, `updateBadge`, `handlers`), `app.js` (`renderStatus`, `RESULT_LABEL` / `RESULT_CLASS`, sync button), `app.html` (the generic `#banner`), `manifest.json` (`host_permissions`), `scripts/package.mjs` (`RUNTIME_FILES`), `tests/package.test.mjs` (allowlist assertion), `README.md` (How it works, Limits), `store/listing.json` (`testInstructions`), `plans/implemented/20261106-alert-gap-recovery.md` (PGF style and CLI-assertion pattern), skills `plan-generation-skill` and `lmt-skills-development-workflow`.

### Assumptions (marked, veto any of these before execution)

- **Any GridPane tab counts**, not only the root path: `https://my.gridpane.com/servers` satisfies the check. The copy names `https://my.gridpane.com/` because that is the URL the user opens.
- **The preflight covers every run and every manual GridPane action**, not only the **Sync now** button: automatic checks, history import, the gap audit and the manual name refresh all refuse without a tab. Automatic no-tab runs update status and badge but write no sync-log entry; manual attempts write exactly one.
- **Opening the tab does not auto-retry.** The new tab may still be loading or signed out, so the user presses **Sync now** once it is ready. Retrying after `chrome.tabs.onUpdated` is a possible follow-up, not part of this plan.
- **No new permission.** `host_permissions` already contains `https://my.gridpane.com/*`, which permits the URL-filtered `chrome.tabs.query`; adding `tabs` would broaden the store review for no benefit.
- **The banner reuses `#banner`** and its copy/button are built in `app.js`; no new markup or CSS is required.
- **The sync log gains a `no_tab` result** labelled "No GridPane tab"; existing stored log rows need no migration.

## Skills Used

- **Creation:** `plan-generation-skill` (PGF format, contract, testing phase), `lmt-skills-development-workflow` (explicit-path commits, push, secret-scan cadence).
- **Implementation:** `plan-generation-skill` (phase execution and close-out), `lmt-skills-development-workflow` (phase commits, pushes, scans), `chrome-extensions` (MV3 tab-query and permission rules).

## Phases

### Phase 1: Tab matching helper and tests

**Goal:** Put the "is this a GridPane tab?" decision in a pure module that Node can test without Chrome, and keep it in the packaged extension.

#### Tasks

- [ ] Create `lib/tabs.js` exporting `isGridPaneUrl(url)` and `pickGridPaneTab(tabs)`. `isGridPaneUrl` accepts only `https:` with hostname `my.gridpane.com` (case-insensitive) and any path, query or hash; it rejects `http:`, subdomains, lookalike hosts such as `notmy.gridpane.com`, non-strings and unparseable URLs. `pickGridPaneTab` returns the first matching non-discarded tab, or `null` when none is usable.
- [ ] Add `lib/tabs.js` to `RUNTIME_FILES` in `scripts/package.mjs` so the packaged zip imports it; confirm `tests/package.test.mjs` still passes without a literal count change.
- [ ] Add `tests/tabs.test.mjs` covering: the root URL with and without a trailing slash; a deep path, query and hash; mixed-case host; `http://`; a subdomain; a lookalike suffix; `undefined`/empty/invalid input; a mixed list picks the GridPane tab; a discarded GridPane tab is skipped; only a discarded match returns `null`; no match returns `null`.
- [ ] **Validation:** `node --test` exits 0 and reports the new tests; `node scripts/package.mjs --check` exits 0; `test "$(grep -c 'lib/tabs.js' scripts/package.mjs)" -ge 1`.

### Phase 2: Background preflight and `no_tab` state

**Goal:** Stop every GridPane read before the first request when no usable tab is open, and make the state visible without flooding the sync log.

#### Tasks

- [ ] Import `isGridPaneUrl` / `pickGridPaneTab` in `background.js`; add `GRIDPANE_ROOT = BASE + '/'`, `async function gridPaneTab()` (query `{ url: BASE + '/*' }` then `pickGridPaneTab`), `class NoTabError extends Error`, and `requireGridPaneTab()` which throws `NoTabError` with a message naming `https://my.gridpane.com/`.
- [ ] Change `fetchViaTab` to use `gridPaneTab()` instead of `tabs[0]`, so the fallback never targets a discarded tab and reports `NoTabError` when none is usable.
- [ ] Add a preflight to `startRun` before `setState({ syncing: true })`: call `requireGridPaneTab()` for the run kinds that read GridPane (sync and history). Let the thrown `NoTabError` flow through `handleRunError`.
- [ ] Handle `NoTabError` in `handleRunError`: set `{ status: 'no_tab', lastError: <message> }` and return `{ ok: false, status: 'no_tab', error }`. Leave `lastSync`, `cursor`, `backoffUntil` and `rateLimitStreak` untouched.
- [ ] Suppress the per-alarm log row: in `startRun`, skip `store.addLog` and the `syncDebug` push when the result is `no_tab` and the trigger is not `manual`; a manual `no_tab` still records one row so the click is auditable.
- [ ] Treat `no_tab` as a warning in `updateBadge`: `!` badge, amber background, title naming the missing tab.
- [ ] Add an `openGridPane` handler: query for a usable tab, focus it with `chrome.tabs.update({ active: true })` plus `chrome.windows.update({ focused: true })`, otherwise `chrome.tabs.create({ url: GRIDPANE_ROOT })`; return `{ ok: true, opened: 'focused' | 'created' }`.
- [ ] Gate the handlers that bypass `startRun`: `gapAudit` and `refreshLookups` await `requireGridPaneTab()` and return `{ ok: false, error }` when it throws. Leave `testWebhook`, `flushOutbox` and the other handlers untouched.
- [ ] Confirm `manifest.json` needs no change: the existing `https://my.gridpane.com/*` host permission authorises the URL-filtered tab query; do not add `tabs`.
- [ ] **Validation:** `node --test` exits 0; `test "$(grep -c 'NoTabError' background.js)" -ge 1`; `test "$(grep -c 'no_tab' background.js)" -ge 1`; `test "$(grep -c 'openGridPane' background.js)" -ge 1`; `test "$(grep -c 'pickGridPaneTab' background.js)" -ge 1`; `python3 -c "import json,sys; m=json.load(open('manifest.json')); sys.exit(0 if 'tabs' not in m.get('permissions',[]) else 1)"`.

### Phase 3: Archive page feedback and docs

**Goal:** Make the missing-tab state as clear as the sign-out state, with a working one-click open, and document the requirement.

#### Tasks

- [ ] In `renderStatus`, add `no_tab` to the "bad" class condition and show the label "GridPane tab not open" when not syncing.
- [ ] Add a `no_tab` banner branch before the sign-out branch: "GridPane needs an open my.gridpane.com tab." plus an **Open GridPane** button that sends `{ type: 'openGridPane' }` and re-renders; keep the existing sign-out, rate-limit, error and gap branches unchanged.
- [ ] Add `no_tab: 'No GridPane tab'` to `RESULT_LABEL` and `no_tab: 'warning'` to `RESULT_CLASS` so the sync-log row renders like the other recoverable problems.
- [ ] Update the README: the install step and the "How it works" tab paragraph state that manual and automatic checks need an open my.gridpane.com tab, and that the banner's **Open GridPane** button opens or focuses it.
- [ ] Update `store/listing.json` `testInstructions` so a reviewer is told to keep the signed-in GridPane tab open; the summary stays within 132 characters.
- [ ] **Validation:** `node --test` exits 0; `node scripts/package.mjs --check` exits 0; `test "$(grep -c 'no_tab' app.js)" -ge 1`; `test "$(grep -c 'Open GridPane' app.js)" -ge 1`; `test "$(grep -c 'my.gridpane.com tab' README.md)" -ge 1`.

### Phase 4: Testing & Verification

**Goal:** Prove the check blocks before any request, recovers after the tab opens, and leaves the existing sign-out and rate-limit behaviour intact.

#### Tasks

- [ ] Run every command in **How to Test** and confirm each exits 0.
- [ ] Record the outcome of each **Manual / UI Checks** step in the closing reply.
- [ ] Record the test outcomes with `pgf test run 20261107-require-gridpane-tab`.
- [ ] **Validation:** every command in `How to Test` produces the expected output.

#### How to Test

Prerequisites: Node 22 and `python3`; no build step and no npm dependencies. The package check reads the working tree only.

```bash
node --test
node scripts/package.mjs --check
test "$(grep -c "from './lib/tabs.js'" background.js)" -ge 1
test "$(grep -c 'NoTabError' background.js)" -ge 1
test "$(grep -c 'no_tab' background.js)" -ge 1
test "$(grep -c 'openGridPane' background.js)" -ge 1
test "$(grep -c 'pickGridPaneTab' background.js)" -ge 1
test "$(grep -c 'lib/tabs.js' scripts/package.mjs)" -ge 1
test "$(grep -c 'no_tab' app.js)" -ge 1
test "$(grep -c 'Open GridPane' app.js)" -ge 1
test "$(grep -c 'my.gridpane.com tab' README.md)" -ge 1
python3 -c "import json,sys; m=json.load(open('manifest.json')); sys.exit(0 if 'tabs' not in m.get('permissions',[]) else 1)"
```

Expected: `node --test` prints `pass` for every test and exits 0; the package check exits 0; each `test` line exits 0; the manifest permission list still has no `tabs` entry.

#### Manual / UI Checks

1. Build `dist/unpacked/`, load it from `chrome://extensions`, close every `my.gridpane.com` tab, then press **Sync now**. Confirm the status reads "GridPane tab not open", the banner offers **Open GridPane**, the badge shows `!`, and the Sync log gains one manual row with "No GridPane tab" and no request count.
2. Press **Open GridPane** with no GridPane tab open: confirm `https://my.gridpane.com/` opens. Press it again with that tab open: confirm the existing tab is focused rather than a second one created. Sign in if needed, then press **Sync now** and confirm the run succeeds and the banner clears.
3. Leave no GridPane tab open and wait for an automatic alarm (or shorten the interval in Settings). Confirm the status and badge change to the no-tab state without a new Sync log row for each alarm.
4. Regression: with a GridPane tab open but signed out, confirm the existing "Not signed in" banner still appears; with a 429 response, confirm the rate-limit pause still appears and **Sync now** still ignores it.

**Commit:** pending

## Summary

To be completed at close-out: what was asked, what was achieved, files changed, how to test, skills used, skill feedback, known issues, and commits.
