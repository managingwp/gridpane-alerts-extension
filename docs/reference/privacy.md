---
title: Data and privacy
description: What stays in the browser, what leaves it, and where the canonical privacy policy lives.
---

The full policy is published at [managingwp.io/policies/#gridpane-alerts-archive](https://managingwp.io/policies/#gridpane-alerts-archive). The source draft lives in the repository at [`docs/PRIVACY.md`](https://github.com/managingwp/gridpane-alerts-extension/blob/main/docs/PRIVACY.md) and is deliberately not part of this site, so there is only one published policy.

## Stays in the browser

- The alerts: title, message, severity, timestamps, server and site metadata, and the person who triggered them.
- Cached server and site names.
- Settings: check interval, catch-up overlap, visible columns, webhook URL and format, history-forwarding choice.
- The sync log, the cursor and a small debug buffer.

Everything is kept in the extension's IndexedDB and `chrome.storage.local`, inside one Chrome profile. It is protected by the operating-system account and the Chrome profile, not encrypted by the extension.

## Leaves the browser

- **GridPane.** Read-only requests to `https://my.gridpane.com` for the notification, server and site data the panel itself uses, with the session the browser already has.
- **Your webhook, if configured.** Each new alert is sent to the exact URL you entered, as JSON, chat text or a Slack card. The extension author sees none of it and operates no intermediary. The optional signing secret adds an HMAC-SHA256 header so your endpoint can verify the request.

There is no analytics, crash reporting, advertising or remote logging.

## Retention

Delete the archive from Settings, or uninstall the extension. Export first if you want a copy. A remote destination, when one is added, keeps its own copy — see [Collection and storage](./collection-and-storage.md).
