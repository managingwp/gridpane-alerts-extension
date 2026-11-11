---
title: Search, columns and export
description: Sort the archive, search with field prefixes, choose columns, and export the filtered view as CSV or JSON.
---

## The archive page

Click the toolbar icon. Columns: date, severity, alert, message, server, site, created by; plus optional server IP, read state and ID (Columns menu). Click a header to sort. The Message column shows the full alert text; click a row to expand it for the raw JSON and copy button.

## Search

Search terms are ANDed and case-insensitive. Field prefixes: `title:` `msg:` `server:` `ip:` `site:` `by:` `severity:` `id:`. Quote phrases, prefix `-` to exclude:

```text
disk web1
server:web1 severity:warning
title:"backup failed" -staging
```

## Export

Export CSV or JSON exports whatever is currently filtered.

## The badge

The badge shows how many new alerts arrived since you last opened the page; `!` means the last sync could not run (no GridPane tab open, signed out, or another error).
