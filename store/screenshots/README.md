# Store screenshots

Four screenshots at exactly **1280×800**, captured from a signed-in GridPane
account whose data is safe to publish. The Chrome Web Store accepts 1–5 and
downscales everything to 640×400, so keep text large enough to survive that.

## Redaction first

The archive shows real infrastructure: server labels, server IPs, site URLs and
the name and email of whoever triggered an alert. Do not publish any of it.

- Use a dedicated demo team or a test account, not a customer's team.
- If a real account is all you have, rename the servers and sites in the demo
  team first, and avoid screenshots where the author column or an IP is visible.
- Never crop it out and leave a blur: replace the data, then capture.

## Capture

1. Load the unpacked package from `dist/unpacked` (`chrome://extensions` →
   Developer mode → **Load unpacked**), and let one sync complete.
2. Open the archive page from the toolbar icon.
3. Open DevTools → **Toggle device toolbar** (`Ctrl+Shift+M`), set the viewport to
   **1280 × 800**, and close the drawer so no DevTools chrome is in the shot.
4. Capture the viewport only, not the full page — browser screenshots at exactly
   the viewport size, or the DevTools capture with the same dimensions.
5. Flatten the PNG onto an opaque background; the store rejects transparency.
6. Save with this naming:

| File | Shows |
|---|---|
| `01-archive.png` | The alert table with a realistic filter applied and the badge visible |
| `02-expanded-row.png` | One row expanded, showing the full message, the raw JSON and the copy button |
| `03-sync-log.png` | The Sync log tab with a few completed runs and the cursor column |
| `04-settings.png` | The Settings tab with the webhook card and the check interval |

## Verify

```bash
node scripts/check-screenshots.mjs store/screenshots
```

Expected: four lines naming 1280×800 files, no warnings, `4 file(s), 0 problem(s)`,
exit 0. A warning means the file still has an alpha channel; a problem means the
dimensions or the file format are wrong.
