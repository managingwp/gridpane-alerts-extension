# GridPane Alerts Archive (Chrome extension)

Keeps every alert from the GridPane notification bell in a searchable archive in your browser, and can POST each new alert to a webhook.

## Install

1. Unzip this folder somewhere permanent (Chrome loads it from that folder).
2. Open `chrome://extensions`, turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick the `gridpane-alerts` folder.
4. Pin the bell icon. The archive page opens automatically. The first sync stores only the newest page of alerts and starts tracking from there.

You need to be signed in to my.gridpane.com in the same Chrome profile. To update, replace the folder's files and click the reload icon on the extension card; your stored alerts are kept.

## How it works

- Reads `GET https://my.gridpane.com/notifications/recent?page=N` with your session, the same endpoint the bell uses. It doesn't mark anything as read.
- Checks every 5 minutes (configurable, minimum 2). Each check pages back only until it reaches the newest alert from the last completed sync (the cursor), with 1.5 s between pages. Nothing older is requested.
- The cursor only moves once a check has reached it, so if a check is cut off partway (rate limit, sign-out), the next one fills the gap.
- Older history is a manual, resumable import in Settings.
- **Rate limits (HTTP 429):** a short `Retry-After` (30 s or less) is waited out in place. Otherwise the run stops and automatic checks pause for 5, 15, 30, then 60 minutes on repeated 429s (or longer if GridPane's `Retry-After` says so). Sync now ignores the pause.
- Server and site names come from `/api/v1/servers` and `/api/v1/sites`, refreshed once a day. Names are kept for deleted servers so old alerts still read properly.
- Every run is recorded in the **Sync log** tab (last 1,000): result, pages, requests, 429s, new alerts, webhook deliveries, duration and notes. It can be exported as CSV.
- If Chrome won't send the GridPane cookie to the extension directly, it falls back to running the request inside an open GridPane tab. If you see "Not signed in" while you are signed in, keep a GridPane tab open.
- Everything is stored locally in IndexedDB. Uninstalling the extension deletes it, so export first.

## Archive page

Click the toolbar icon. Columns: date, severity, alert, message, server, site, created by; plus optional server IP, read state and ID (Columns menu). Click a header to sort, a row to expand it (full message, raw JSON, copy button).

Search terms are ANDed and case-insensitive. Field prefixes: `title:` `msg:` `server:` `ip:` `site:` `by:` `severity:` `id:`. Quote phrases, prefix `-` to exclude:

    disk web1
    server:web1 severity:warning
    title:"backup failed" -staging

Export CSV or JSON exports whatever is currently filtered.

The badge shows how many new alerts arrived since you last opened the page; `!` means the last sync failed (usually signed out).

## Webhook

Settings → Webhook. Saving asks Chrome for permission to call that host.

- **Full JSON**: one POST per alert, oldest first:

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

- **Chat text**: `{ "text": "…", "content": "…" }`, which Slack, Google Chat and Discord incoming webhooks accept as-is.

Headers: `X-GPAlerts-Event`, `X-GPAlerts-Id` (use it to de-duplicate), and with a secret set `X-GPAlerts-Signature: sha256=<hex HMAC-SHA256 of the raw body>`.

Failed deliveries are queued and retried with backoff (2, 4, 8 … 60 minutes). Settings shows the queue with Retry / Discard buttons. Alerts from the first history import are not sent unless you tick that option.

Severity is a best guess from the alert title and icon (GridPane doesn't send one).

## Limits

- Only runs while Chrome is open.
- Covers the GridPane team currently selected in the panel.
- Uses internal panel endpoints, not GridPane's public API, so a GridPane front-end change could break it.
