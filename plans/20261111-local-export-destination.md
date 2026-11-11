# 20261111-local-export-destination

**Version:** 6
**Status:** ⏸ On Hold
**Type:** feature

## Original Prompt

> You should draft all options.
>
> Drafted from the decision record `docs/reference/storage-decisions.md` as option A. Parked on hold until the storage decision chooses it. Do not execute while any sibling option is chosen instead.

## Plan Contract

- **Mission:** Add a durable local snapshot option to the archive page: one button downloads the full archive as JSON or NDJSON, and one button saves the same snapshot to a folder the user chooses and remembers, so the history survives an uninstall and is readable by Claude Code/desktop and local scripts.
- **Execution Size:** small — a pure snapshot model, the archive-page buttons and folder handle, documentation, and verification.
- **Session Title:** Local archive snapshot
- **Scope:** In scope: `lib/snapshot.js` (`snapshotJSON`, `snapshotNDJSON`, `snapshotFilename`) with Node tests; a **Backup** area in the existing Data card with **Download JSON**, **Download NDJSON** and **Save to folder**; `showDirectoryPicker()` from the archive page, the handle stored in the existing `kv` IndexedDB store, and a permission re-check before a write; `RUNTIME_FILES`; README. Out of scope: a service-worker picker (the page needs the user gesture); `chrome.downloads` (the anchor download needs no permission); automatic background writes on every sync; a scheduled snapshot; syncing the file to a cloud service; reading the file back into the archive (import); changing the archive schema; a version bump.
- **Success Metrics:** With a populated archive, **Download JSON** produces one file containing every stored alert, newest first, with the same resolved server/site names as the archive; **Download NDJSON** produces one valid JSON object per line; both work with no new permission and no network request. **Save to folder** opens the directory picker once, writes `gridpane-alerts-<timestamp>.json` (or `.ndjson`) to the chosen folder, and remembers the handle across page reloads. After a reload, **Save to folder** reuses the remembered folder when permission is still granted; when it is not, it asks for the folder again instead of failing silently. An empty archive produces a valid file with zero alerts rather than an error. `node --test`, `node scripts/package.mjs --check` and `pgf check` pass; `manifest.json` gains no permission.
- **Touched paths:** lib/snapshot.js, tests/snapshot.test.mjs, app.html, app.js, scripts/package.mjs, README.md, plans/tests.md, plans/20261111-local-export-destination.md
- **Version Target:** release-assigned (git-squash-release)
- **Version Note:** No version bump in this plan; the release helper owns the version.
- **Approach / Architectural Fit:** The archive page already has every record in memory (`ui.all`) and every lookup (`ui.lookups`), so the snapshot is a pure serialization, not a new store. `lib/snapshot.js` owns the JSON and NDJSON shapes and the filename, so Node can prove the export without Chrome. The page writes the file in one of two ways: an anchor with a Blob URL (the default, no permission, lands in the browser's download folder) or `showDirectoryPicker()` plus a writable stream (the chosen-folder path, no extension permission, needs a user gesture). A `FileSystemDirectoryHandle` is structured-cloneable, so the existing `kv` store can hold it; `db.js` needs no schema change. The handle is re-checked with `queryPermission()` before a write and re-requested with `requestPermission()` from the click when needed, because browser permission can lapse across restarts. The snapshot is additive: it never changes IndexedDB, never deletes anything, and never sends data anywhere. The Data card is the natural home, beside the existing delete action, and the copy states that the file is the user's own copy and that uninstalling the extension deletes the browser archive.
- **References:** `app.js` (`ui.all`, `ui.lookups`, `render`, `exportJson`, `exportCsv`, `copyOut`, the Settings/Data wiring), `app.html` (Data card), `db.js` (`kvGet`/`kvSet`, the existing `kv` store), `normalize.js` (`resolve`, `webhookPayload` full notification for the record shape), `scripts/package.mjs` (`RUNTIME_FILES`), `README.md` (Archive page, Limits), `docs/reference/storage-decisions.md` (option A), `plans/implemented/20261111-storage-destinations.md` (decision gate), MDN File System API and Chrome File System Access documentation, skills `plan-generation-skill`, `lmt-skills-development-workflow` and `chrome-extensions`.

### Assumptions (marked, veto any of these before execution)

- **"Local" means the user's own machine.** The snapshot is readable by Claude Code/desktop and local scripts; Claude in Chrome cannot read a local file, so this option does not satisfy the remote-read requirement by itself.
- **The snapshot is a point-in-time copy, not a live mirror.** The user presses the button (or saves again) when they want a fresh copy. There is no background writer, because a service worker cannot show the picker or reliably re-request a handle.
- **Two write paths:** a download (no permission) and a chosen folder (File System Access). The download is the default because it always works; the folder path is for a stable location.
- **No `downloads` permission.** The anchor download uses a Blob URL in the extension page, so the manifest and store review are unchanged.
- **The full archive is exported, not the filtered view.** The existing CSV/JSON export exports what is filtered; the snapshot is a backup and always contains every stored alert, newest first. The copy says so.
- **The file contains the same resolved names as the archive.** The snapshot does not dump raw GridPane JSON; it uses the stored record plus `resolve()`, so it reads like the archive.
- **NDJSON is one object per line, with newlines inside a message escaped by JSON.stringify.** No record can break the line format.
- **An empty archive is a valid snapshot.** The file is written with an empty array (or zero lines) and a timestamp.

## Skills Used

- **Creation:** `plan-generation-skill` (PGF format, contract, testing phase), `lmt-skills-development-workflow` (explicit-path commits, push, secret-scan cadence).
- **Implementation:** `plan-generation-skill`, `lmt-skills-development-workflow`, `chrome-extensions` (extension page, Blob download), MDN File System API documentation.

## Phases

### Phase 1: Snapshot model and tests

**Goal:** Fix the JSON/NDJSON shape and the filename in one pure module.

#### Tasks

- [ ] Create `lib/snapshot.js` exporting `snapshotRecord(rec, lookups)`, `snapshotJSON(records, lookups, now)`, `snapshotNDJSON(records, lookups, now)` and `snapshotFilename(now, ext)`. The record contains the normalized fields plus `server_label`, `server_ip` and `site_url`; the JSON envelope is `{ exported_at, count, alerts: [...] }`; the NDJSON output is one `JSON.stringify(record)` per line with no envelope; the filename is `gridpane-alerts-<YYYY-MM-DDTHH-mm-ss>.json` (or `.ndjson`).
- [ ] Add `lib/snapshot.js` to `RUNTIME_FILES` in `scripts/package.mjs`.
- [ ] Add `tests/snapshot.test.mjs` covering: the record shape and resolved names; newest-first ordering; the JSON envelope and count; one line per alert in NDJSON; a message containing a newline does not add a line; an empty archive producing `count: 0` and an empty NDJSON string; the filename format and extension; and that the input array is not mutated.
- [ ] **Validation:** `node --test` exits 0; `node scripts/package.mjs --check` exits 0; `test "$(grep -c 'snapshotJSON' lib/snapshot.js)" -ge 1`; `test "$(grep -c 'lib/snapshot.js' scripts/package.mjs)" -ge 1`.

### Phase 2: Archive page buttons and folder handle

**Goal:** Let the user download a snapshot or save it to a remembered folder, with a clear status line.

#### Tasks

- [ ] In `app.html` (Data card), add a **Backup** block: **Download JSON**, **Download NDJSON**, **Save to folder**, **Forget folder**, and a `#snapMsg` status line. The copy states that the snapshot contains every stored alert, newest first, and that it stays on the user's machine.
- [ ] In `app.js`, implement `downloadSnapshot(format)` (build the string, create a Blob, click an anchor, revoke the URL), `saveSnapshot(format)` (`showDirectoryPicker()` when no handle is stored, then `queryPermission`/`requestPermission`, `createWritable`, write, close, and store the handle with `kvSet('snapshotDir', handle)`), `forgetSnapshotFolder()` (`store.kvSet('snapshotDir', null)`), and `renderSnapshotInfo()` (show the remembered folder name or "No folder chosen").
- [ ] Reuse the existing `ui.all` and `ui.lookups`; do not add a new IndexedDB store or DB version. Handle `AbortError` from the picker and a denied permission with a friendly message, not a thrown error.
- [ ] Wire the buttons and call `renderSnapshotInfo()` when Settings opens or the page loads. Leave the existing CSV/JSON filtered export and delete action untouched.
- [ ] **Validation:** `node --test` exits 0; `node scripts/package.mjs --check` exits 0; `test "$(grep -c 'showDirectoryPicker' app.js)" -ge 1`; `test "$(grep -c 'snapshotDir' app.js)" -ge 1`; `test "$(grep -c 'Download JSON' app.html)" -ge 1`; `test "$(grep -c 'Save to folder' app.html)" -ge 1`.

### Phase 3: Documentation

**Goal:** Explain what the snapshot contains, where it goes and what it does not solve.

#### Tasks

- [ ] Update `README.md` with a **Backup snapshot** section: the two download formats, the chosen-folder path and the remembered handle, the full-archive (not filtered) behaviour, and the note that Claude Code/desktop and local scripts can read it while Claude in Chrome cannot.
- [ ] Update the README **Limits** line to point at the snapshot as the way to keep a copy before uninstalling; keep the existing "export first" wording accurate.
- [ ] **Validation:** `node --test` exits 0; `node scripts/package.mjs --check` exits 0; `test "$(grep -c 'Backup snapshot' README.md)" -ge 1`; `test "$(grep -c 'Save to folder' README.md)" -ge 1`; `test "$(grep -c 'Claude' README.md)" -ge 1`.

### Phase 4: Testing & Verification

**Goal:** Prove both formats contain the whole archive and that the folder handle survives a reload.

#### Tasks

- [ ] Run every command in **How to Test** and confirm each exits 0.
- [ ] Record the outcome of each **Manual / UI Checks** step in the closing reply.
- [ ] Record the test outcomes with `pgf test run 20261111-local-export-destination`.
- [ ] **Validation:** every command in **How to Test** produces the expected output.

#### How to Test

Prerequisites: Node 22; no build step and no npm dependencies. The File System Access calls are a manual check in Chrome.

```bash
node --test
node scripts/package.mjs --check
test "$(grep -c 'snapshotJSON' lib/snapshot.js)" -ge 1
test "$(grep -c 'lib/snapshot.js' scripts/package.mjs)" -ge 1
test "$(grep -c 'showDirectoryPicker' app.js)" -ge 1
test "$(grep -c 'snapshotDir' app.js)" -ge 1
test "$(grep -c 'Download JSON' app.html)" -ge 1
node -e "import('./lib/snapshot.js').then(({ snapshotJSON, snapshotNDJSON, snapshotFilename }) => { const recs = [{ id: 'b', created_at: 2, title: 'B', message: 'line1\nline2', severity: 'info', server_id: null, site_id: null }, { id: 'a', created_at: 1, title: 'A', message: 'm', severity: 'warning', server_id: null, site_id: null }]; const j = JSON.parse(snapshotJSON(recs, {}, 0)); if (j.count !== 2 || j.alerts[0].id !== 'b') process.exit(1); const lines = snapshotNDJSON(recs, {}, 0).trim().split('\n'); if (lines.length !== 2) process.exit(1); if (!/^gridpane-alerts-.*\.json$/.test(snapshotFilename(0, 'json'))) process.exit(1); })"
python3 -c "import json,sys; m=json.load(open('manifest.json')); sys.exit(0 if 'downloads' not in m.get('permissions',[]) else 1)"
```

Expected: every command exits 0; `node --test` passes all tests including the new snapshot cases; the package check includes `lib/snapshot.js` and no new permission; the manifest still has no `downloads` permission.

#### Manual / UI Checks

1. With a populated archive, open Settings, press **Download JSON**, and confirm one file lands in the browser's download folder. Parse it and confirm `count` equals the stored alert count, the newest alert is first, and the resolved server/site names match the archive.
2. Press **Download NDJSON** and confirm one JSON object per line, with the same count; confirm a multi-line alert message does not break the line count.
3. Press **Save to folder**, choose a folder, and confirm `gridpane-alerts-<timestamp>.json` appears there. Reload the extension page and press **Save to folder** again; confirm the remembered folder is reused (or the picker asks again only if permission has lapsed) and a second file is written.
4. With an empty archive (or after clearing), repeat both downloads and confirm a valid file with zero alerts rather than an error.
5. Confirm no network request is made during either action and `manifest.json` still has no `downloads` permission.

## Summary

To be completed at close-out: what was asked, what was achieved, files changed, how to test, manual checks, skills used, skill feedback, known issues and commits.
