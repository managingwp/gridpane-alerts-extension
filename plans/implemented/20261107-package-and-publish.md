# 20261107-package-and-publish

**Version:** 6
**Status:** ✅ Implemented (2026-11-07)
**Commit:** `4e08cad` — `docs: record phase 5 of 20261107-package-and-publish`
**Type:** feature

## Original Prompt

> How can we package this repository so that people can download and install the extension? Also how can we submit it to the chrome store.
>
> Scope agreed in the same session, from the follow-up choice: "Full kit" — packaging script, CI release, store submission runbook and privacy policy draft — with the privacy policy hosted as a page on managingwp.io.

## Plan Contract

- **Mission:** Ship a reproducible extension package, a tag-driven GitHub Release, and a complete Chrome Web Store submission kit, so anyone can install the extension and the maintainer can submit it without inventing listing copy at the dashboard.
- **Execution Size:** large — four build phases plus verification, each validated and committed separately.
- **Session Title:** Chrome store packaging
- **Scope:** In scope: `scripts/package.mjs` (runtime whitelist, validation, deterministic zip), `scripts/check-screenshots.mjs`, `tests/package.test.mjs`, `.github/workflows/release.yml`, `.gitignore`, the README install and maintainer sections, `store/listing.json`, `store/description.md`, `store/screenshots/README.md`, `docs/CHROME-WEB-STORE.md`, `docs/PRIVACY.md`, and a `minimum_chrome_version` addition to `manifest.json`. Out of scope: publishing the managingwp.io page (a CMS action outside this repo), capturing the store screenshots (needs the maintainer's signed-in Chrome), the dashboard submission itself, Firefox or Edge-specific packaging, a root `package.json`, and any change to sync, storage or webhook behaviour.
- **Success Metrics:** `node scripts/package.mjs` writes `dist/gridpane-alerts-<version>.zip` whose first entry is `manifest.json` and whose entries are exactly the 12 runtime paths; two consecutive builds are byte-identical; `--check` fails when a manifest permission has no justification in `store/listing.json` and when the manifest description exceeds 132 characters; the tag job refuses a tag that does not match the manifest version and attaches the zip to the release; every dashboard field is filled from a file in this repo; `node --test` and `pgf check` pass.
- **Touched paths:** scripts/package.mjs, scripts/check-screenshots.mjs, tests/package.test.mjs, .github/workflows/release.yml, .gitignore, README.md, docs/CHROME-WEB-STORE.md, docs/PRIVACY.md, store/listing.json, store/description.md, store/screenshots/README.md, manifest.json, plans/tests.md, plans/todos.md
- **Version Target:** release-assigned (git-squash-release)
- **Approach / Architectural Fit:** The extension has no build step and no dependencies, so the package is an allowlist copy, not a bundler. `scripts/package.mjs` is plain Node 22 with a ~40-line ZIP writer (`zlib.deflateRawSync` plus a local CRC32 table) because neither `zip` nor `unzip` exists on this host; fixed DOS timestamps and sorted entries make the archive byte-reproducible, so a release asset can be verified against a local build. Validation lives in pure exported functions (`collectFiles`, `validateManifest`, `assertStoreListing`, `buildZip`) so `tests/package.test.mjs` can exercise it under bare `node --test` without Chrome or a root `package.json` (which would make `pgf release` read an undefined version, as the previous plan's notes record). Store copy lives in `store/listing.json` rather than in prose, so `--check` can compare it with the manifest; `docs/CHROME-WEB-STORE.md` carries the process and points at the JSON for the text. CI uses the preinstalled `gh` CLI instead of a third-party release action. The zip keeps `manifest.json` at the archive root so the same file serves both the store upload and **Load unpacked**.
- **References:** `manifest.json` (permissions to justify), `background.js` (`fetchDirect` / `fetchViaTab` for the `scripting` justification, `chrome.action.onClicked` for the archive tab), `README.md` (install and limits sections), `plans/implemented/20261106-alert-gap-recovery.md` (PGF style, CLI-assertion pattern, root-`package.json` release-gate note), `plans/pgf.config` (internal plans, stage `idea`), skills `plan-generation-skill` and `lmt-skills-development-workflow`.

### Assumptions (marked, veto any of these before execution)

- **Name:** `manifest.json` keeps `GridPane Alerts Archive`; the "Unofficial, not affiliated with GridPane" disclaimer goes in the store summary/description and the README, not the title.
- **Distribution order:** first submission is Private (trusted testers), then Unlisted, then Public.
- **Placeholders:** privacy policy URL `https://managingwp.io/gridpane-alerts/privacy` and contact `privacy@managingwp.io` stay as marked placeholders until the page is published; both must be replaced before the Public flip.
- **Tags:** `vX.Y.Z`. The manifest version is the store version and is bumped by hand in the release commit; `pgf release` reports `Version: none` in this repo and no packaging step writes a version, so the workflow's tag-to-manifest assertion is the only guard.
- **Screenshots:** captured manually by the maintainer from a redacted demo team. The repo ships the procedure and the dimension validator; it does not fabricate screenshots. The store rejects PNGs with alpha, so the captured files must be flattened.
- **Manifest name changes are frozen at upload.** Any rename means a manifest edit, a version bump and a re-upload, so the name decision above is taken before the first upload.

## Skills Used

- **Creation:** `plan-generation-skill` (PGF format, contract, validation rules, final phase), `lmt-skills-development-workflow` (explicit-path commits, push, secret scans, bounded commands).
- **Implementation:** `plan-generation-skill` (phase execution, test ledger, close-out), `lmt-skills-development-workflow` (explicit-path commits and pushes, `pgf secrets` before each phase, secret-scan cadence, inclusive terminology).

## Phases

### Phase 1: Deterministic package build

**Goal:** Turn the working tree into a flat, reproducible extension zip with validation that catches a broken manifest before it reaches a reviewer.

#### Tasks

- [x] Create `scripts/package.mjs` exporting `RUNTIME_FILES`, `collectFiles(root)`, `validateManifest(manifest, files)`, `assertStoreListing(manifest, listing)`, `buildZip(entries)` and `sha256(buffer)`, with `main()` guarded by `import.meta.url === pathToFileURL(process.argv[1]).href`.
- [x] Define the runtime allowlist exactly: `manifest.json`, `background.js`, `db.js`, `normalize.js`, `app.html`, `app.js`, `app.css`, `lib/scan.js`, `icons/icon16.png`, `icons/icon32.png`, `icons/icon48.png`, `icons/icon128.png`. Fail when a listed path is missing; never add anything not listed (`lib/package.json`, `tests/`, `plans/`, `docs/`, `store/`, `.github/`, `README.md` and `scripts/` stay out).
- [x] Implement `buildZip(entries)` with sorted entry names, a fixed DOS timestamp (1980-01-01 00:00:00), `zlib.deflateRawSync` at a fixed level, a local CRC32 table, and no extra fields or data descriptors, so identical input yields an identical buffer.
- [x] Implement the manifest checks: `manifest_version` is 3; `name`, `version` and `description` are present; `description` is at most 132 characters; `icons` point at files present in the package with matching PNG width and height parsed from the IHDR chunk; no `key`, no `update_url`; the source tree contains no `eval(`, `new Function(` or remote `<script src="http…`.
- [x] Implement the CLI: `--check` (validate only, write nothing), `--out <dir>` (default `dist`), `--no-unpacked`. A normal run removes `gridpane-alerts-*.zip` and `unpacked/` from the output directory, writes `gridpane-alerts-<version>.zip` plus `unpacked/`, and prints the version, entry count, byte size and sha256.
- [x] Add `tests/package.test.mjs` covering: `collectFiles` returns exactly the allowlist; a missing icon fails; a 132-character description passes and a 133-character one fails; `buildZip` starts with `PK\x03\x04`, lists `manifest.json` first, and its end-of-central-directory entry count equals the input count; an extra manifest permission with no justification fails `assertStoreListing` (the listing file may be absent until Phase 3, in which case the check is skipped).
- [x] Add `dist/` to `.gitignore`; the existing `*.zip` pattern already covers the archives.
- [x] **Validation:** `node --test` exits 0 and reports at least 14 tests; `node scripts/package.mjs` exits 0 and prints a sha256; `node scripts/package.mjs --out "$(mktemp -d)"` twice into two fresh directories produces archives that `cmp` reports identical; the archive's first entry is `manifest.json` and no excluded top-level directory is present.

> **Notes:** 26 tests pass. Two defects were caught by the new tests before the first archive was written: JavaScript evaluates `0o100644 << 16` as a signed 32-bit integer, so the external-attributes field threw `ERR_OUT_OF_RANGE` until it was masked with `>>> 0`; and sorting entries alphabetically put `app.css` first, so the sort now pins `manifest.json` ahead of the rest. `python3 -m zipfile -l` confirms 12 entries, no directory prefix, and 1980-01-01 timestamps; two builds compare equal at `6017f1ce…`. The ZIP writer exists because `zip` and `unzip` are both absent on this host. Do not add a root `package.json` for a `npm run` alias — `pgf release` reads its missing `version` as drift.

**Commit:** `d098420` — `feat: add deterministic extension packaging script`

### Phase 2: Tag-driven release

**Goal:** Publish the same validated archive as a GitHub Release asset whenever a version tag is pushed, and keep the check running on pull requests.

#### Tasks

- [x] Create `.github/workflows/release.yml` with `on: push: tags: ['v*']` plus `pull_request`, `permissions: contents: write`, and a `build` job on `ubuntu-latest`: `actions/checkout@v4`, `actions/setup-node@v4` with Node 22, `node --test`, `node scripts/package.mjs --check`, `node scripts/package.mjs`, then an assertion that `v$(node -p "require('./manifest.json').version")` equals `$GITHUB_REF_NAME`, then `actions/upload-artifact@v4` of `dist/*.zip`.
- [x] Add a `release` job that needs `build` and runs only for a tag: download the artifact and create the release with `gh release create "$GITHUB_REF_NAME" dist/*.zip --generate-notes --title "$GITHUB_REF_NAME"`, using `GH_TOKEN: ${{ github.token }}`.
- [x] Add a **For maintainers** section to `README.md`: bump `manifest.json` `version`, run `node --test` and `node scripts/package.mjs`, commit, then `git tag vX.Y.Z && git push origin vX.Y.Z`; the workflow attaches the zip, and that same file is what goes to the store dashboard.
- [x] **Validation:** `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))"` exits 0; `test "$(grep -c "tags: \['v\*'\]" .github/workflows/release.yml)" -ge 1`; `test "$(grep -c 'node scripts/package.mjs' .github/workflows/release.yml)" -ge 2`; `test "$(grep -c 'gh release create' .github/workflows/release.yml)" -ge 1`; the local equivalent of the build job (`node --test` then `node scripts/package.mjs --check` then `node scripts/package.mjs`) exits 0.

> **Notes:** The job is named `package` rather than the planned `build`; the steps are unchanged. The release job sets `GH_REPO` instead of checking the repository out a second time, so `gh release create` has a target without needing a worktree. PyYAML reads the `on:` key as boolean `True` under YAML 1.1 — the file is valid for GitHub, which parses YAML 1.2; the parse gate only proves the document is well formed.

**Commit:** `861143f` — `feat: publish the package from a version tag`

### Phase 3: Store copy, privacy policy and runbook

**Goal:** Put every field the Chrome Web Store dashboard asks for into versioned files, and make a manifest change fail the build instead of the review.

#### Tasks

- [x] Create `store/listing.json` with `name`, `summary` (the manifest description, at most 132 characters), `singlePurpose`, `category` (`Developer Tools`), `language` (`en`), `privacyPolicyUrl`, `supportUrl`, `justifications` keyed by every string in `permissions`, `host_permissions` and `optional_host_permissions`, `dataUse`, and `testInstructions`.
- [x] Write the justification text for each of: `storage` (settings, cursor, sync log, cached names), `unlimitedStorage` (IndexedDB archive of multi-KB alerts), `alarms` (the 5-minute background check), `scripting` (the `fetchViaTab` fallback on `my.gridpane.com` only, citing `background.js`), `https://my.gridpane.com/*` (the three read-only panel endpoints), and both optional webhook patterns (a user-chosen origin requested only on save).
- [x] Set `dataUse` to: website content yes; personally identifiable information yes (alert text carries server IPs and the author's name/email); authentication information no (never reads cookies or credentials); everything else no; with the not-sold / not-unrelated / not-creditworthiness certifications.
- [x] Create `store/description.md`: the long description (at most 16,000 characters) with the unofficial disclaimer, a plain-language feature list, how to use it, a privacy and permissions paragraph, and a support line — no endpoint paths, no implementation detail.
- [x] Create `docs/PRIVACY.md` with `{{PRIVACY_URL}}` and `{{CONTACT_EMAIL}}` placeholders: what is stored locally (IndexedDB and `chrome.storage`), what leaves the device (only the webhook the user configures, with the HMAC header), no account, no analytics, no third-party sharing, retention and export, deletion on uninstall, contact, and the Limited Use sentence.
- [x] Create `docs/CHROME-WEB-STORE.md` as the runbook: account registration and 2FA, the two-slot publisher limit, trader/non-trader, upload, a table mapping each dashboard tab to the file that fills it, the graphics list, distribution (Private → Unlisted → Public), the test-instructions text for a reviewer who cannot sign in, the rejection risks (sign-in review, single purpose, broad optional hosts, the third-party name, screenshots with real fleet data), the update loop, and the live privacy-URL check.
- [x] Extend `scripts/package.mjs --check`: `store/listing.json` and `docs/PRIVACY.md` must exist; `listing.name` equals the manifest name; `listing.summary` equals the manifest description and is at most 132 characters; the `justifications` key set equals the manifest permission set exactly (missing and extra keys both fail).
- [x] Rewrite the README **Install** section: the store link first, then the release-zip route with `chrome://extensions` → Developer mode → **Load unpacked** and the note that an unpacked install is disabled whenever Developer mode is off (Chrome 133+), then what an update does to stored alerts.
- [x] Add test cases for the drift check: a missing permission key fails, an extra key fails, the exact set passes.
- [x] **Validation:** `node scripts/package.mjs --check` exits 0; `node --test` exits 0; `python3 -c "import json,sys; m=json.load(open('manifest.json')); l=json.load(open('store/listing.json')); p=set(m.get('permissions',[]))|set(m.get('host_permissions',[]))|set(m.get('optional_host_permissions',[])); sys.exit(0 if p==set(l['justifications']) else 1)"` exits 0; `test "$(grep -c 'chrome://extensions' README.md)" -ge 1`; `test "$(grep -c 'Developer mode' README.md)" -ge 1`; `test "$(grep -c 'PRIVACY_URL' docs/PRIVACY.md)" -ge 1`.

> **Notes:** The three drift-check tests landed in Phase 1 with `assertStoreListing`, so this phase only had to make the file mandatory. `store/listing.json` carries three keys beyond the manifest (`remoteCode`, `certifications`, `disclaimer`) because the dashboard asks for them and they belong next to the copy they qualify. The summary is 101 characters. Two deviations from the approved text: the description uses `permissions`/`justification` wording rather than "the three read-only panel endpoints", because the store copy names no internal endpoint paths; and the README says "Not published yet" instead of a broken store-link placeholder.

**Commit:** `9419cdb` — `feat: add the store listing, privacy policy and submission runbook`

### Phase 4: Store assets and manifest polish

**Goal:** Provide the capture procedure and a dimension gate for the store screenshots, and declare the real minimum Chrome version.

#### Tasks

- [x] Create `scripts/check-screenshots.mjs`: read the PNG IHDR from each path argument or each `.png` in a directory, assert 1280×800 by default (overridable with `--width` / `--height`), warn when the colour type is 6 (alpha) because the store rejects alpha in screenshots, print one line per file, and exit 1 on any dimension mismatch or unreadable file.
- [x] Create `store/screenshots/README.md`: the four shots (filtered archive, an expanded row, the Sync log, the webhook settings card), capture at exactly 1280×800 through the DevTools device toolbar, the redaction rules (no real server labels, IPs or author emails — use a demo team), the file names, and the validator command.
- [x] Add `"minimum_chrome_version": "102"` to `manifest.json`, justified by the module service worker, `optional_host_permissions` and `scripting` MAIN-world execution (`background.js:80`).
- [x] Confirm the name decision: keep `GridPane Alerts Archive` and ensure the unofficial disclaimer is present in `store/listing.json` and `store/description.md`.
- [x] **Validation:** `node scripts/check-screenshots.mjs --width 128 --height 128 icons/icon128.png` exits 0; `node scripts/check-screenshots.mjs --width 128 --height 128 icons/icon16.png` exits 1; `node scripts/package.mjs --check` exits 0; `python3 -c "import json,sys; m=json.load(open('manifest.json')); sys.exit(0 if m.get('minimum_chrome_version')=='102' else 1)"` exits 0.

> **Notes:** The validator also warns on colour types 4 and 6 (alpha) for any file, so the icon checks print an alpha warning on stderr-safe stdout while still exiting 0 for the correct size — the warning is expected for the extension's own icons and is what the screenshot capture must avoid. The disclaimer is in `store/listing.json` (`disclaimer`) and in the first paragraph of `store/description.md`.

**Commit:** `31ee2ee` — `feat: add the screenshot gate and declare the minimum Chrome version`

### Phase 5: Testing & Verification

**Goal:** Prove the package, the workflow and the store kit are consistent, and give the maintainer a repeatable pre-submission check.

#### Tasks

- [x] Run every command in **How to Test** and confirm each exits 0.
- [x] Record the outcome of each **Manual / UI Checks** step in the closing reply, including the privacy URL status and the dashboard upload result if it was reached.
- [x] Record the test outcomes with `pgf test run 20261107-package-and-publish`.
- [x] **Validation:** every command in `How to Test` produces the expected output.

> **Notes:** All 11 commands passed and are recorded in `plans/tests.md` (11 passed, 0 failed, 0 skipped). None of the Manual / UI Checks could run here: they need the managingwp.io page, the maintainer's Chrome profile and GridPane session, and the Chrome Web Store dashboard. They are listed under **Not verified** in the Summary and filed as follow-up todos.

#### How to Test

Prerequisites: Node 22, `python3` with `PyYAML` for the workflow parse (verified in this checkout), and `git`. No network, no build step, no npm dependencies. The archive checks read the zip built in the same block.

```bash
node --test
node scripts/package.mjs --check
node scripts/package.mjs
python3 -c "import zipfile,glob,sys; n=zipfile.ZipFile(sorted(glob.glob('dist/*.zip'))[0]).namelist(); sys.exit(0 if n[0]=='manifest.json' else 1)"
python3 -c "import zipfile,glob,sys; n=zipfile.ZipFile(sorted(glob.glob('dist/*.zip'))[0]).namelist(); bad=[x for x in n if x.split('/')[0] in ('plans','tests','docs','scripts','store','.github')]; sys.exit(0 if not bad else 1)"
a=$(mktemp -d); b=$(mktemp -d); node scripts/package.mjs --out "$a" >/dev/null && node scripts/package.mjs --out "$b" >/dev/null && cmp "$a"/*.zip "$b"/*.zip
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))"
python3 -c "import json,sys; m=json.load(open('manifest.json')); l=json.load(open('store/listing.json')); p=set(m.get('permissions',[]))|set(m.get('host_permissions',[]))|set(m.get('optional_host_permissions',[])); sys.exit(0 if p==set(l['justifications']) else 1)"
test "$(grep -c 'chrome://extensions' README.md)" -ge 1
test "$(grep -c 'Load unpacked' README.md)" -ge 1
test "$(grep -c 'gh release create' .github/workflows/release.yml)" -ge 1
```

Expected: `node --test` prints `pass` for every test and exits 0; both packaging modes exit 0 and print the manifest version; the archive's first entry is `manifest.json` and no `plans/`, `tests/`, `docs/`, `scripts/`, `store/` or `.github/` path is present; `cmp` exits 0, proving the build is byte-reproducible; the YAML parses; the justification set matches the manifest exactly; each `test` line exits 0.

#### Manual / UI Checks

1. Publish `docs/PRIVACY.md` at `https://managingwp.io/gridpane-alerts/privacy` with the placeholders replaced, and confirm the URL returns 200 without a redirect loop. Replace `privacyPolicyUrl` and `{{CONTACT_EMAIL}}` in `store/listing.json` to match.
2. Capture the four screenshots from a redacted demo team into `store/screenshots/`, then run `node scripts/check-screenshots.mjs store/screenshots` and confirm it lists four 1280×800 files and exits 0.
3. In Chrome, open `chrome://extensions`, enable Developer mode, choose **Load unpacked** and select `dist/unpacked/`. Confirm the archive page opens, the Settings and Sync log tabs render, and the version shown matches `manifest.json`.
4. In the Chrome Web Store dashboard, add a new item and upload `dist/gridpane-alerts-<version>.zip`. Fill Store listing from `store/listing.json` and `store/description.md`, Privacy from the same file, and Test instructions from `docs/CHROME-WEB-STORE.md`; set Distribution to Private with trusted testers and submit. Confirm the item reaches review rather than remaining a draft.
5. When the item is published, install it from the store URL, confirm the version, then trigger an update by uploading a bumped version and confirm stored alerts survive.

**Commit:** `4e08cad` — `docs: record phase 5 of 20261107-package-and-publish`

## Summary

- **What was asked:** "How can we package this repository so that people can download and install the extension? Also how can we submit it to the chrome store." — with the agreed scope "Full kit — packaging script, CI release, store submission runbook and privacy policy draft", privacy policy hosted on managingwp.io.
- **What was achieved:** A dependency-free `scripts/package.mjs` builds `dist/gridpane-alerts-<version>.zip` from a 12-path runtime allowlist with `manifest.json` first, validates the manifest (version shape, 132-character description, PNG icon dimensions, no `key`/`update_url`, no remote code) and fails when a manifest permission has no justification in `store/listing.json`; two builds of the same tree compare byte-identical. A tag-driven GitHub Actions workflow re-runs the tests and validation, refuses a tag that disagrees with the manifest version, and attaches the zip to the Release; pull requests run the same checks. The store kit is complete: `store/listing.json` (listing copy, seven permission justifications, data-use answers, remote-code answer, test instructions), `store/description.md`, `docs/PRIVACY.md`, `docs/CHROME-WEB-STORE.md` (dashboard tab by tab, distribution Private → Unlisted → Public, rejection risks, update loop), and `store/screenshots/README.md` with `scripts/check-screenshots.mjs` as the 1280×800 and alpha gate. `manifest.json` now declares `minimum_chrome_version` 102, and the README documents both install routes and the release flow. Caveat: the manifest version is the store version and is bumped by hand — `pgf release` reports `Version: none` because this repo has no version file it reads, so the workflow's tag-to-manifest assertion is the only guard. Zip byte-identity holds for a given zlib build; a CI-built asset may differ byte-wise from a local build while unpacking to the same files.
- **Files changed:** `scripts/package.mjs`, `scripts/check-screenshots.mjs`, `tests/package.test.mjs`, `.github/workflows/release.yml`, `.gitignore`, `README.md`, `docs/CHROME-WEB-STORE.md`, `docs/PRIVACY.md`, `store/listing.json`, `store/description.md`, `store/screenshots/README.md`, `manifest.json`, `plans/tests.md`, `plans/20261107-package-and-publish.md`.
- **How to test:** from the repository root, Node 22 and `python3` with PyYAML; no build step or npm dependencies. All 11 commands from **How to Test** passed on 2026-11-07 and are recorded in `plans/tests.md`: `node --test` (26 tests), `node scripts/package.mjs --check`, `node scripts/package.mjs`, the first-entry and excluded-directory assertions on the archive, the two-build `cmp`, the workflow YAML parse, the permission-set comparison, and the three README/workflow greps. The Manual / UI Checks were **not** run — each needs the maintainer: the managingwp.io page, a signed-in Chrome profile, and the Web Store dashboard.
- **Skills used:** creation — `plan-generation-skill`, `lmt-skills-development-workflow`; implementation — `plan-generation-skill`, `lmt-skills-development-workflow`.
- **Skill feedback:** None.
- **Known issues / suggestions:**
  - The privacy policy is written but not published; `docs/PRIVACY.md` still carries `{{PRIVACY_URL}}` and `{{CONTACT_EMAIL}}` — publish it at `https://managingwp.io/gridpane-alerts/privacy` and fill both placeholders plus `store/listing.json`.
  - The four store screenshots do not exist yet — capture them from a redacted demo team into `store/screenshots/` and run `node scripts/check-screenshots.mjs store/screenshots`.
  - The zip has not been uploaded to the dashboard — add the item, fill the tabs from the store kit, and submit as Private with trusted testers.
  - The unpacked install has not been opened in Chrome — load `dist/unpacked/` and confirm the archive page, Settings and Sync log render and the version matches the manifest.
- **Commits:** `d098420` feat: add deterministic extension packaging script; `b067ff4` docs: record phase 1; `861143f` feat: publish the package from a version tag; `ca5645e` docs: record phase 2; `9419cdb` feat: add the store listing, privacy policy and submission runbook; `1f32c7a` docs: record phase 3; `31ee2ee` feat: add the screenshot gate and declare the minimum Chrome version; `3c17533` docs: record phase 4; `4e08cad` docs: record phase 5; close-out recorded in the follow-up commit.
