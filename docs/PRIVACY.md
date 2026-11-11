# GridPane Alerts Archive — Privacy Policy

Last updated: 2026-11-07

GridPane Alerts Archive ("the extension") is an unofficial browser extension that keeps a searchable copy of the alerts shown in your GridPane notification centre. This policy describes exactly what it does with your data.

## Summary

- Everything the extension stores stays in your browser, on your own device.
- There is no account, no analytics, no telemetry, and no server operated by the extension's author.
- The only network requests are to `my.gridpane.com` using the session you are already signed in with, and to a webhook URL if — and only if — you configure one.
- Your GridPane password and cookies are never read, stored or transmitted by the extension.

## What the extension stores on your device

- The alerts it reads from your GridPane notification centre: alert title, message, severity, timestamps, the server and site they relate to, and the name of the person who triggered them.
- The names and identifiers of your GridPane servers and sites, so old alerts still read properly after a server is deleted.
- Your settings: check interval, catch-up overlap window, which columns to show, webhook URL and format, and whether to forward imported history.
- The sync log: one row per check, with the cursor position, page and request counts, new alerts, webhook deliveries, duration and any error.
- A sync cursor and a small debug buffer of the most recent checks.

This data is kept in Chrome's IndexedDB and extension storage, inside your browser profile. It is not encrypted by the extension; it is protected by your operating system account and your Chrome profile in the same way as your browsing data.

## What leaves your device

**GridPane.** The extension sends read-only requests to `https://my.gridpane.com` for the notification, server and site data the panel itself uses, with the session your browser already has. If Chrome will not attach that session to the extension's own request, the extension repeats the same read-only request inside an open GridPane tab. These requests go only to GridPane, and they never mark an alert as read.

**Your webhook (optional).** If you configure a webhook, each new alert is sent to the exact URL you entered, as a JSON payload or as chat text. The payload contains the alert text and metadata listed above. If you set a signing secret, the request also carries an HMAC-SHA256 signature so your endpoint can verify it. The webhook URL and its content are under your control; the extension's author never sees them and operates no intermediary. If the webhook fails, the request is queued locally and retried with backoff until it succeeds or you discard it.

**Nothing else.** There is no analytics service, no crash reporting, no advertising, no data broker and no remote logging.

## What the extension does not collect

- Authentication information: it never reads, stores or transmits your GridPane password, cookies, tokens or session identifiers.
- Health, financial, location, web history or general user-activity data.
- Anything from pages other than my.gridpane.com.
- Any data for advertising, profiling, creditworthiness or lending.

## Retention and deletion

Data stays until you remove it:

- **Export first.** The archive page exports the current view as CSV or JSON.
- **Delete the archive** from Settings, which clears the stored alerts, the cursor, the sync log and the cached names.
- **Uninstall the extension**, which removes all of its storage from your browser profile.

## Third parties

The extension shares data with no third party. The only outbound data is the traffic to GridPane described above and, when you enable it, to the webhook endpoint you specify. GridPane's own handling of your account data is governed by GridPane's privacy policy.

## Children

The extension is a tool for server administrators and is not directed at children.

## Changes to this policy

If a future version changes how data is handled, this policy is updated before that version is published, and the change is described in the extension's release notes.

## Limited Use

The use of information received from the extension adheres to the Chrome Web Store User Data Policy, including the Limited Use requirements.

## Contact

Questions about this policy: {{CONTACT_EMAIL}}

This policy is published at https://managingwp.io/policies/#gridpane-alerts-archive.
