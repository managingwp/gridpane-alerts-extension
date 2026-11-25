---
title: Sync, history import and gaps
description: How the extension reads the GridPane notification bell, how the cursor and the one-page probe work, and how to import older history or audit gaps.
---

## How a check works

- Reads `GET https://my.gridpane.com/notifications/recent?page=N` with your session, the same endpoint the bell uses. It doesn't mark anything as read.
- Checks every 5 minutes by default, 15 seconds to 24 hours in Settings. Each check reads from the newest alert down to the last alert stored by the previous check (the cursor), with 1.5 s between pages. It then reads the page after the last stored alert: if every alert on that page is already archived, the check stops; if the page holds a late alert, the walk keeps going until a page adds nothing new. Alerts are stored by id, so a re-read is harmless.
- The late-batch catch-up (2 pages by default, 1–10 in Settings) is a page budget, not the routine walk length. It only limits how far a late batch found below the last stored alert is followed. A late alert inserted deeper than that is found by **Check for gaps** or **Fill older history**, not by a routine check.
- Intervals under a minute run from a hidden extension page instead of `chrome.alarms`, because a published extension's alarms cannot repeat faster than 30 seconds. A shorter interval sends more checks, but each routine check stops at the last stored alert plus one confirmation page, so it adds checks rather than multiplying the pages read. A backlog of new alerts still takes the pages it needs.
- The cursor only moves once a check has confirmed the page after the last stored alert (or reached the end of history), and it never moves backwards: the newest alert on page 1 is the candidate, and a stale page-1 entry cannot pull it down. If a check is cut off by a rate limit or sign-in problem, the next one fills the gap. If the new-alert walk hits its 50-page limit (200 on a manual run) before confirming the cursor, the archive shows a gap banner and **Fill older history** takes the larger walk.
- If Chrome won't send the GridPane cookie to the extension directly, it falls back to running the request inside an open GridPane tab. If you see "Not signed in" while you are signed in, keep a GridPane tab open.
- Server and site names come from `/api/v1/servers` and `/api/v1/sites`, refreshed once a day. Names are kept for deleted servers so old alerts still read properly.

Settings saves each card independently: **Save sync settings** stores the interval and the late-batch catch-up, and **Save webhook settings** stores the webhook card, so changing one does not undo the other.

## Importing older history

Importing history is off by default: a check reads only the newest alerts down to the last stored alert and its confirmation page. **Fill older history** (Settings) starts a resumable pass below those pages — up to 100 pages in the manual run, then about 20 pages per automatic check (one page per 15 seconds) until GridPane has no more pages. Progress lives in `state.backfill`, so a check stopped by a rate limit resumes at the same page instead of starting again, and a page number that shifts down when new alerts arrive can only cause a harmless re-read. The status line reads *Backfilling older alerts · next page N* while it runs. Imported alerts follow the same webhook opt-in as the rest of history.

## Fill older history

**Fill older history** starts the import and, if it does not finish, the button becomes **Continue backfill (page N)** so the next press resumes it. **Re-import from page 1** arms a fresh pass at the newest page; the next check or **Fill older history** runs it. Alerts are stored by id, so re-reading is harmless.

## Check for gaps

Settings → **Check for gaps** walks the whole bell — up to 50 pages — and reports any alert GridPane still serves but the archive does not have, newest first, with the pages it covered and whether it hit the cap. If it finds any, **Import now** starts a catch-up import.

## Rate limits

On HTTP 429, a short `Retry-After` (30 s or less) is waited out in place. Otherwise the run stops and automatic checks pause for 5, 15, 30, then 60 minutes on repeated 429s (or longer if GridPane's `Retry-After` says so). **Sync now** ignores the pause.

## The GridPane tab requirement

Every manual and automatic check, the history import, **Check for gaps** and the name refresh first look for an open `https://my.gridpane.com/` tab and stop before the first request when there is none. The status reads *GridPane tab not open*, the banner offers **Open GridPane** (it focuses the tab already open or opens `https://my.gridpane.com/`), and the Sync log records the manual attempt as *No GridPane tab*. Opening that tab after a no-tab check retries the sync automatically once it finishes loading (one retry per tab load); sign-out, error and rate-limit states still wait for **Sync now** or the next check. Automatic checks in that state update the status and badge without adding a Sync log row, so real runs are not pushed out of the log.

## Sync log

The **Sync log** tab keeps the last 1,000 rows: result, cursor from/to, pages, requests, 429s, new alerts, webhook deliveries, duration and notes. Every manual run is recorded, and so is an automatic run that stores a new alert. Routine automatic runs — including failures and rate limits — add at most one row every five minutes, and an automatic no-tab check adds none, so a 15-second interval cannot flush the log in a few hours. It can be exported as CSV.
