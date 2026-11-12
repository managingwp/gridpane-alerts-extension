# Store screenshots

Four screenshots at exactly **1280×800**, captured from the extension’s sample
data in a dedicated Chrome profile. The Chrome Web Store accepts 1–5 and
downscales everything to 640×400, so keep text large enough to survive that.

## Use a test profile

Sample data replaces the alerts, Sync log and webhook settings stored in the
profile that loads it. Use a dedicated Chrome profile — not the one holding a
customer’s archive — and remove the sample data when the capture session ends.
The loader never contacts GridPane or the webhook.

## Capture

1. Build and load the unpacked package:
   `node scripts/package.mjs`, then `chrome://extensions` → Developer mode →
   **Load unpacked** → `dist/unpacked/`.
2. Open the archive from the toolbar icon, then **Settings → Sample data →
   Load sample data** and accept the confirm. The archive now holds 24 fictional
   alerts, the Sync log holds nine runs, and the webhook card shows a Slack
   sample.
3. On **Alerts**, apply a realistic filter such as `severity:warning` in the
   search box, or enable **Group similar** to collapse the four disk alerts.
4. Open DevTools → **Toggle device toolbar** (`Ctrl+Shift+M`), set the viewport
   to **1280 × 800**, and close the drawer so no DevTools chrome is in the shot.
5. Capture the viewport only, not the full page — browser screenshots at exactly
   the viewport size, or the DevTools capture with the same dimensions.
6. Flatten the PNG onto an opaque background; the store rejects transparency.
7. Save with this naming:

| File | Shows |
|---|---|
| `01-archive.png` | The alert table with a filter applied or Group similar on, and the newest alerts |
| `02-expanded-row.png` | The Cloning/Migrate alert expanded, showing the full message, the raw JSON and the copy button |
| `03-sync-log.png` | The Sync log tab with the nine runs and the cursor column |
| `04-settings.png` | The Sync and Webhook cards with the 5-minute interval and the sample webhook URL |

8. Press **Settings → Sample data → Remove sample data** when finished, so the
   profile is clean for the next session.

The toolbar badge is browser chrome, not part of a viewport capture. If a shot
needs it, take a separate browser-window screenshot outside the store set.

## If you use real data instead

The archive shows real infrastructure: server labels, server IPs, site URLs and
the name and email of whoever triggered an alert. Do not publish any of it.

- Use a dedicated demo team or a test account, not a customer's team.
- If a real account is all you have, rename the servers and sites in the demo
  team first, and avoid screenshots where the author column or an IP is visible.
- Never crop it out and leave a blur: replace the data, then capture.

## Verify

```bash
node scripts/check-screenshots.mjs store/screenshots
```

Expected: four lines naming 1280×800 files, no warnings, `4 file(s), 0 problem(s)`,
exit 0. A warning means the file still has an alpha channel; a problem means the
dimensions or the file format are wrong.
