---
title: Webhook delivery
description: Send every new alert to your own endpoint as full JSON, chat text or a Slack Block Kit card, with de-duplication headers and an optional HMAC signature.
---

Settings → Webhook. Saving asks Chrome for permission to call that host.

## Full JSON

One POST per alert, oldest first:

```json
{
  "event": "gridpane.notification",
  "text": "[WARNING] FILESYSTEM Capacity Warning > 90% (web1)\n…",
  "notification": {
    "id": "uuid", "title": "…", "message": "plain text", "severity": "error|warning|info",
    "icon": "fa-exclamation", "created_at": "ISO-8601", "created_unix": 1793900000,
    "server": { "id": 12345, "label": "web1", "ip": "203.0.113.10" },
    "site": { "id": null, "url": null },
    "creator": { "name": "…", "email": "…" },
    "team_id": 1, "read": false, "action_url": null, "gridpane_url": "https://my.gridpane.com"
  },
  "sent_at": "ISO-8601"
}
```

## Chat text

`{ "text": "…", "content": "…" }`, which Slack, Google Chat and Discord incoming webhooks accept as-is.

## Slack message

One Block Kit attachment with a severity emoji and title, severity/server/site/created fields, the alert text and an **Open GridPane** link; the top-level `text` is the notification fallback. Slack's 150-character header and 3,000-character section limits are enforced locally with `…`, and `&`, `<` and `>` are escaped. It uses the same one-POST-per-alert queue, headers, signature and retry/backoff as the other formats.

## Headers

`X-GPAlerts-Event`, `X-GPAlerts-Id` (use it to de-duplicate), and with a secret set `X-GPAlerts-Signature: sha256=<hex HMAC-SHA256 of the raw body>`.

## Retries and history

Failed deliveries are queued and retried with backoff (2, 4, 8 … 60 minutes). Settings shows the queue with Retry / Discard buttons. Alerts from the first history import are not sent unless you tick that option.

Severity is a best guess from the alert title and icon (GridPane doesn't send one).

## Using the webhook as a storage destination

The webhook is also the bridge to an external archive: a Worker, a no-code tool or a self-hosted endpoint. [Collection and storage](../reference/collection-and-storage.md) compares the options.
