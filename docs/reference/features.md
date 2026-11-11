---
title: Features
description: Everything the extension does today, grouped by collection, archive, delivery and operations, with the file that owns each claim.
---

This page lists only behaviour that ships. Planned, possible and abandoned work is on the [Roadmap](./roadmap.md); where a copy of the archive can live is on [Collection and storage](./collection-and-storage.md).

## Collection

- **Reads the notification bell with your session.** `GET https://my.gridpane.com/notifications/recent?page=N`, the same endpoint the bell uses; it never marks an alert as read (`background.js`).
- **Scheduled checks.** Every 5 minutes by default; the interval is configurable with a 2-minute minimum (`background.js`, Settings).
- **Catch-up overlap.** Each check pages back below the cursor through a configurable overlap — 2 hours by default, 0.5–24 in Settings — so an alert GridPane inserts late is still stored (`lib/scan.js`, `background.js`).
- **Automatic backfill.** 20 older pages per automatic check and up to 100 per manual run, resumable from `state.backfill` (`background.js`).
- **Gap audit.** Walks up to 50 pages of the bell and reports what the archive is missing, newest first, with the pages covered and whether the cap was hit (`background.js`, Settings).
- **GridPane tab preflight.** Every manual and automatic run, the backfill, the gap audit and the name refresh stop before the first request without an open `https://my.gridpane.com/` tab; the banner offers **Open GridPane** (`lib/tabs.js`, `background.js`).
- **Retry on tab load.** Opening the tab after a no-tab check starts one automatic sync when it finishes loading, at most once per 30 seconds (`lib/tabs.js`, `background.js`).
- **Rate-limit handling.** A short `Retry-After` is waited out; otherwise automatic checks pause for 5, 15, 30 then 60 minutes, resuming the same page (`background.js`).
- **Name lookups.** Server and site names come from `/api/v1/servers` and `/api/v1/sites`, refreshed daily; names of deleted servers are kept (`background.js`).

## Archive

- **Local IndexedDB.** Database `gp-alerts` version 2 with the `notifications`, `outbox`, `kv` and `synclog` stores (`db.js`).
- **Full message text.** The Message column shows the whole alert without clipping; a row expands to the raw JSON with a copy button (`app.js`, `app.html`).
- **Sorting and columns.** Every column header sorts; a Columns menu adds server IP, read state and ID (`app.js`).
- **Search.** ANDed, case-insensitive terms with the `title:` `msg:` `server:` `ip:` `site:` `by:` `severity:` `id:` prefixes, quoted phrases and `-` exclusion (`app.js`).
- **Export.** CSV or JSON of the current filtered view (`app.js`).
- **Sync log.** The last 1,000 runs with result, cursor, pages, requests, 429s, new alerts, deliveries and duration, exportable as CSV (`db.js`, `app.js`).
- **Badge.** New-alert count since the page was last opened; `!` when the last sync could not run (`background.js`).

## Delivery

- **Full JSON webhook.** One POST per alert, oldest first, with the normalised notification and `sent_at` (`background.js`, `normalize.js`).
- **Chat text and Slack formats.** `{ "text": …, "content": … }` for Slack/Google Chat/Discord, and a Block Kit card with a severity emoji, fields, the alert text and an **Open GridPane** link, with Slack's limits enforced locally (`normalize.js`).
- **De-duplication and signing headers.** `X-GPAlerts-Event`, `X-GPAlerts-Id`, and an optional `X-GPAlerts-Signature: sha256=…` HMAC-SHA256 over the raw body (`background.js`).
- **Outbox with backoff.** Failed deliveries are queued and retried at 2, 4, 8 … 60 minutes, with Retry and Discard in Settings; the first history import is only forwarded when the option is ticked (`background.js`).

## Operations

- **Settings.** Check interval, catch-up overlap, visible columns, webhook URL/format/secret, history forwarding, the outbox, the gap audit and the backfill controls (`app.html`, `app.js`).
- **No build step.** `node --test` covers the pure helpers, the Slack payload and the packager; `scripts/package.mjs` builds and validates the zip (`tests/`, `scripts/package.mjs`).
- **Manual install and release.** A release zip loads unpacked; a tag builds and attaches the same zip (`docs/contributing/release.md`).

## Not in the archive

- Alerts that never become a bell notification, such as a transient progress toast.
- Teams other than the one currently selected in the panel.
- Anything from a browser profile where the extension is not installed.

See [Limits](./limits.md) for the full list.
