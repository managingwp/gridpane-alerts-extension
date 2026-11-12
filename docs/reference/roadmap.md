---
title: Roadmap
description: Planned, possible and abandoned work, each labelled with its current status.
---

:::info
Statuses below are a snapshot taken on 2026-11-11. Nothing on this page is a release date or a promise.
:::

## Planned

Work that has a written design and has not shipped yet.

| Item | Status | What it covers |
|---|---|---|
| Cloudflare Worker + D1 | On hold | The [decision record](./storage-decisions.md)'s recommended destination: batched outbox delivery, idempotent ingest, a read endpoint. |
| Notion database | On hold | The runner-up: one page per alert through the Notion API. |
| Local folder snapshot | On hold | A scheduled JSON/NDJSON copy on disk, no server. |
| Google Sheets | On hold | The revived Sheets option, with its OAuth cost recorded. |

These are alternatives, not a queue. The record's [decision gate](./storage-decisions.md#decision-gate) says to choose one; the others stay parked or are abandoned.

## Possible

Options that are understood but have no approved design.

- **Cloudflare Worker + MCP read access.** A Worker receives the existing webhook, verifies the HMAC, stores alerts in D1 (or R2) and exposes an MCP server so Claude can query the archive. This is the recommended direction in the [decision record](./storage-decisions.md) extended with a read protocol; no Worker exists yet. See [Collection and storage](./collection-and-storage.md#cloudflare-worker--mcp-possible).
- **Scheduled local export.** The archive page writes a JSON or NDJSON snapshot to a chosen folder or the Downloads folder, so a local script has a fresh copy without a server.
- **Notion database.** One page per alert through the Notion API; the best human/Claude reading experience, with a request-rate and text-length cost.
- **A user-owned tool behind the webhook.** NocoDB, Baserow, Airtable, n8n, Make or Zapier can already receive the full JSON and own storage and reads.

## Abandoned

- **Google Sheets destination.** A design for an extension-created spreadsheet with one row per alert was abandoned before implementation on 2026-11-11. See [why](../history/google-sheets-destination.md).

## Shipped

Everything that works today is on [Features](./features.md). The same content is in the guides: [sync](../guides/sync.md), [search and export](../guides/search-and-export.md), [webhook](../guides/webhook.md).
