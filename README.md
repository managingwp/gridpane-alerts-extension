# GridPane Alerts Archive

Keeps every alert from the GridPane notification bell in a searchable archive in your browser, and can POST each new alert to a webhook.

**Documentation:** https://managingwp.github.io/gridpane-alerts-extension/

<!-- BEGIN docs-index -->
| Section | Link |
|---------|------|
| Getting started | https://managingwp.github.io/gridpane-alerts-extension/getting-started/installation |
| First run | https://managingwp.github.io/gridpane-alerts-extension/getting-started/first-run |
| Sync, backfill and gaps | https://managingwp.github.io/gridpane-alerts-extension/guides/sync |
| Search and export | https://managingwp.github.io/gridpane-alerts-extension/guides/search-and-export |
| Webhook | https://managingwp.github.io/gridpane-alerts-extension/guides/webhook |
| Features | https://managingwp.github.io/gridpane-alerts-extension/reference/features |
| Roadmap | https://managingwp.github.io/gridpane-alerts-extension/reference/roadmap |
| Collection and storage | https://managingwp.github.io/gridpane-alerts-extension/reference/collection-and-storage |
| Limits | https://managingwp.github.io/gridpane-alerts-extension/reference/limits |
| Development | https://managingwp.github.io/gridpane-alerts-extension/contributing/development |
| Release | https://managingwp.github.io/gridpane-alerts-extension/contributing/release |
| Store submission | https://managingwp.github.io/gridpane-alerts-extension/contributing/chrome-web-store |
<!-- END docs-index -->

## Quick start

1. Install the extension: the Web Store listing when it opens, or a release zip loaded unpacked — see [Install](https://managingwp.github.io/gridpane-alerts-extension/getting-started/installation).
2. Keep a **my.gridpane.com** tab open and stay signed in. Chrome does not give the extension GridPane's session cookie, so alerts are read inside that tab.
3. Pin the bell icon. The first sync stores the newest page, then the automatic backfill pulls in the rest of the bell.

## What it does

- Reads `GET https://my.gridpane.com/notifications/recent?page=N` with your session, every 5 minutes by default, and never marks anything as read.
- Stores the full alert text in IndexedDB, with sortable columns, field-prefixed search, and CSV/JSON export of the filtered view.
- Backfills older pages automatically (20 per check, 100 on demand) and audits the bell for gaps.
- Forwards new alerts to a webhook as full JSON, chat text or a Slack card, with an id header, an optional HMAC signature and an outbox that retries for an hour.

## Limits

- Runs only while Chrome is open, and only for the team currently selected in the panel.
- Stores only what GridPane keeps in the notification bell.
- Everything is local to one Chrome profile; uninstalling deletes it, so export first.
- Uses internal panel endpoints, not GridPane's public API.

See [Limits](https://managingwp.github.io/gridpane-alerts-extension/reference/limits) and [Collection and storage](https://managingwp.github.io/gridpane-alerts-extension/reference/collection-and-storage) for the full story.

## For maintainers

There is no build step. The docs site has one of its own, under `website/`.

```bash
node --test
node scripts/package.mjs          # dist/gridpane-alerts-<version>.zip and dist/unpacked/
node scripts/package.mjs --check  # validate only, write nothing
```

To release, bump `version` in `manifest.json`, commit, then tag and push:

```bash
git tag v1.5.0
git push origin v1.5.0
```

The `release` workflow runs the tests and validation again, refuses a tag that does not match the manifest version, and attaches the zip to the GitHub Release.

See [Development](https://managingwp.github.io/gridpane-alerts-extension/contributing/development) and [Release](https://managingwp.github.io/gridpane-alerts-extension/contributing/release). The docs site's own rules are in [The docs site](https://managingwp.github.io/gridpane-alerts-extension/contributing/docs-site).

This is an unofficial extension. GridPane does not publish or support it.
