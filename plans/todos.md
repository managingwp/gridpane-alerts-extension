# Todos — gridpane-alerts-extension


- [ ] webhook option for slack template
- [ ] investigate temporary storage somewhere on computer or remotely using a cloudflare database or worker etc, notion
## Testing
- [ ] Verify in Chrome with the unpacked extension: open a multi-line alert (e.g. Cloning/Migrate Notice), confirm the Message column shows the full text without clipping, then check the expanded row's Copy JSON and the Columns hide/show toggle.

## Follow-ups
- [ ] Verify the extension end-to-end in Chrome: reload, run Start over from page 1 → Import older history, Check for gaps (expect none in the newest 96), simulate syncGap, and confirm a new alert lands (from 20261106-alert-gap-recovery)
- [ ] Consider making the 2-hour overlap a setting if a busier fleet needs a different window (from 20261106-alert-gap-recovery)
- [ ] Publish docs/PRIVACY.md at https://managingwp.io/policies/#gridpane-alerts-archive, replace the CONTACT_EMAIL placeholder, then confirm store/listing.json privacyPolicyUrl matches — publish the policy page (from 20261107-package-and-publish)
- [ ] Capture the four 1280x800 store screenshots from a redacted demo team into store/screenshots/ and confirm node scripts/check-screenshots.mjs store/screenshots exits 0 — store listing assets (from 20261107-package-and-publish)
- [ ] Upload dist/gridpane-alerts-1.2.0.zip to the Chrome Web Store dashboard, fill the tabs from store/listing.json, and submit as Private with trusted testers — first store submission (from 20261107-package-and-publish)
- [ ] Load dist/unpacked/ in Chrome with Developer mode on and confirm the archive page, Settings and Sync log render and the version matches manifest.json — unpacked smoke test (from 20261107-package-and-publish)
- [ ] Load dist/unpacked/ in Chrome, close every GridPane tab, and confirm the no-tab status, banner, badge, single manual Sync log row, and that Open GridPane focuses an existing tab or opens https://my.gridpane.com/ — the four Manual/UI checks from 20261107-require-gridpane-tab
- [ ] Consider retrying the sync once the GridPane tab finishes loading (chrome.tabs.onUpdated) instead of asking the user to press Sync now — deferred from 20261107-require-gridpane-tab
