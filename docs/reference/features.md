---
title: Features
description: Everything the extension does today, grouped by collection, archive, delivery and operations, with the file that owns each claim.
---

This page lists only behaviour that ships. Planned, possible and abandoned work is on the [Roadmap](./roadmap.md); where a copy of the archive can live is on [Collection and storage](./collection-and-storage.md).

## Collection

- **Reads the notification bell with your session.** `GET https://my.gridpane.com/notifications/recent?page=N`, the same endpoint the bell uses; it never marks an alert as read (`background.js`).
- **Scheduled checks.** Every 5 minutes by default, 15 seconds to 24 hours in Settings. Intervals under a minute run from a worker in an offscreen document, because published alarms cannot repeat faster than 30 seconds (`lib/polling.js`, `background.js`, `timer.js`).
- **Boundary probe.** Each check reads from the newest alert to the last alert stored by the previous check, then reads the page after the last stored alert. It stops when that page is already archived and keeps going only while a page adds something new (`lib/scan.js`, `background.js`).
- **Late-batch catch-up.** A late batch found below the last stored alert is followed no further than the configured page budget — 2 pages by default, 1–10 in Settings. A late alert deeper than that is left to the gap audit (`lib/scan.js`, `background.js`).
- **Manual history import.** Off by default. **Fill older history** starts a resumable pass below the newest pages: up to 100 pages in the manual run, then about 20 pages per automatic check, paced at about one page per 15 seconds, resumable from `state.backfill` (`lib/polling.js`, `background.js`).
- **Gap audit.** Walks up to 50 pages of the bell and reports what the archive is missing, newest first, with the pages covered and whether the cap was hit (`background.js`, Settings).
- **GridPane tab preflight.** Every manual and automatic run, the history import, the gap audit and the name refresh stop before the first request without an open `https://my.gridpane.com/` tab; the banner offers **Open GridPane** (`lib/tabs.js`, `background.js`).
- **Retry on tab load.** Opening the tab after a no-tab check starts one automatic sync when it finishes loading, at most once per 30 seconds (`lib/tabs.js`, `background.js`).
- **Rate-limit handling.** A short `Retry-After` is waited out; otherwise automatic checks pause for 5, 15, 30 then 60 minutes, resuming the same page. A shorter interval sends more checks; a routine check stays a page or two, while a backlog of new alerts takes the pages it needs (`background.js`).
- **Name lookups.** Server and site names come from `/api/v1/servers` and `/api/v1/sites`, refreshed daily; names of deleted servers are kept (`background.js`).

## Archive

- **Local IndexedDB.** Database `gp-alerts` version 2 with the `notifications`, `outbox`, `kv` and `synclog` stores (`db.js`).
- **Full message text.** The Message column shows the whole alert without clipping; a row expands to the raw JSON with a copy button (`app.js`, `app.html`).
- **Copy a cell.** Hovering a row shows a small copy button beside the Message, Server and Site values; it copies exactly what the cell shows and leaves the row collapsed (`app.js`, `app.css`).
- **Sorting and columns.** Every column header sorts; a Columns menu adds server IP, read state and ID (`app.js`).
- **Search.** ANDed, case-insensitive terms with the `title:` `msg:` `server:` `ip:` `site:` `by:` `severity:` `id:` prefixes, quoted phrases and `-` exclusion (`app.js`).
- **Export.** CSV or JSON of the current filtered view (`app.js`).
- **Sync log.** The last 1,000 rows: every manual run and every automatic run that stores an alert from the new-alert walk, with routine automatic rows at most once every five minutes, plus result, cursor, pages, requests, 429s, new alerts, deliveries and duration, exportable as CSV (`db.js`, `app.js`, `lib/polling.js`).
- **Badge.** New-alert count since the page was last opened; `!` when the last sync could not run (`background.js`).

## Delivery

- **Full JSON webhook.** One POST per alert, oldest first, with the normalised notification and `sent_at` (`background.js`, `normalize.js`).
- **Chat text and Slack formats.** `{ "text": …, "content": … }` for Slack/Google Chat/Discord, and a Block Kit card with a severity emoji, fields, the alert text and an **Open GridPane** link, with Slack's limits enforced locally (`normalize.js`).
- **De-duplication and signing headers.** `X-GPAlerts-Event`, `X-GPAlerts-Id`, and an optional `X-GPAlerts-Signature: sha256=…` HMAC-SHA256 over the raw body (`background.js`).
- **Outbox with backoff.** Failed deliveries are queued and retried at 2, 4, 8 … 60 minutes, with Retry and Discard in Settings; the first history import is only forwarded when the option is ticked (`background.js`).
- **Manual webhook backfill.** Replays the last N stored alerts (30 by default, up to 500) oldest first through the same outbox; duplicates are expected and de-duplicated on `X-GPAlerts-Id` (`background.js`, `lib/webhook.js`, Settings).

## Operations

- **Settings.** Check interval (15 seconds–24 hours), late-batch catch-up pages, visible columns, webhook URL/format/secret, history forwarding, the last N stored alerts backfill, the outbox, the gap audit and the history-import controls; the Sync and Webhook cards save independently and write only changed fields, and a local JSON backup restores both cards without touching the archive (`app.html`, `app.js`, `lib/settings.js`, `lib/settings-backup.js`).
- **No build step.** `node --test` covers the pure helpers, the Slack payload and the packager; `scripts/package.mjs` builds and validates the zip (`tests/`, `scripts/package.mjs`).
- **Manual install and release.** A release zip loads unpacked; a tag builds and attaches the same zip (`docs/contributing/release.md`).

## Not in the archive

- Alerts that never become a bell notification, such as a transient progress toast.
- Teams other than the one currently selected in the panel.
- Anything from a browser profile where the extension is not installed.

See [Limits](./limits.md) for the full list.
