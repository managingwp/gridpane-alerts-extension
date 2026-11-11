# 20261111-docusaurus-docs-site

**Version:** 6
**Status:** ✅ Implemented (2026-11-11)
**Type:** feature

## Original Prompt

> Create a new PGF
>
> Create PGF/
>
> Let's create a docs/ folder and use the $lmt-skills-docusaurus skill.
>
> Specifically for the storage section, let's provide the current options and then possible options and included google sheets that was abandoned. Just for reference and why.
>
> List implemented separately, from planned, and then also add in options for collection and storage. For instance a cloudflare worker that takes the webhook data and stores it and then provides an mcp as planned.

## Plan Contract

- **Mission:** Publish a Docusaurus 3 documentation site for the extension out of the repository's `docs/` tree, with implemented behaviour separated from planned work and a collection-and-storage reference that records today's options, the candidate options (including a Cloudflare Worker that stores webhook data and serves an MCP), and why the Google Sheets destination was abandoned.
- **Execution Size:** large — six phases (scaffold, migrate, capability reference, storage reference, publish and contract, verification), each with its own validation and explicit-path commit.
- **Session Title:** Docs site and reference
- **Scope:** In scope: a `website/` Docusaurus 3 site (TypeScript, pinned dependencies, lockfile, local search) reading content from the existing `docs/` tree; front matter and one explicit sidebar for every page; migration of `README.md` and `docs/CHROME-WEB-STORE.md` into getting-started, guides, reference, contributing and history pages; new `docs/reference/features.md` (implemented only), `docs/reference/roadmap.md` (planned, possible, abandoned), `docs/reference/collection-and-storage.md` (collection and storage options, including the Cloudflare Worker + MCP sketch and the abandoned Google Sheets rationale) and `docs/history/google-sheets-destination.md`; `scripts/check-docs-site.sh` as the publish gate; `.github/workflows/docs.yml` deploying to GitHub Pages; a slimmed README with a docs pointer block; `docs/contributing/docs-site.md` recording the docs contract; migration of the storage decision record into `docs/reference/storage-decisions.md` with front matter and a sidebar entry; a `plans/todos.md` pointer and the one-time Pages todo. Out of scope: any runtime change (`background.js`, `app.js`, `app.html`, `db.js`, `normalize.js`, `lib/`, `manifest.json`, `scripts/package.mjs`, `store/`); creating a Cloudflare account, Worker, D1 database, R2 bucket or MCP deployment; creating Notion or Google resources; changing the privacy policy or its canonical URL; a custom domain; versioned docs, i18n, a blog or Algolia; changing the storage decision (that is recorded in `docs/reference/storage-decisions.md` and the closed research plan); publishing to GitHub Pages before the user enables the Pages source.
- **Success Metrics:** `npm --prefix website ci && npm --prefix website run build` exits 0 with `onBrokenLinks`, `onBrokenAnchors` and `markdown.hooks.onBrokenMarkdownLinks` set to `throw`; `bash scripts/check-docs-site.sh --site website --repo-root . --docs docs --exclude PRIVACY.md` exits 0. Every Markdown page under `docs/` except the excluded `docs/PRIVACY.md` has `title:` and `description:` front matter, no body H1, and exactly one sidebar entry; the search plugin is registered in `themes` with `docsRouteBasePath: '/'` and the build emits a search index whose result URLs start with `/gridpane-alerts-extension/`. `README.md` is at most 90 lines with one balanced `docs-index` marker pair and links to the site. `docs/reference/features.md` lists only shipped behaviour; `docs/reference/roadmap.md` labels every item Implemented / Planned / Possible / Abandoned with its plan file; `docs/reference/collection-and-storage.md` separates the same four statuses, evaluates at least six storage and four collection options, cites at least eight official sources with an access date, contains the Cloudflare Worker + D1/R2 + MCP sketch marked as not implemented, and explains why Google Sheets was abandoned with a link to `plans/20261110-google-sheets-destination.md`. `node --test` and `node scripts/package.mjs --check` still pass with 13 runtime files, `manifest.json` version is untouched, `dist/` has no tracked change, and `pgf release` still reports `Version: none` with no drift because the repository root keeps no `package.json`.
- **Touched paths:** plans/20261111-docusaurus-docs-site.md, plans/todos.md, plans/tests.md, README.md, .gitignore, docs/index.md, docs/getting-started/installation.md, docs/getting-started/first-run.md, docs/guides/sync.md, docs/guides/search-and-export.md, docs/guides/webhook.md, docs/reference/features.md, docs/reference/roadmap.md, docs/reference/collection-and-storage.md, docs/reference/storage-decisions.md, docs/reference/limits.md, docs/reference/privacy.md, docs/contributing/development.md, docs/contributing/release.md, docs/contributing/chrome-web-store.md, docs/contributing/docs-site.md, docs/history/google-sheets-destination.md, docs/CHROME-WEB-STORE.md, docs/STORAGE-DESTINATIONS.md, website/package.json, website/package-lock.json, website/docusaurus.config.ts, website/sidebars.ts, website/tsconfig.json, website/.gitignore, website/src/css/custom.css, website/static/img/favicon.ico, scripts/check-docs-site.sh, .github/workflows/docs.yml
- **Version Target:** release-assigned (git-squash-release)
- **Version Note:** Documentation and a site only; no `manifest.json` bump, no runtime file added to `RUNTIME_FILES`, and no release. The site's `package.json` lives in `website/` so the repository root stays without one — a root `package.json` previously broke the `pgf release` gate with an undefined version.
- **Approach / Architectural Fit:** The repository already has a `docs/` tree that other gates depend on: `scripts/package.mjs` requires `docs/PRIVACY.md` to exist, and `README.md` and `docs/CHROME-WEB-STORE.md` point at each other. The site therefore lives in `website/` and reads the existing tree through `docs.path: '../docs'`, so no file has to move just to satisfy Docusaurus, and the content keeps one home. `routeBasePath: '/'` gives every page a single canonical URL under `/` while the GitHub project site adds `baseUrl: '/gridpane-alerts-extension/'`. The privacy policy stays at `docs/PRIVACY.md`, excluded from the site build, because `store/listing.json` publishes it at `https://managingwp.io/policies/#gridpane-alerts-archive`; hosting a second copy would create two canonical policies. The copied publish gate gains one `--exclude` option so it can honour that exclusion while still checking every real page. Capability content is split by status rather than by subsystem: `features.md` claims only what the code does today, `roadmap.md` groups Planned / Possible / Abandoned and links each plan file, and `collection-and-storage.md` is the cross-cutting reference the user asked for — collection (how alerts reach the archive) and storage (where the copy lives) each get an implemented row set, a planned set and a possible set, including the Cloudflare Worker that receives the existing webhook and serves an MCP, and the abandoned Google Sheets design with its reason. The sourced comparison and the decision live in `docs/reference/storage-decisions.md` — the record of the closed research plan, migrated here — and this plan links it from the storage page instead of duplicating it.
- **References:** `README.md` (install, how it works, archive page, webhook, limits, maintainers); `docs/PRIVACY.md` (publish source, keep path); `docs/CHROME-WEB-STORE.md` (submission process, references `docs/PRIVACY.md`); `scripts/package.mjs` (requires `docs/PRIVACY.md`; `RUNTIME_FILES` allowlist); `manifest.json` (permissions, version 1.4.0); `db.js` (`gp-alerts`, DB v2, notifications/outbox/kv/synclog); `background.js` (`DEFAULTS`, `overlapSeconds`, backfill, gap audit, `postWebhook`, `hmac`, outbox backoff, `X-GPAlerts-*` headers); `normalize.js` (`webhookPayload`); `plans/implemented/20261111-sync-resilience.md`, `plans/implemented/20261111-slack-webhook-template.md`, `plans/implemented/20261111-storage-destinations.md`, `plans/20261110-google-sheets-destination.md` (statuses and rationale to summarise); `docs/CHROME-WEB-STORE.md` and `store/listing.json` (review constraints for the storage page); skills `plan-generation-skill`, `lmt-skills-docusaurus`, `lmt-skills-development-workflow` and `chrome-extensions`; official sources to cite for the storage page: Docusaurus (`https://docusaurus.io/docs`), Cloudflare Workers (`https://developers.cloudflare.com/workers/`), D1 (`https://developers.cloudflare.com/d1/`), R2 (`https://developers.cloudflare.com/r2/`), Workers pricing (`https://developers.cloudflare.com/workers/platform/pricing/`), Cloudflare MCP (`https://developers.cloudflare.com/agents/`), MCP (`https://modelcontextprotocol.io/`), Notion API (`https://developers.notion.com/`), Notion request limits (`https://developers.notion.com/reference/request-limits`), Google Sheets API (`https://developers.google.com/sheets/api`), File System Access API (`https://developer.mozilla.org/en-US/docs/Web/API/File_System_API`), Chrome `downloads` (`https://developer.chrome.com/docs/extensions/reference/api/downloads`), GitHub Pages (`https://docs.github.com/pages`).

### Assumptions (marked, veto any of these before execution)

- **The site lives in `website/`, the content stays in `docs/`.** `docs.path: '../docs'` keeps `docs/PRIVACY.md` at the path `scripts/package.mjs` requires and keeps one home for content. No root `package.json` is added.
- **The privacy policy is excluded, not migrated.** `docs/PRIVACY.md` is the publish source for `https://managingwp.io/policies/#gridpane-alerts-archive`; the site links to that canonical URL and to the GitHub source instead of rendering a second copy. The publish gate gets an `--exclude` option so the exclusion is explicit rather than a silent gap.
- **`docs/CHROME-WEB-STORE.md` moves into the site** as `docs/contributing/chrome-web-store.md`; it is referenced only by `README.md` and itself, so the move updates those links.
- **Status words are the contract.** Every roadmap and storage claim carries Implemented, Planned, Possible or Abandoned, and Planned/Possible items link to the plan file rather than promising a date. The plan file stays the source of truth for status.
- **The Cloudflare Worker + MCP is documented as a candidate, not built.** This plan creates no Cloudflare resource and no MCP server; the page describes the data flow, auth, schema, retry/dedupe and read tools so the next plan can start from it.
- **The storage decision is not made here.** The record produced by `plans/implemented/20261111-storage-destinations.md` is migrated to `docs/reference/storage-decisions.md` with front matter and a sidebar entry, because the docs site introduces a contract that record predates. Its recommendation (Cloudflare Worker + D1) is summarised, not re-decided.
- **Only official sources with an access date.** No free-tier number, price or API limit is written from memory; each is linked and dated when the page is written.
- **The Docusaurus build is a build step.** Per the global build rule, the executor confirms with the user before the first `npm ci` / `npm run build`, and states the install size and expected build time. The site is not containerised.
- **GitHub Pages needs one manual setting.** The workflow can be committed now, but the first deploy only succeeds after Settings → Pages → Source: GitHub Actions; that step is a human todo.
- **One foreign working-tree path exists at creation time.** `plans/20261111-sync-resilience.md` was modified by another session. It must not be staged here; the executor either waits for it to be committed or gets explicit approval for `pgf lock --allow-dirty`.
- **Ranking:** the plan is appended after the current queue. Run it before `20261111-storage-destinations` (Order 5) if that plan has not started, because it writes into the docs tree; otherwise reorder at triage with `pgf order set`.

## Skills Used

- **Creation:** `plan-generation-skill` (PGF format, contract, testing phase), `lmt-skills-docusaurus` (site shape, config, migration, publish gate), `lmt-skills-development-workflow` (explicit-path commits, push, secret-scan cadence).
- **Implementation:** `lmt-skills-docusaurus` (scaffold, migration, verification), `plan-generation-skill` (phase execution and close-out), `lmt-skills-development-workflow` (phase commits and secret scans), `chrome-extensions` (permission and store-review constraints for the storage page).

## Phases

### Phase 1: Scaffold the docs site

**Goal:** Prove the environment is ready, map every existing document to a target page, and get a pinned, searchable Docusaurus site building from `docs/`.

#### Tasks

- [x] Preflight: `node --version` is 18 or newer, `npm --version` and `jq --version` answer, and `curl -sSf -o /dev/null -w '%{http_code}\n' https://registry.npmjs.org/-/ping` prints `200`. Stop on any failure.
- [x] Run `git status --porcelain` and report the foreign paths. `plans/20261111-sync-resilience.md` belongs to another session: do not stage it. Run `pgf tree 20261111-docusaurus-docs-site` before locking and stop if it lists anything beyond the plan file.
- [x] Inventory the documents with `find . -maxdepth 1 -name '*.md'` and `find docs -type f -name '*.md'`; record the mapping (source → target → action → sidebar) in the Phase 1 commit body. The mapping is: `README.md` split into getting-started, guides, reference and contributing pages; `docs/CHROME-WEB-STORE.md` moved to `docs/contributing/chrome-web-store.md`; `docs/PRIVACY.md` unchanged and excluded; `plans/implemented/*` summarised into `docs/reference/features.md`; open plans summarised into `docs/reference/roadmap.md`; `plans/20261110-google-sheets-destination.md` summarised into `docs/history/google-sheets-destination.md`.
- [x] Scaffold with `npx --yes create-docusaurus@3 website classic --typescript --skip-install`, then remove only what the generator wrote: `website/docs`, `website/blog`, `website/src/pages` and `website/README.md`.
- [x] Install pinned dependencies: `npm --prefix website install --save-exact @docusaurus/core@3 @docusaurus/preset-classic@3`, then `npm --prefix website install`, then `npm --prefix website install --save-exact @easyops-cn/docusaurus-search-local@0.55.3`; confirm `node -p "const d=require('./website/package.json').dependencies; [d['@docusaurus/core'], d['@docusaurus/preset-classic']].join(' ')"` prints two bare versions.
- [x] Ensure `website/.gitignore` ignores `node_modules/`, `build/` and `.docusaurus/`; add `website/build/` and `website/.docusaurus/` to the root `.gitignore` only if the site file is absent.
- [x] Write `website/docusaurus.config.ts`: `title: 'GridPane Alerts Archive'`, `url: 'https://managingwp.github.io'`, `baseUrl: '/gridpane-alerts-extension/'`, `trailingSlash: false`, `onBrokenLinks: 'throw'`, `onBrokenAnchors: 'throw'`, `markdown: { hooks: { onBrokenMarkdownLinks: 'throw' } }`, docs `path: '../docs'`, `routeBasePath: '/'`, `sidebarPath: './sidebars.ts'`, `blog: false`, `theme.customCss: './src/css/custom.css'`, a `docSidebar` navbar item, `favicon: 'img/favicon.ico'`, and no `editUrl` (content sits outside the site directory, so generated edit links would resolve to the wrong path).
- [x] Register the search plugin in a top-level `themes` array with `hashed: true`, `language: ['en']`, `indexBlog: false` and `docsRouteBasePath: '/'`; add `"typecheck": "tsc"` to `website/package.json` scripts.
- [x] Seed `docs/index.md` (`slug: /`, title, description, one paragraph, links to installation, features, roadmap and collection-and-storage), `docs/getting-started/installation.md` (short install stub), and `website/sidebars.ts` with one `docs` sidebar and explicit entries for those three pages only.
- [x] Ask the user before the first `npm --prefix website ci` and `npm --prefix website run build` (build rule), then confirm the build exits 0 and `npm --prefix website run typecheck` exits 0.
- [x] **Validation:** `test -f website/docusaurus.config.ts`; `test -f website/sidebars.ts`; `test -f website/package-lock.json`; `grep -q "onBrokenAnchors: 'throw'" website/docusaurus.config.ts`; `grep -q "docsRouteBasePath: '/'" website/docusaurus.config.ts`; `grep -q 'docusaurus-search-local' website/package.json`; `npm --prefix website run build` exits 0; `test -f docs/index.md`.

**Commit:** `docs: scaffold the Docusaurus site from docs/`

**Commit:** `975aa7d` — `docs: scaffold the Docusaurus site from docs/`

### Phase 2: Migrate README and store documentation

**Goal:** Move the existing manual into getting-started, guide, reference and contributing pages without losing a fact or breaking a link.

#### Tasks

- [x] Move `docs/CHROME-WEB-STORE.md` to `docs/contributing/chrome-web-store.md`, add front matter (`title: Chrome Web Store submission`, a one-sentence `description`), remove the body H1, and update the `README.md` link plus the file's own cross-reference to `docs/PRIVACY.md` (a GitHub blob URL, not a relative link, because the policy page is excluded from the site).
- [x] Create `docs/getting-started/installation.md`: Web Store and manual install, the open-GridPane-tab requirement, the signed-in profile, updating an unpacked install, and a link to the first-run page. Drop the body H1 and keep the README's facts.
- [x] Create `docs/getting-started/first-run.md`: first sync, automatic backfill, the status line, the badge, and what happens with no GridPane tab or a signed-out session.
- [x] Create `docs/guides/sync.md` from README **How it works**: check interval, overlap and late alerts, cursor rules, automatic backfill (20/100 pages), **Fill older history**, **Check for gaps** (50 pages), 429 backoff (5/15/30/60 minutes), server/site name refresh, the sync log (1,000 rows) and its CSV export, the tab fallback.
- [x] Create `docs/guides/search-and-export.md` from README **Archive page**: columns and the Columns menu, sorting, the full-text Message column, search prefixes and quoting, CSV/JSON export of the filtered set, and the badge/`!` states.
- [x] Create `docs/guides/webhook.md` from README **Webhook**: full JSON and chat text payloads, the exact headers (`X-GPAlerts-Event`, `X-GPAlerts-Id`, `X-GPAlerts-Signature`), the HMAC-SHA256 formula, outbox retry (2, 4, 8 … 60 minutes), Retry/Discard, and the backfill opt-in.
- [x] Create `docs/reference/limits.md` (README **Limits** plus the bell-only, team-scope and internal-endpoint caveats) and `docs/reference/privacy.md` (IndexedDB stays in the profile, the webhook payload is what leaves the browser, link to the canonical policy URL and to the GitHub source of `docs/PRIVACY.md`).
- [x] Create `docs/contributing/development.md` (no build step, `node --test`, `node scripts/package.mjs`, `--check`, the runtime-file allowlist) and `docs/contributing/release.md` (version bump, tag, the release workflow and its checks).
- [x] Add every new page to `website/sidebars.ts` in the same commit as the page, grouped as Getting started, Guides, Reference and Contributing, in reading order.
- [x] Update `README.md` only where the move breaks a link; the full slim happens in Phase 5.
- [x] Deviation: `plans/20261111-storage-destinations.md` was implemented and closed before this phase, so its record was migrated from `docs/STORAGE-DESTINATIONS.md` to `docs/reference/storage-decisions.md` with front matter and a sidebar entry, rather than the plan being retargeted.
- [x] **Validation:** `npm --prefix website run build` exits 0; `test ! -f docs/CHROME-WEB-STORE.md`; `test -f docs/contributing/chrome-web-store.md`; for each new page `head -n 1` is `---`, `grep -q '^title:'` and `grep -q '^description:'` pass; `test "$(grep -c '^# ' docs/guides/sync.md)" -eq 0`; `test "$(grep -c 'X-GPAlerts-Signature' docs/guides/webhook.md)" -ge 1`; `test "$(grep -c 'chrome-web-store' README.md)" -ge 1`.

**Commit:** `docs: migrate the manual into site pages`

**Commit:** `c94b5c3` — `docs: migrate the manual into site pages`

### Phase 3: Implemented versus planned

**Goal:** Give the site one page that states only what ships today and one page that labels planned, possible and abandoned work, each pointing at its plan file.

#### Tasks

- [x] Create `docs/reference/features.md` with a short lead and four groups — Collection, Archive, Delivery, Operations. Cover only shipped behaviour: the in-tab read of `/notifications/recent`, the 5-minute default (minimum 2), the overlap walk, automatic and manual backfill, the 50-page gap audit, 429 backoff, the tab preflight and **Open GridPane**, the daily server/site name refresh; the IndexedDB archive (`gp-alerts` v2 with notifications, outbox, kv and synclog), sorting, column visibility, search prefixes, full Message text, CSV/JSON export; the webhook (full JSON and chat text, id header, optional HMAC, outbox backoff, Retry/Discard, backfill opt-in); the sync log and 1,000-row retention. Name the file that owns each claim (for example `background.js`, `db.js`, `normalize.js`) and link the matching guide.
- [x] Create `docs/reference/roadmap.md` with a status banner (`as of 2026-11-11`, status is copied from each plan file and `pgf list` is authoritative) and three sections: **Planned** — `20261111-sync-resilience` (configurable overlap, tab-load retry), `20261111-slack-webhook-template` (Slack Block Kit payload), `20261111-storage-destinations` (sourced storage comparison and decision gate); **Possible** — Cloudflare Worker + MCP read access, scheduled local export, Notion, a user-owned tool behind the existing webhook; **Abandoned** — the Google Sheets destination, linking the history page.
- [x] Create `docs/history/google-sheets-destination.md` with a dated title, what the design was (extension-created sheet, `drive.file`, `identity` permission, per-destination outbox, 401/429 handling, no archive backfill), why it was abandoned before Phase 2 (Google Cloud project, consent screen and a store-bound OAuth client, plus the `client_id` prerequisite and distribution overhead), and what reviving it would need. Link `plans/20261110-google-sheets-destination.md`.
- [x] Add all three pages to `website/sidebars.ts` (Reference and History).
- [x] **Validation:** `npm --prefix website run build` exits 0; `test -f docs/reference/features.md`; `test -f docs/reference/roadmap.md`; `test -f docs/history/google-sheets-destination.md`; `grep -q '20261111-sync-resilience' docs/reference/roadmap.md`; `grep -q '20261111-slack-webhook-template' docs/reference/roadmap.md`; `grep -q '20261111-storage-destinations' docs/reference/roadmap.md`; `grep -qi 'abandoned' docs/reference/roadmap.md`; `grep -q '20261110-google-sheets-destination' docs/history/google-sheets-destination.md`; `test "$(grep -c '^# ' docs/reference/features.md)" -eq 0`.

**Commit:** `docs: separate implemented features from planned work`

**Commit:** `a29dabf` — `docs: separate implemented features from planned work`

### Phase 4: Collection and storage reference

**Goal:** Write the page the request is about: how alerts are collected today, where they are stored today, and which collection and storage options are planned, possible or abandoned — with the abandoned Google Sheets design and the Cloudflare Worker + MCP candidate explained.

#### Tasks

- [x] Create `docs/reference/collection-and-storage.md` with a status legend (Implemented, Planned, Possible, Abandoned) and a note that the page is a reference map, not a decision; the decision and its sourced comparison live in `docs/reference/storage-decisions.md`.
- [x] **Collection — Implemented.** Describe the in-tab read of `GET https://my.gridpane.com/notifications/recent?page=N` with the user's session, the open-tab and sign-in requirements, the 5-minute default (minimum 2), the configurable overlap, resumable backfill, the gap audit, 429 backoff and the bell-only/team-scope limits. State the hard constraint: collection cannot move to a server, because the session lives in the browser tab; a remote service can only receive what the extension pushes. Add manual CSV/JSON export and the webhook push as the two implemented outbound paths.
- [x] **Collection — Planned and Possible.** Planned: configurable overlap and tab-load retry (`20261111-sync-resilience`), Slack Block Kit payload (`20261111-slack-webhook-template`). Possible: a scheduled local export, and a Cloudflare Worker that receives the existing webhook (it ingests, it does not collect).
- [x] **Storage — Implemented.** IndexedDB `gp-alerts` v2 (notifications, outbox, kv, synclog) in one Chrome profile; survives reload and extension update, is destroyed by uninstall, and cannot be read by another tool; JSON/CSV files via the export; a copy at the webhook receiver; the outbox retries 2, 4, 8 … 60 minutes with `X-GPAlerts-Id` as the dedupe key.
- [x] **Storage — Planned, Possible and Abandoned** as a table with one row per option and one column per criterion (setup, cost, auth, read path for Claude/scripts, retention/query, store impact, failure model, effort). Rows: local IndexedDB (Implemented), JSON/CSV export (Implemented), existing webhook into a user-owned tool such as NocoDB/Baserow/Airtable/n8n (Possible), Cloudflare Worker + D1 (Possible), Cloudflare Worker + R2 (Possible), Notion database (Possible), Google Sheets (Abandoned). Mark each row with its status word.
- [x] Add the **Cloudflare Worker + MCP** section marked **Possible (not implemented)**: the existing webhook POST carries the alert JSON, `X-GPAlerts-Id` and the optional `X-GPAlerts-Signature`; the Worker verifies the HMAC, upserts on the id (idempotent), writes one D1 row or one R2 object, and exposes an MCP server (Streamable HTTP, bearer token) with read tools such as `alerts.search`, `alerts.get`, `servers.list` and `stats.summary`. Include a D1 schema sketch (alert id, created_at, severity, title, message, server label/ip, site url, team id, received_at), the retention choice, the failure model (outbox retries; duplicate-safe ingest), the privacy/store impact (no new extension permission — it uses the existing optional host permission and the configured URL), and the extension delta (none beyond pointing the webhook at the Worker). State plainly that this plan creates no Cloudflare resource.
- [x] Add the **Why Google Sheets was abandoned** section: the design and its costs (Google Cloud project, Sheets API, External consent screen, a Chrome-extension OAuth client bound to the extension id, the `identity` permission and the `drive.file` scope, a store justification, per-destination outbox with 401 refresh and 429 handling, no backfill of the existing archive), the reason it stopped (the public `client_id` was a hard prerequisite and the setup/distribution overhead was not wanted; the branch was deleted and the plan marked `❌ Abandoned` on 2026-11-11), and what reviving it needs. Link the abandoned plan.
- [x] Cite every external claim (Cloudflare Workers/D1/R2/pricing/MCP, MCP spec, Notion API and limits, Google Sheets API, File System Access API, Chrome downloads) with an official URL and an access date; do not write a free-tier number or price without one.
- [x] Add the page to `website/sidebars.ts` under Reference and link it from `docs/index.md`, `docs/reference/features.md` and `docs/reference/roadmap.md`.
- [x] **Validation:** `npm --prefix website run build` exits 0; `test -f docs/reference/collection-and-storage.md`; `test "$(grep -ci 'cloudflare' docs/reference/collection-and-storage.md)" -ge 3`; `test "$(grep -c 'MCP' docs/reference/collection-and-storage.md)" -ge 3`; `test "$(grep -ci 'google sheets' docs/reference/collection-and-storage.md)" -ge 2`; `test "$(grep -c 'Implemented' docs/reference/collection-and-storage.md)" -ge 2`; `test "$(grep -c 'Planned' docs/reference/collection-and-storage.md)" -ge 1`; `test "$(grep -c 'Possible' docs/reference/collection-and-storage.md)" -ge 1`; `test "$(grep -c 'Abandoned' docs/reference/collection-and-storage.md)" -ge 1`; `test "$(grep -c 'https://' docs/reference/collection-and-storage.md)" -ge 8`; `grep -q '20261110-google-sheets-destination' docs/reference/collection-and-storage.md`.

**Commit:** `docs: document collection and storage options`

**Commit:** `9f48483` — `docs: document collection and storage options`

### Phase 5: Publish, contract and README

**Goal:** Make the site deployable, make the docs contract executable, slim the README to a doorway, and reconcile the storage research plan with the site.

#### Tasks

- [x] Copy `scripts/check-docs-site.sh` from the `lmt-skills-docusaurus` skill into the repository, then add a repeatable `--exclude <glob>` option that filters `PAGES` before the front-matter, sidebar and link checks (the excluded file is not a site page). Update the usage block and `--help`.
- [x] Add `.github/workflows/docs.yml`: trigger on `push` to `main` for `website/**`, `docs/**`, `README.md` and the workflow itself, plus `workflow_dispatch`; `permissions: contents: read, pages: write, id-token: write`; `concurrency: group: pages`; a build job with `working-directory: website`, `actions/setup-node@v4` (Node 20, `cache: npm`, `cache-dependency-path: website/package-lock.json`), `npm ci`, `npm run build`, `actions/upload-pages-artifact@v3` with `path: website/build`; a deploy job using `actions/deploy-pages@v4` and the `github-pages` environment. Do not add `.nojekyll`.
- [x] Write `docs/contributing/docs-site.md`: where the site lives, `docs.path` and why the content root is `docs/`, the front-matter contract (`title`, `description`, no body H1), the one-sidebar rule, relative links inside docs versus GitHub blob URLs and absolute site URLs, the `PRIVACY.md` exclusion, the `--exclude` flag, local commands (`npm --prefix website start`, `npm --prefix website run build`), the publish gate command, the search plugin rule (`docsRouteBasePath` must mirror `routeBasePath`), the Pages one-time setting, and the rule that generated pages are regenerated rather than hand-edited.
- [x] Rewrite `README.md` to at most 90 lines: title and one sentence, the docs URL `https://managingwp.github.io/gridpane-alerts-extension/`, a `<!-- BEGIN docs-index -->` … `<!-- END docs-index -->` pointer table (Getting started, Guides, Reference, Contributing, History), a short quick start (Web Store or release install plus the open-tab note), a short section table, and contributing/licence. Keep the release command and the maintainer test commands; drop the manual content the site now owns.
- [x] Update the alert-storage pointer in `plans/todos.md` to `docs/reference/storage-decisions.md` (the research plan was implemented and closed before this plan ran; its record now lives at the site path).
- [x] Update `plans/todos.md`: add the docs site to **Planned**, and add one human todo — enable GitHub Pages (`Settings → Pages → Source: GitHub Actions`) and confirm the docs workflow published — with the reason and the dependency.
- [x] **Validation:** `bash scripts/check-docs-site.sh --site website --repo-root . --docs docs --exclude PRIVACY.md` exits 0; `test "$(wc -l < README.md)" -le 90`; `test "$(grep -c '<!-- BEGIN docs-index -->' README.md)" -eq 1`; `test "$(grep -c '<!-- END docs-index -->' README.md)" -eq 1`; `test -f .github/workflows/docs.yml`; `grep -q 'pages: write' .github/workflows/docs.yml`; `grep -q 'id-token: write' .github/workflows/docs.yml`; `grep -q 'npm ci' .github/workflows/docs.yml`; `test "$(grep -c 'docs/reference/storage-decisions.md' plans/todos.md)" -ge 1`; `test "$(grep -c 'docs/STORAGE-DESTINATIONS.md' plans/todos.md)" -eq 0`; `pgf check` exits 0.

**Commit:** `docs: publish the site and record the docs contract`

**Commit:** `3a19737` — `docs: publish the site and record the docs contract`

### Phase 6: Testing & Verification

**Goal:** Prove the site builds from a clean install, the publish gate passes, the packaging and release gates are unchanged, and the pages say what they mean.

#### Tasks

- [x] Run every command in **How to Test** and confirm each exits 0 against the expected output.
- [x] Record the outcome of every **Manual / UI Checks** step in the closing reply.
- [x] Record the test outcomes with `pgf test run 20261111-docusaurus-docs-site`.
- [x] Run `pgf secrets --history --quiet` and confirm the committed history is clean; record `pgf release` and confirm `Version: none` with no `Drift:` section. The working-tree scan's two findings are the pre-existing, maintainer-approved false positives in `.agents/skills/modern-web-guidance/…/client-side-encryption.md`; record them as a known issue (a relative-source `gitleaks detect --source .` is clean).
- [x] **Validation:** every command in **How to Test** produces the expected output and every Manual / UI check is recorded.

#### How to Test

Prerequisites: Node 18 or newer (this repository uses Node 22), npm, `jq` and network access for `npm ci`. The first install downloads the Docusaurus toolchain into `website/node_modules` (roughly 300 MB) and the first build takes about a minute; per the build rule, confirm with the user before running them. `PRIVACY.md` is deliberately excluded from the site.

```bash
npm --prefix website ci
npm --prefix website run build
npm --prefix website run typecheck
bash scripts/check-docs-site.sh --site website --repo-root . --docs docs --exclude PRIVACY.md
test -f website/docusaurus.config.ts
test -f website/package-lock.json
test -f website/sidebars.ts
test -f .github/workflows/docs.yml
test -f docs/reference/collection-and-storage.md
test -f docs/reference/features.md
test -f docs/reference/roadmap.md
test -f docs/history/google-sheets-destination.md
test "$(wc -l < README.md)" -le 90
test "$(grep -c '<!-- BEGIN docs-index -->' README.md)" -eq 1
test "$(grep -c '<!-- END docs-index -->' README.md)" -eq 1
test "$(grep -c 'https://' docs/reference/collection-and-storage.md)" -ge 8
test "$(grep -ci 'cloudflare' docs/reference/collection-and-storage.md)" -ge 3
test "$(grep -c 'MCP' docs/reference/collection-and-storage.md)" -ge 3
test "$(grep -ci 'google sheets' docs/reference/collection-and-storage.md)" -ge 2
test "$(grep -c 'Abandoned' docs/reference/collection-and-storage.md)" -ge 1
test -f docs/reference/storage-decisions.md
test "$(grep -c 'docs/reference/storage-decisions.md' plans/todos.md)" -ge 1
test "$(grep -c 'docs/STORAGE-DESTINATIONS.md' plans/todos.md)" -eq 0
test ! -f package.json
test -z "$(git status --short dist/)"
node --test
node scripts/package.mjs --check
pgf check
pgf secrets --history --quiet
pgf release
```

Expected: `npm ci` installs from the committed lockfile; the build exits 0 with no broken-link, broken-anchor or broken-markdown-link error; `typecheck` exits 0; the publish gate exits 0; every `test` line exits 0; `node --test` passes every existing test (74 before this plan); `node scripts/package.mjs --check` reports 13 runtime files; `dist/` is unchanged; `pgf check` reports every plan OK; `pgf secrets --history --quiet` reports clean; `pgf release` prints `Version: none` with no `Drift:` section and still recommends no release.

#### Manual / UI Checks

1. Run `npm --prefix website start`, open the printed local URL, and walk the sidebar: Getting started, Guides, Reference, Contributing and History all open, and the landing page links to features, roadmap and collection-and-storage. Search for `webhook` and confirm a result opens and its URL contains `/gridpane-alerts-extension/`.
2. Read `collection-and-storage` top to bottom. Confirm Implemented, Planned, Possible and Abandoned are visually separate; the Cloudflare Worker + MCP section is labelled as not implemented and does not read as a promise; the Google Sheets section states the abandonment date and reason and links the abandoned plan; every external price or limit has an official link and an access date.
3. Spot-check three Implemented claims against the code or README (for example the 5-minute default, the `X-GPAlerts-Id` header and the JSON/CSV export) and confirm no feature is claimed that the code does not do. Spot-check that no shipped feature is missing from `features.md`.
4. After the Pages source is enabled, open `https://managingwp.github.io/gridpane-alerts-extension/`, a deep link, and a search result; confirm each loads without a redirect loop and the search result URL starts with `/gridpane-alerts-extension/`.
5. Confirm the extension is untouched: load `dist/unpacked/` (or the repo root) in Chrome and check the archive page and Settings still render, and that `manifest.json` still reads version 1.4.0.

## Summary

- **What was asked:** create a `docs/` site with `lmt-skills-docusaurus`; put the current storage options first, then the possible ones, including the abandoned Google Sheets design and why; list implemented separately from planned; and add collection and storage options, including a Cloudflare Worker that takes webhook data, stores it and provides an MCP.
- **What was achieved:** a Docusaurus 3 site in `website/` reading the existing `docs/` tree through `docs.path: '../docs'`, with pinned dependencies, a committed lockfile, client-side search, one explicit sidebar and `throw` on broken links, anchors and Markdown links. Content is now split by status: [Features](docs/reference/features.md) is implemented-only; [Roadmap](docs/reference/roadmap.md) carries Planned / Possible / Abandoned with plan links; [Collection and storage](docs/reference/collection-and-storage.md) separates implemented collection (in-tab read, export, webhook) and storage (IndexedDB, export, outbox) from planned destination plans, possible options (Worker + D1/R2 with an MCP read layer, Notion, a user-owned tool, a scheduled local export) and the abandoned Google Sheets design. The storage decision record moved from `docs/STORAGE-DESTINATIONS.md` to `docs/reference/storage-decisions.md` and keeps its recommendation. A copy of `scripts/check-docs-site.sh` is the publish gate, `docs/contributing/docs-site.md` records the contract, `.github/workflows/docs.yml` deploys to Pages, and the README is 67 lines with a docs pointer block.
- **Files changed:** `website/` (new site), `docs/index.md`, `docs/getting-started/`, `docs/guides/`, `docs/reference/` (features, roadmap, collection-and-storage, limits, privacy, storage-decisions), `docs/contributing/` (development, release, chrome-web-store, docs-site), `docs/history/google-sheets-destination.md`, `scripts/check-docs-site.sh`, `.github/workflows/docs.yml`, `README.md`, `plans/todos.md`, this plan. `docs/PRIVACY.md` is untouched and excluded from the site because `scripts/package.mjs` requires it and its canonical URL is the managingwp.io policy.
- **How to test:** `pgf test run 20261111-docusaurus-docs-site` — 30/30 passed on 2026-11-11, including `npm ci`, the production build, `typecheck`, the publish gate, the content greps, `node --test` (74/74), the package check (13 runtime files), the history secret scan and `pgf release` (`Version: none`).
- **Manual checks:** verified from the build without a browser: every route renders, the search index exists and its URLs start with `/gridpane-alerts-extension/`, the `#cloudflare-worker--mcp-possible` and `#recommendation` anchors resolve, and the sidebar links across categories. Not run: the visual pass over the local dev server, the Chrome smoke test, and the live Pages URL — the first deploy needs **Settings → Pages → Source: GitHub Actions**, which is filed as a todo.
- **Skills used:** `lmt-skills-docusaurus` (site shape, config, migration, publish gate), `plan-generation-skill` (phase execution and close-out), `lmt-skills-development-workflow` (explicit-path commits, secret-scan cadence), `chrome-extensions` (permission and store-review constraints for the storage page).
- **Skill feedback:**
  - The gate assumes the local search index lands under `build/assets/js`; `@easyops-cn/docusaurus-search-local` 0.55.3 writes `build/search-index.json` at the build root. The copied gate now searches the whole build and fails when `build/` is absent, instead of silently skipping.
  - `docs.path: '../docs'` needs `docsDir: ['../docs']` on the search plugin, or it scans `website/docs`, which does not exist, and warns on every build.
  - The gate's `--exclude` is a local addition so a publish-source page (`docs/PRIVACY.md`) can stay outside the site without leaving a hole in the front-matter check.
- **Known issues:**
  - `pgf secrets` (working-tree scan) reports the two pre-existing, maintainer-approved `generic-api-key` false positives in `.agents/skills/modern-web-guidance/guides/security/client-side-encryption.md`. The `.gitleaksignore` entries are relative, while `pgf secrets` scans by absolute path, so they do not match; `gitleaks detect --no-git --source .` is clean. The history scan in the test block passes.
  - The live site is not reachable until the Pages source is set; the workflow is committed.
  - A second session was creating the four destination plans while this plan ran; the storage pages link those committed plans and call them alternatives rather than a queue.
- **Commits:** `975aa7d` scaffold the Docusaurus site from docs/; `c94b5c3` migrate the manual into site pages; `a29dabf` separate implemented features from planned work; `9f48483` document collection and storage options; `3a19737` publish the site and record the docs contract; close-out to follow.
