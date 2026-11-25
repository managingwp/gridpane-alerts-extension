---
title: First run
description: What the first sync does, how history import works, and what the status line and badge mean.
---

## The first sync

Open the archive page from the toolbar. The first check reads the newest page of the GridPane notification bell and stores those alerts. It does not read older pages: **[Fill older history](../guides/sync.md#fill-older-history)** imports them when you ask, and the next automatic checks continue the pass if it does not finish.

## The status line

- *Backfilling older alerts · next page N* — a history import you started is still running.
- *GridPane tab not open* — no `https://my.gridpane.com/` tab was found, so the check stopped before the first request. The banner offers **Open GridPane**.
- *Not signed in* — the GridPane session is missing or expired; sign in and run a check.

A gap banner appears only when the new-alert walk could not confirm the last stored alert within its page limit; **Fill older history** takes a larger walk to catch up.

## The badge

The badge counts the alerts that arrived since you last opened the archive page. A `!` means the last sync could not run: no GridPane tab, signed out, or another error.

## Trying it with sample data

Settings → **Sample data** → **Load sample data** fills the archive, the Sync log and the webhook preview with 24 fictional alerts, so you can try the views before the first sync. It replaces the alerts, log and webhook settings stored in this browser and pauses automatic sync until you press **Remove sample data**. GridPane is not affected.

## Where the data lives

Everything is stored locally in IndexedDB. Uninstalling the extension deletes it, so export first. See [Limits](../reference/limits.md) and [Collection and storage](../reference/collection-and-storage.md).
