---
title: First run
description: What the first sync does, how the automatic backfill fills the archive, and what the status line and badge mean.
---

## The first sync

Open the archive page from the toolbar. The first check reads the newest page of the GridPane notification bell, stores those alerts, and starts the automatic backfill that pulls in the older pages. The archive fills in over the next checks; **[Fill older history](../guides/sync.md#fill-older-history)** catches it up immediately.

## The status line

- *Backfilling older alerts · next page N* — the automatic backfill is still running.
- *GridPane tab not open* — no `https://my.gridpane.com/` tab was found, so the check stopped before the first request. The banner offers **Open GridPane**.
- *Not signed in* — the GridPane session is missing or expired; sign in and run a check.

## The badge

The badge counts the alerts that arrived since you last opened the archive page. A `!` means the last sync could not run: no GridPane tab, signed out, or another error.

## Where the data lives

Everything is stored locally in IndexedDB. Uninstalling the extension deletes it, so export first. See [Limits](../reference/limits.md) and [Collection and storage](../reference/collection-and-storage.md).
