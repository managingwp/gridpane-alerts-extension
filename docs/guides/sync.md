---
title: Sync, backfill and gaps
description: How the extension reads the GridPane notification bell, how the cursor and catch-up overlap work, and how to fill older history or audit gaps.
---

## How a check works

- Reads `GET https://my.gridpane.com/notifications/recent?page=N` with your session, the same endpoint the bell uses. It doesn't mark anything as read.
- Checks every 5 minutes (configurable, minimum 2). Each check pages back from the newest alert through a configurable overlap below the last completed sync (the cursor; 2 hours by default, 0.5–24 in Settings), with 1.5 s between pages. Alerts are stored by id, so anything GridPane added late — even below the cursor — is picked up.
- The cursor only moves once a check has walked past that overlap floor (or reached the end of history), and it never moves backwards: the newest alert on page 1 is the candidate, and a stale page-1 entry cannot pull it down. If a check is cut off by a rate limit or sign-out, the next one fills the gap.
- If Chrome won't send the GridPane cookie to the extension directly, it falls back to running the request inside an open GridPane tab. If you see "Not signed in" while you are signed in, keep a GridPane tab open.
- Server and site names come from `/api/v1/servers` and `/api/v1/sites`, refreshed once a day. Names are kept for deleted servers so old alerts still read properly.

## Automatic backfill

After the newest pages, every check continues below the cursor into the pages it has not read yet — 20 pages per automatic check, and up to 100 when you press **Sync now**. Progress lives in `state.backfill`, so a check stopped by a rate limit resumes at the same page instead of starting again, and a page number that shifts down when new alerts arrive can only cause a harmless re-read. The status line reads *Backfilling older alerts · next page N* while it runs. Backfilled alerts follow the same webhook opt-in as a history import.

## Fill older history

**Fill older history** (Settings) runs the same automatic backfill with the larger manual batch; it only makes the archive catch up sooner than the scheduled checks would.

## Check for gaps

Settings → **Check for gaps** walks the whole bell — up to 50 pages — and reports any alert GridPane still serves but the archive does not have, newest first, with the pages it covered and whether it hit the cap. If it finds any, **Import now** starts a catch-up backfill.

## Rate limits

On HTTP 429, a short `Retry-After` (30 s or less) is waited out in place. Otherwise the run stops and automatic checks pause for 5, 15, 30, then 60 minutes on repeated 429s (or longer if GridPane's `Retry-After` says so). **Sync now** ignores the pause.

## The GridPane tab requirement

Every manual and automatic check, the backfill, **Check for gaps** and the name refresh first look for an open `https://my.gridpane.com/` tab and stop before the first request when there is none. The status reads *GridPane tab not open*, the banner offers **Open GridPane** (it focuses the tab already open or opens `https://my.gridpane.com/`), and the Sync log records the manual attempt as *No GridPane tab*. Opening that tab after a no-tab check retries the sync automatically once it finishes loading (one retry per tab load); sign-out, error and rate-limit states still wait for **Sync now** or the next check. Automatic checks in that state update the status and badge without adding a Sync log row every 5 minutes, so real runs are not pushed out of the log.

## Sync log

Every run is recorded in the **Sync log** tab (last 1,000): result, cursor from/to, pages, requests, 429s, new alerts, webhook deliveries, duration and notes. It can be exported as CSV.
