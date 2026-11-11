---
title: Install
description: Install GridPane Alerts Archive from the Chrome Web Store or a release zip, and give it the signed-in GridPane tab it needs.
---

## From the Chrome Web Store

Not published yet — this section gets the listing link once the first version has been reviewed. That is the recommended install: it installs and updates without any developer settings.

## Manually, from a release

1. Download `gridpane-alerts-<version>.zip` from the [latest release](https://github.com/managingwp/gridpane-alerts-extension/releases/latest) and unzip it somewhere permanent (Chrome loads the extension from that folder).
2. Open `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick the unzipped folder.
4. Pin the bell icon. The archive page opens automatically. The first sync stores the newest page of alerts, then starts the automatic backfill that pulls in the rest of the bell.

Keep a **my.gridpane.com tab open** while you use the extension: Chrome does not give the extension GridPane's session cookie, so alerts are read inside that tab. With no tab open, a check stops before making any request and the banner offers **Open GridPane**.

You need to be signed in to my.gridpane.com in the same Chrome profile.

An unpacked install only stays enabled while Developer mode is on: Chrome disables it if you switch developer mode off. Use the Web Store listing for normal use.

## Updating

Replace the folder's files and click the reload icon on the extension card; your stored alerts are kept. A Web Store install updates on its own.

## Next step

[First run](./first-run.md) covers the first sync, the backfill and the status line.
