---
title: "Abandoned: the Google Sheets destination (2026-11-11)"
description: What the Google Sheets design was, why it was abandoned before implementation, and what reviving it would take.
---

The abandoned Google Sheets destination (2026-11-11) would have created a spreadsheet in the user's own Drive and appended one row per new alert.

## What the design was

- **Direct Sheets API writes.** No Apps Script and no public web app: the extension would call `spreadsheets.create` and `values.append` itself, with the sheet titled **GridPane Alerts**, tab **Alerts**, a frozen header row and 11 columns.
- **OAuth through `chrome.identity`.** `getAuthToken` with only `https://www.googleapis.com/auth/drive.file`, which limits the extension to files it created and avoids Google's sensitive-scope verification.
- **Manifest changes.** The `identity` permission, an `oauth2` block with a Chrome-extension client id, and a `https://sheets.googleapis.com/*` host permission — a material Chrome Web Store review change, with a justification for each.
- **Per-destination delivery.** The existing outbox would carry a sheet half alongside the webhook half, so one failing destination could not block or duplicate the other; 401 would refresh the cached token once, 429 would use `Retry-After`, a `sheetsent` marker plus a reconcile read would prevent a duplicate append.
- **No archive backfill.** Connecting a sheet would not copy existing alerts; only new ones, plus an opt-in during a history import.

## Why it was abandoned

The design needed four pieces of human setup before the first line of delivery code could be tested:

1. A Google Cloud project with the Sheets API enabled.
2. An OAuth consent screen configured for the `drive.file` scope.
3. A Chrome-extension OAuth client bound to the extension id.
4. The client id committed in `manifest.json` — a hard prerequisite the executor could not invent.

That is a lot of setup and distribution overhead for a row-oriented store, and it moves a Google review surface into the extension's listing. The work reached the OAuth step, stopped on the missing client id, and was abandoned on 2026-11-11: the feature branch was deleted rather than left half-built.

## What it would take to revive it

- Create the Google Cloud project, consent screen and extension OAuth client, and supply the public client id.
- Design the OAuth step again from the notes above.
- Budget for the duplicate guard and the store-listing change; both are described above.
- Re-check the Sheets API quota and pricing before committing — the [decision record](../reference/storage-decisions.md) notes that quota overage may be charged.

## What replaced it

Nothing in the extension: there is still no sheet destination. The [decision record](../reference/storage-decisions.md) compares the alternatives and recommends a Cloudflare Worker + D1, with Notion as the runner-up. [Collection and storage](../reference/collection-and-storage.md) maps every option.
