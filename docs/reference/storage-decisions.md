---
title: Alert storage destinations — decision record
description: Sourced comparison of the places a durable alert copy could live, the recommendation (Cloudflare Worker + D1), and the decision gate.
---

**Status:** Draft for decision (2026-11-11)
**Scope:** Where the GridPane Alerts Archive could keep a durable, machine-readable copy outside the Chrome profile. This record recommends an option; it does not implement one.
**Related:** `README.md` (Limits, Webhook), `docs/PRIVACY.md`, `plans/20261110-google-sheets-destination.md` (abandoned design), `plans/implemented/20261111-storage-destinations.md` (this investigation).

## Problem and constraints

The archive is currently local-only:

- Alerts live in IndexedDB (`db.js`) in one Chrome profile. Uninstalling the extension deletes them, and a second browser profile cannot see them.
- Other tools cannot read `chrome-extension://` pages. A copy in the browser is not readable by Claude in Chrome, a script, or another machine.
- The extension is read-only against GridPane: it pages `GET /notifications/recent` inside a signed-in tab and never marks an alert as read.
- Delivery infrastructure already exists: `storeNew` writes an alert and an outbox record, `doFlush` posts oldest first with backoff, `X-GPAlerts-Id` gives a receiver a de-duplication key, and an optional HMAC signs the raw body.
- The existing JSON/CSV export is a manual snapshot. It answers "give me a file", not "keep a second copy current".

Two jobs to be done:

1. **Survive the browser.** The copy must outlive an uninstall, a profile reset, or a different machine.
2. **Be readable.** The user's tools — Claude, scripts, a dashboard — need a stable read path without a browser extension as the only source.

The volume is modest: a GridPane alert is a title, a message, severity, timestamps, server/site metadata and an id, typically a few kilobytes. Even a large fleet's history is unlikely to exceed a few hundred megabytes.

## Options

### A. Local scheduled export or a chosen folder

The archive page writes a JSON or NDJSON snapshot on a schedule (or on demand) to a folder the user picks with `showDirectoryPicker()`, or to the Downloads folder through the `downloads` API. The File System Access API gives read/write handles that can be stored in IndexedDB; the origin private file system (OPFS) is private to the extension and not user-visible.

- **Read path:** Claude Code/desktop and local scripts can read a normal file; Claude in Chrome and remote tools cannot.
- **Setup:** one folder picker and a permission re-grant after some browser restarts; no account.
- **Cost:** none. A few hundred MB of local disk is negligible.
- **Store review:** `downloads` would need a permission and a justification; File System Access needs a user gesture but no extension permission.
- **Failure/dedupe:** rewrite the file atomically from the archive, or append NDJSON and de-duplicate by id on read.
- **Weakness:** does not solve the remote/machine-readable requirement, and a scheduled write from a service worker cannot show a picker; the archive page must do it.

### B. Cloudflare Worker + D1

A small Worker receives alerts from the extension and writes them to a D1 SQL database. The Worker exposes an authenticated query endpoint (for example `GET /v1/alerts?since=…&limit=…`) so Claude or a script can read JSON.

- **Setup:** a Cloudflare account, `wrangler`, one D1 database, one Worker, one secret. No OAuth app, no domain required (a `workers.dev` URL works).
- **Cost:** Workers Free includes 100,000 requests/day and 10 ms CPU per invocation; D1 Free includes 5 GB storage, 5 million rows read/day and 100,000 rows written/day (10 databases). Workers Paid is $5/month, with 10 million requests, 30 million CPU-ms, 25 billion D1 rows read and 50 million rows written included; D1 storage beyond 5 GB is $0.75/GB-month. A personal archive fits the free tier comfortably. Sources: [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/).
- **Auth:** an HMAC secret or bearer token in the extension, stored as a Worker secret. The extension already stores a webhook secret in `chrome.storage.local`; this would be the same trust model.
- **Read path:** JSON over HTTPS, with SQL underneath. Claude can read it through a direct request or a small MCP wrapper. Indexed columns make time/severity/server filters cheap.
- **Retention/query:** full SQL; keep forever or delete by age. D1 rows are limited to 2 MB each and 100 columns, far above an alert.
- **Store review:** no manifest permission is strictly needed because `optional_host_permissions` already covers a user-chosen host; saving the Worker URL asks for that origin, exactly like the webhook. The listing's data-use and test text should name the new destination.
- **Failure/dedupe:** `alerts.id` as the primary key plus `INSERT OR IGNORE` makes a retry idempotent. The existing outbox/backoff can carry a second destination.
- **Weakness:** the user runs and secures a Worker, and holds a secret. It is a small service, not a zero-maintenance product.

### C. Cloudflare Worker + R2

A Worker writes one NDJSON object per alert (or a daily batch) to an R2 bucket, keyed by alert id, and reads objects back for export.

- **Setup:** Cloudflare account, R2 bucket, Worker, secret. Similar to D1.
- **Cost:** R2 Free includes 10 GB-month storage, 1 million Class A and 10 million Class B operations per month, with free egress. Standard storage is $0.015/GB-month, $4.50/million Class A and $0.36/million Class B. A 100,000-alert archive at a few KB each is well inside 10 GB. Source: [R2 pricing](https://developers.cloudflare.com/r2/pricing/).
- **Auth/read path:** the same Worker auth; reads are object listings/gets, not SQL. A query such as "all warnings for web1 last week" means listing and filtering in the Worker.
- **Retention/query:** cheap and durable, but the query surface is weaker than D1 unless the Worker indexes objects elsewhere.
- **Store review:** same as D1 (optional host permission for the Worker origin).
- **Failure/dedupe:** object key `alerts/<id>.json` makes a retry an overwrite, which is naturally idempotent.
- **Weakness:** no SQL; you will likely add D1 later for queries, at which point B is simpler.

### D. Notion database

The extension creates one Notion page per alert through the Notion API, with properties for title, date, severity, server, site, message, alert id and a link.

- **Setup:** create an internal integration, copy its token, create a database, and share it with the integration. No Worker, no deploy.
- **Cost:** no separate API charge for a personal workspace; the workspace plan's own limits apply.
- **Auth:** an integration token in the extension. Notion does not offer a public OAuth flow for this use case without an app; the token is the practical path.
- **Read path:** excellent for people and for Claude's Notion connector; pages are browsable and searchable.
- **Limits:** 180 requests/minute (about 3/second) on plans other than Business/Enterprise; rich-text `text.content` is capped at 2,000 characters; a request carries at most 100 blocks and 500 KB; a data-source query is about 3 requests/second. Source: [Notion request limits](https://developers.notion.com/reference/request-limits).
- **Store review:** save `https://api.notion.com/*` as an optional host permission, or reuse the existing user-chosen host pattern. No Google-style OAuth review.
- **Failure/dedupe:** Notion has no idempotency key on page creation. A retry can create a duplicate unless the extension first queries by the alert-id property (an extra read per alert) or accepts duplicates. Short alerts fit the 2,000-character rich-text field; a long GridPane message must be truncated or split into blocks.
- **Weakness:** page-per-alert overhead, per-request reads for de-duplication, and truncation. It is the best human/Claude UI, but a weaker archive.

### E. Google Sheets

The abandoned `20261110-google-sheets-destination` plan proposed creating a spreadsheet in the user's Drive and appending one row per alert through the Sheets API, using `chrome.identity.getAuthToken` and the `drive.file` scope.

- **Setup:** Google Cloud project, Sheets API, OAuth consent screen, Chrome-extension OAuth client, `identity` permission and an `oauth2` block. The abandoned plan treated the client id as human setup.
- **Cost:** the Sheets API is free for standard use; Google says exceeding quota limits is planned to incur charges later in 2026. Source: [Sheets API limits](https://developers.google.com/sheets/api/limits).
- **Limits:** 300 read requests/minute/project and 60/minute/user; 300 write requests/minute/project and 60/minute/user; 2 MB recommended payload; 180-second request timeout.
- **Read path:** good for people and Claude's Google Sheets connector; row-oriented, not a document store.
- **Store review:** `identity` plus an OAuth scope is a material review change; the abandoned plan carried that cost.
- **Failure/dedupe:** an append is not idempotent. The abandoned plan needed a `sheetsent` marker plus a reconcile read to avoid duplicates.
- **Why it was abandoned:** the OAuth client and consent setup, the `identity` permission, the store-review change and the duplicate guard were a high price for a row store. This record keeps it as an option but does not revive it silently.

### F. Existing webhook into a user-owned tool

The current **Full JSON** webhook can already feed NocoDB, Baserow, Airtable, n8n, Make, Zapier or a self-hosted endpoint. The receiver owns storage, auth, retries and the read path.

- **Setup:** whatever the chosen tool requires; no extension change.
- **Cost:** the chosen tool's plan; many have a free tier.
- **Auth:** the existing HMAC signature and optional headers; the tool verifies them.
- **Read path:** depends on the tool; usually a REST API and a UI.
- **Store review:** none.
- **Failure/dedupe:** the existing outbox/backoff; the receiver should key on `X-GPAlerts-Id`.
- **Weakness:** it is not a copy owned by the extension, and a receiver that is down for a long time depends on the outbox; but it is the lowest-effort path if the user already runs such a tool.

### G. No change — local archive plus manual export

Keep IndexedDB as the only store and use the existing CSV/JSON export when a copy is needed.

- **Setup/cost:** none.
- **Read path:** manual export only; no live read by Claude or scripts.
- **Store review:** none.
- **Weakness:** does not meet either job to be done. It is the baseline, not a destination.

## Comparison

| Criterion | A. Local file | B. Worker + D1 | C. Worker + R2 | D. Notion | E. Sheets | F. Existing webhook | G. No change |
|---|---|---|---|---|---|---|---|
| Setup | Folder picker | Cloudflare account, Worker, D1, secret | Cloudflare account, Worker, R2, secret | Integration token, database share | Google Cloud OAuth client | Depends on receiver | None |
| Running cost | None | Free tier; $5/mo paid | Free tier; $5/mo paid | Workspace plan | Free now; possible 2026 charges | Receiver plan | None |
| Auth | OS file permissions | HMAC or bearer | HMAC or bearer | Integration token | OAuth `drive.file` | Existing HMAC | None |
| Read path for Claude | Local files only | JSON/SQL API | Object reads | Notion connector | Sheets connector | Receiver API | Manual export |
| Query/retention | File-level | Full SQL | Object listing | Notion filters | Row filters | Receiver-dependent | None |
| Store review | `downloads` only if used | Optional host | Optional host | Optional host | `identity` + scope | None | None |
| Failure/dedupe | Atomic rewrite | Primary key + `INSERT OR IGNORE` | Object key overwrite | Query-before-create | Marker + reconcile | Existing outbox | None |
| Privacy | Stays local | User's Cloudflare account | User's Cloudflare account | Notion workspace | Google Drive | Receiver | Local only |
| Effort | Small | Medium | Medium | Medium | Large (OAuth) | Small | None |

## Recommendation

**Primary: B. Cloudflare Worker + D1. Runner-up: D. Notion database.**

D1 is the best fit for the two jobs. It gives a durable copy outside Chrome, a small authenticated JSON API that Claude or a script can read, and SQL for the questions the archive actually gets ("warnings for web1 last week", "everything since the last cursor"). Its ingest is naturally idempotent on the alert id, so the existing outbox and retry model carries over without a duplicate guard. It stays inside the free tier for a personal archive, and it adds no OAuth review to the Chrome Web Store listing. The cost is real but bounded: one Worker, one database, one secret, and the user has to keep them.

Notion is the runner-up because it has the best out-of-the-box read experience and needs no Worker. It loses on three concrete points: about 3 requests/second on a standard plan, a 2,000-character rich-text cap that truncates long alerts, and no idempotency key, which forces a read-before-create or accepts duplicates. If the priority is "Claude reads it with no custom query code", Notion wins; if the priority is "a durable, queryable archive with a stable API", D1 wins.

The answer changes if:

- **You will not run a Cloudflare account:** choose Notion, or F if you already run a tool with an API.
- **You need the smallest possible change:** F, the existing webhook, is already shipped.
- **You need the copy to be local only:** A is sufficient, and G already covers the manual case.
- **You want Google Sheets specifically:** E is possible, but budget for the OAuth client, `identity` permission and duplicate guard that the abandoned plan documented.

## Implementation sketch (Cloudflare Worker + D1)

This is the shape of the follow-up plan, not an implementation. No account, token or permission is created here.

**Extension side**

- Add a **Cloud archive** card in Settings: Worker URL, secret, **Send new alerts**, **Also send history**, **Send test**, and a status line for the last error/ok.
- Reuse the outbox: `storeNew` queues a `cloud` half alongside the webhook half; `doFlush` processes each destination on its own attempt count and `next_at`, so one failure cannot block the other.
- Batch due alerts (for example 100 per request) oldest first. POST `{ "alerts": [ … ] }` to `<worker>/v1/alerts` with `Authorization: Bearer <token>` or `X-GPAlerts-Signature` HMAC. The body uses the same normalized record as the full webhook payload.
- Treat 401/403 as a hard stop that surfaces in Settings; retry 429/5xx with the existing backoff. Do not put the payload in a URL.
- Ask for the Worker origin through the existing `optional_host_permissions` flow; no `manifest.json` permission list change. Store the URL and secret in `chrome.storage.local`, like the webhook secret.
- Never send the first history import unless the user ticks **Also send history**, matching the webhook behaviour.

**Worker side**

- `POST /v1/alerts`: verify the bearer token or HMAC, validate the array and each id, then insert with `INSERT INTO alerts (...) VALUES (...) ON CONFLICT(id) DO NOTHING`. Return `{ inserted, skipped }`.
- `GET /v1/alerts?since=<unix>&limit=<n>&severity=&server=`: return JSON, newest first, capped at a documented limit. This is the read path for Claude and scripts.
- `GET /v1/health`: a small authenticated check for Settings.
- A `wrangler.toml` with the D1 binding; the secret via `wrangler secret put`; no secret in the repository.

**Schema**

```sql
CREATE TABLE alerts (
  id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  server_label TEXT,
  server_ip TEXT,
  site_url TEXT,
  team_id INTEGER,
  action_url TEXT,
  received_at INTEGER NOT NULL
);
CREATE INDEX alerts_created_at ON alerts (created_at);
CREATE INDEX alerts_severity ON alerts (severity);
```

**Privacy and store text**

- Alerts, server names, IP addresses and the alert author's name leave the browser for the user's own Cloudflare account. The extension author operates no intermediary. Say this in `docs/PRIVACY.md` and the listing's data-use text.
- The Worker keeps the data until the user deletes rows or the database. Document that uninstalling the extension does not delete the remote copy.
- Add the new destination to the store's test instructions and the README, and add the Worker URL host to the optional-permission explanation.

**Effort:** medium — settings and outbox destination, Worker and schema, read endpoint, documentation and store text. It should be its own PGF with phases for the pure model/tests, the Worker, the extension delivery path, and docs.

## Decision gate

**Question:** Which drafted plan should be unheld and executed?

**Recommended answer:** Cloudflare Worker + D1 (`plans/20261111-cloudflare-d1-destination.md`), with Notion as the fallback (`plans/20261111-notion-destination.md`).

**Drafted option plans (2026-11-11):** all four are parked **⏸ On Hold**; they are alternatives, not a queue. Unhold one and execute it; the others stay parked or are abandoned.

| Option | Drafted follow-up PGF |
|---|---|
| B. Cloudflare Worker + D1 | `plans/20261111-cloudflare-d1-destination.md` |
| D. Notion database | `plans/20261111-notion-destination.md` |
| E. Google Sheets | `plans/20261111-google-sheets-destination.md` |
| A. Local folder snapshot | `plans/20261111-local-export-destination.md` |

F (existing webhook) needs no new PGF because it already ships; G (no change) needs none by definition.

**Deferred until you choose:** creating a Cloudflare account, database or Worker; creating a Notion integration or database; creating a Google Cloud OAuth client; adding any extension permission; writing runtime code; changing the privacy policy or store listing.

**Follow-up PGF:** each drafted plan is the ready-to-implement prompt for its option. The D1 plan records the Worker/secret human setup, the 100-alert batching, the idempotent insert and the read endpoint; the Notion and Sheets plans record their integration setup and duplicate guards; the local plan records the folder handle. Do not implement any of them until you unhold one.

## Sources

All sources accessed 2026-11-11.

- Cloudflare D1 pricing — https://developers.cloudflare.com/d1/platform/pricing/
- Cloudflare D1 limits — https://developers.cloudflare.com/d1/platform/limits/
- Cloudflare R2 pricing — https://developers.cloudflare.com/r2/pricing/
- Cloudflare Workers pricing — https://developers.cloudflare.com/workers/platform/pricing/
- Cloudflare Workers limits — https://developers.cloudflare.com/workers/platform/limits/
- Notion request limits — https://developers.notion.com/reference/request-limits
- Google Sheets API limits and quotas — https://developers.google.com/sheets/api/limits
- MDN File System API — https://developer.mozilla.org/en-US/docs/Web/API/File_System_API
- Chrome `downloads` API — https://developer.chrome.com/docs/extensions/reference/api/downloads
- Abandoned Google Sheets design — `plans/20261110-google-sheets-destination.md`
