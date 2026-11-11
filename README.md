# GridPane Alerts Archive (Chrome extension)

Keeps every alert from the GridPane notification bell in a searchable archive in your browser, and can POST each new alert to a webhook.

## Install

### From the Chrome Web Store

Not published yet — this section gets the listing link once the first version has been reviewed. That is the recommended install: it installs and updates without any developer settings.

### Manually, from a release

1. Download `gridpane-alerts-<version>.zip` from the [latest release](https://github.com/managingwp/gridpane-alerts-extension/releases/latest) and unzip it somewhere permanent (Chrome loads the extension from that folder).
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick the unzipped folder.
4. Pin the bell icon. The archive page opens automatically. The first sync stores only the newest page of alerts and starts tracking from there.

Keep a **my.gridpane.com tab open** while you use the extension: Chrome does not give the extension GridPane's session cookie, so alerts are read inside that tab. With no tab open, a check stops before making any request and the banner offers **Open GridPane**.

An unpacked install only stays enabled while Developer mode is on: Chrome disables it if you switch developer mode off. Use the Web Store listing for normal use.

You need to be signed in to my.gridpane.com in the same Chrome profile. To update an unpacked install, replace the folder's files and click the reload icon on the extension card; your stored alerts are kept.

## How it works

- Reads `GET https://my.gridpane.com/notifications/recent?page=N` with your session, the same endpoint the bell uses. It doesn't mark anything as read.
- Checks every 5 minutes (configurable, minimum 2). Each check pages back from the newest alert through a 2-hour overlap below the last completed sync (the cursor), with 1.5 s between pages. Alerts are stored by id, so anything GridPane added late — even below the cursor — is picked up.
- The cursor only moves once a check has walked past that 2-hour floor (or reached the end of history). If a check is cut off by a rate limit or sign-out, the next one fills the gap. If it hits the 50-page cap, the cursor stays put, the banner says the gap needs **Import older history**, and automatic checks keep collecting page 1 only until the import runs.
- **Gaps:** Settings → **Check for gaps** compares the newest 12 pages of the bell with the archive and reports any alert GridPane still serves but the archive does not have. If a check hits the 50-page cap, the banner says so and automatic checks keep collecting page 1 only; **Import older history** backfills the rest.
- Older history is a manual, resumable import in Settings.
- **Rate limits (HTTP 429):** a short `Retry-After` (30 s or less) is waited out in place. Otherwise the run stops and automatic checks pause for 5, 15, 30, then 60 minutes on repeated 429s (or longer if GridPane's `Retry-After` says so). Sync now ignores the pause.
- Server and site names come from `/api/v1/servers` and `/api/v1/sites`, refreshed once a day. Names are kept for deleted servers so old alerts still read properly.
- Every run is recorded in the **Sync log** tab (last 1,000): result, cursor from/to, pages, requests, 429s, new alerts, webhook deliveries, duration and notes. It can be exported as CSV.
- If Chrome won't send the GridPane cookie to the extension directly, it falls back to running the request inside an open GridPane tab. If you see "Not signed in" while you are signed in, keep a GridPane tab open.
- **Needs an open my.gridpane.com tab.** Every manual and automatic check, the history import, **Check for gaps** and the name refresh first look for an open `https://my.gridpane.com/` tab and stop before the first request when there is none. The status reads *GridPane tab not open*, the banner offers **Open GridPane** (it focuses the tab already open or opens `https://my.gridpane.com/`), and the Sync log records the manual attempt as *No GridPane tab*. Automatic checks in that state update the status and badge without adding a Sync log row every 5 minutes, so real runs are not pushed out of the log.
- Everything is stored locally in IndexedDB. Uninstalling the extension deletes it, so export first.

## Archive page

Click the toolbar icon. Columns: date, severity, alert, message, server, site, created by; plus optional server IP, read state and ID (Columns menu). Click a header to sort. The Message column shows the full alert text; click a row to expand it for the raw JSON and copy button.

Search terms are ANDed and case-insensitive. Field prefixes: `title:` `msg:` `server:` `ip:` `site:` `by:` `severity:` `id:`. Quote phrases, prefix `-` to exclude:

    disk web1
    server:web1 severity:warning
    title:"backup failed" -staging

Export CSV or JSON exports whatever is currently filtered.

The badge shows how many new alerts arrived since you last opened the page; `!` means the last sync could not run (no GridPane tab open, signed out, or another error).

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
- Only stores what GridPane keeps in the notification bell. A transient pop-up that never becomes a bell notification (for example a progress toast) is out of reach; the gap audit can only compare what the bell still serves.
- Uses internal panel endpoints, not GridPane's public API, so a GridPane front-end change could break it.

## For maintainers

There is no build step. `scripts/package.mjs` copies the runtime files into a flat zip with `manifest.json` at the root, validates the manifest (version format, 132-character description, icon sizes, no `key`/`update_url`, no remote code), and prints the archive's sha256. `dist/` is ignored by git.

```bash
node --test
node scripts/package.mjs          # dist/gridpane-alerts-<version>.zip and dist/unpacked/
node scripts/package.mjs --check  # validate only, write nothing
```

To release, bump `version` in `manifest.json`, commit, then tag and push:

```bash
git tag v1.4.0
git push origin v1.4.0
```

The `release` workflow runs the tests and the validation again, refuses a tag that does not match the manifest version, and attaches `gridpane-alerts-<version>.zip` to the GitHub Release. That same zip is what the Chrome Web Store dashboard accepts, and what a manual install unpacks.

See `docs/CHROME-WEB-STORE.md` for the store submission steps and `store/listing.json` for the listing copy.

