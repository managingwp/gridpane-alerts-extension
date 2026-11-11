---
title: Collection and storage
description: How alerts are collected today, where the archive is stored today, and the planned, possible and abandoned options — including a Cloudflare Worker that stores webhook data and serves an MCP, and why Google Sheets was dropped.
---

This page is a reference map, not a decision. It separates what ships now from what is planned, possible or abandoned. The sourced comparison and the recommendation live in the [storage decision record](./storage-decisions.md).

## Status legend

| Status | Meaning |
|---|---|
| **Implemented** | Ships in the current extension and works today. |
| **Planned** | Has a written plan; not built. The plan file is the source of truth. |
| **Possible** | Understood and sketched, but no approved plan and no code. |
| **Abandoned** | Designed and dropped; kept here so the reason is not lost. |

## Collection — how alerts get in

### Implemented: read inside a signed-in GridPane tab

The extension pages `GET https://my.gridpane.com/notifications/recent?page=N` with the session your browser already has, inside an open `https://my.gridpane.com/` tab. It never marks an alert as read.

- Checks every 5 minutes by default (minimum 2).
- Pages back through a configurable overlap below the cursor — 2 hours by default, 0.5–24 — so an alert GridPane inserts late is still stored.
- Runs a resumable backfill (20 older pages per automatic check, up to 100 per manual run) and a 50-page gap audit.
- Pauses on 429 with 5/15/30/60-minute backoff and resumes the same page.
- Covers only the team currently selected in the panel, and only what GridPane keeps in the bell.

### Implemented: outbound copies

Two paths already take a copy out of the browser:

- **Manual export.** The archive page exports the current filtered view as CSV or JSON.
- **Webhook.** Each new alert is POSTed to a URL you configure, as full JSON, chat text or a Slack card, with `X-GPAlerts-Id` and an optional HMAC. Failed deliveries sit in an outbox and retry at 2, 4, 8 … 60 minutes.

### Planned

Four destination plans are drafted and parked **⏸ On Hold**. They are alternatives, not a queue: pick one before executing any of them.

| Plan | Option | Collection effect |
|---|---|---|
| [`plans/20261111-cloudflare-d1-destination.md`](https://github.com/managingwp/gridpane-alerts-extension/blob/main/plans/20261111-cloudflare-d1-destination.md) | Cloudflare Worker + D1 (recommended) | None — ingests pushed alerts |
| [`plans/20261111-notion-destination.md`](https://github.com/managingwp/gridpane-alerts-extension/blob/main/plans/20261111-notion-destination.md) | Notion database (runner-up) | None — ingests pushed alerts |
| [`plans/20261111-local-export-destination.md`](https://github.com/managingwp/gridpane-alerts-extension/blob/main/plans/20261111-local-export-destination.md) | Local folder snapshot | None — reads the existing archive |
| [`plans/20261111-google-sheets-destination.md`](https://github.com/managingwp/gridpane-alerts-extension/blob/main/plans/20261111-google-sheets-destination.md) | Google Sheets (revived) | None — ingests pushed alerts |

Collection changes already shipped — the configurable overlap, the tab-load retry and the Slack payload — are on [Features](./features.md).

### Possible

| Option | What it would take | Trade-off |
|---|---|---|
| **Scheduled local export** | Write a JSON/NDJSON snapshot from the archive page to a chosen folder (File System Access API) or Downloads (`downloads` API). | Local scripts get a fresh file; Claude in Chrome and remote tools still cannot read it. `downloads` adds a permission and a store justification. |
| **Worker ingest of the existing webhook** | Point the webhook at a Worker that stores the payload. | No extension change, but the Worker receives pushes; it does not collect. |

### The constraint that decides this

Collection cannot move to a server. GridPane authenticates with the browser session, and the extension can only read the bell from inside a signed-in tab. A Cloudflare Worker, a cron job or a Notion integration can only receive what the extension pushes — so every remote option is a **storage and read** option, built on the existing webhook, not a new collector.

## Storage — where the archive lives

### Implemented: IndexedDB in one Chrome profile

Database `gp-alerts` (version 2) keeps the alerts, the outbox, the key-value state and the sync log. It survives a page reload and an extension update, and it is destroyed by an uninstall. No other tool can read `chrome-extension://` storage directly, which is why the export and the webhook exist.

The outbox is already a delivery engine: oldest-first, per-record backoff, `X-GPAlerts-Id` for de-duplication, an optional HMAC signature. Any remote destination reuses it.

### Storage options

| Option | Status | Setup | Read path for Claude / scripts | Query and retention | De-duplication |
|---|---|---|---|---|---|
| **IndexedDB** | Implemented | None | Manual export only | Full-text search in the UI; deleted with the profile | Alert id is the key |
| **CSV / JSON export** | Implemented | None | A file you can open or import | Snapshot; you keep the files | N/A |
| **Existing webhook into a user-owned tool** | Possible | Whatever NocoDB/Baserow/Airtable/n8n/Make/Zapier needs | The tool's API | Depends on the tool | Key on `X-GPAlerts-Id` |
| **Cloudflare Worker + D1** | Possible (recommended) | Cloudflare account, Worker, D1, one secret | Authenticated JSON API or MCP | SQL, keep forever | Primary key + `ON CONFLICT(id) DO NOTHING` |
| **Cloudflare Worker + R2** | Possible | Cloudflare account, Worker, R2, one secret | Object reads through the Worker | Object listing, weaker queries | Object key `alerts/<id>.json` |
| **Notion database** | Possible (runner-up) | Integration token, database shared with it | Notion's UI and connector | Filters, no SQL | Query-before-create |
| **Google Sheets** | Abandoned | Google Cloud project, consent screen, OAuth client | Sheets connector | Row filters | Marker plus reconcile read |

Setup cost, current prices and free-tier limits are compared, with official links and an access date, in the [decision record](./storage-decisions.md#comparison). That page is the one to check before choosing; prices change.

### Cloudflare Worker + MCP (possible)

The record recommends **Cloudflare Worker + D1** for a durable, queryable copy with no OAuth review. The MCP layer below is an extension of that recommendation: it is not implemented, has no plan yet, and is listed so the shape is written down.

```text
GridPane tab ──► extension ──► webhook POST ──► Worker ──► D1 (and/or R2)
                                  HMAC + id                    │
                                                               └──► MCP server ──► Claude / scripts
```

**Ingest.** The Worker accepts the payload the extension already sends (or a batched `POST /v1/alerts` if a dedicated destination is added), verifies `X-GPAlerts-Signature` with the shared secret, validates each alert id, and upserts with `ON CONFLICT(id) DO NOTHING`. A retry is therefore harmless: the outbox can resend for an hour without creating duplicates.

**Schema sketch.** The record's schema is a single `alerts` table: `id` (primary key), `created_at`, `severity`, `title`, `message`, `server_label`, `server_ip`, `site_url`, `team_id`, `action_url`, `received_at`, with indexes on `created_at` and `severity`. R2 is the alternative when the archive is read as documents: one `alerts/<id>.json` object per alert, overwritten on retry.

**Read path.** `GET /v1/alerts?since=…&limit=…&severity=…&server=…` returns JSON for scripts. The MCP server (Streamable HTTP, bearer token) wraps the same queries in tools a model can call:

- `alerts.search` — filters by server, site, severity, text and date range.
- `alerts.get` — one alert by id.
- `servers.list` — servers and sites seen in the archive.
- `stats.summary` — counts per severity and per day.

Cloudflare's Agents SDK is one way to serve MCP from a Worker; the MCP specification defines the transport and tool schema ([Cloudflare Agents](https://developers.cloudflare.com/agents/), [MCP](https://modelcontextprotocol.io/), accessed 2026-11-11).

**Auth and privacy.** The ingest secret is an HMAC or bearer token the user sets in the extension and in the Worker; the MCP token is separate and read-only. Alerts, server names, IPs and author names leave the browser for the user's own Cloudflare account — the extension author operates no intermediary. The remote copy survives an uninstall, and the privacy policy and store data-use text must say so before it ships.

**Cost.** A personal archive fits the free tier: Workers Free includes 100,000 requests/day, D1 Free includes 5 GB storage and 5 million rows read/day, and R2 Free includes 10 GB-month with free egress, at the time of writing. Sources: [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/), [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/), [R2 pricing](https://developers.cloudflare.com/r2/pricing/) (accessed 2026-11-11). Re-check them before building; the record links the limits pages too.

**What it does not do in this plan.** No account, Worker, database, bucket, secret or MCP server is created, and the extension gains no code or permission. Connecting the webhook to a Worker needs no new extension permission; the record's dedicated Cloud archive card and batching are a separate implementation plan.

### Google Sheets (abandoned)

The abandoned plan proposed an extension-created spreadsheet with one row per alert, written through the Sheets API with `chrome.identity.getAuthToken` and the `drive.file` scope.

It was dropped before implementation on 2026-11-11. The setup was the blocker: a Google Cloud project, the Sheets API, an External consent screen, a Chrome-extension OAuth client bound to the extension id, and the public client id committed in `manifest.json` — a hard prerequisite the executor could not invent. On top of that came the `identity` permission and an OAuth scope in the store review, a per-destination outbox with 401/429 handling, and a marker-plus-reconcile guard because appending a row is not idempotent. That is a large price for a row store.

The full design and the revival checklist are in [the history page](../history/google-sheets-destination.md); the plan itself is [`plans/20261110-google-sheets-destination.md`](https://github.com/managingwp/gridpane-alerts-extension/blob/main/plans/20261110-google-sheets-destination.md).

### Choosing

The [decision record](./storage-decisions.md#recommendation) recommends the Cloudflare Worker + D1 and names Notion as the runner-up. In short:

- **D1** if you want a durable copy, SQL questions and a stable JSON API, and you are willing to run one small Worker.
- **Notion** if you want Claude to read it with no custom query code and can live with about 3 requests/second and a 2,000-character rich-text cap.
- **The existing webhook** if you already run a tool with an API — it is already shipped.
- **No change** if a manual export is enough; nothing is lost, but nothing outlives the profile.

The decision itself is still open: the record lists the drafted follow-up plans, and they are parked until one is chosen. The choice is also tracked in `plans/todos.md`.

## Sources

All sources accessed 2026-11-11.

- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/) and [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [Cloudflare R2](https://developers.cloudflare.com/r2/) and [R2 pricing](https://developers.cloudflare.com/r2/pricing/)
- [Cloudflare Agents (MCP on Workers)](https://developers.cloudflare.com/agents/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Notion API](https://developers.notion.com/) and [request limits](https://developers.notion.com/reference/request-limits)
- [Google Sheets API](https://developers.google.com/sheets/api) and [limits](https://developers.google.com/sheets/api/limits)
- [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_API)
- [Chrome downloads API](https://developer.chrome.com/docs/extensions/reference/api/downloads)
