---
title: Chrome Web Store submission
description: Fill the Chrome Web Store dashboard from the repository's store files, with the review traps this extension has.
---

How to get `gridpane-alerts-<version>.zip` published. The listing copy lives in `store/listing.json`, the long description in `store/description.md`, and the privacy policy in `docs/PRIVACY.md` — this page is the process that fills the dashboard from them.

## Before the first submission

| Item | Value |
|---|---|
| Developer account | One-time US$5 at [chrome.google.com/webstore/devconsole](https://chrome.google.com/webstore/devconsole), with the publisher account's **2-Step Verification** enabled first — publishing is blocked without it |
| Publisher | Use a dedicated address; the account email cannot be changed later |
| Item slots | A new publisher starts with **2** published extensions; request more from the dashboard if needed |
| Trader status | Declare trader or non-trader for EEA consumer law. A free, non-commercial extension is normally non-trader; a trader must publish contact details |
| Contact email | Verified on the Account page; it is what Google emails about rejections and takedowns |
| Privacy policy | Published at `privacyPolicyUrl` from `store/listing.json` and reachable without a redirect loop |
| Screenshots | Four at exactly 1280×800, captured from a redacted demo team — see `store/screenshots/README.md` |
| Package | `node scripts/package.mjs` output, with `manifest.json` at the zip root |

The extension's `name`, `version` and `description` come from the package and are **frozen at upload**. A typo means editing `manifest.json`, bumping the version and uploading again.

## Upload

1. Developer Dashboard → **Add new item**.
2. Upload `dist/gridpane-alerts-<version>.zip`. The dashboard rejects a bad manifest before creating the item.
3. Work through the tabs below. Every value comes from a file, so the form is transcription rather than invention.

## Store listing tab

| Field | Source |
|---|---|
| Name (≤75) | `manifest.json` `name` |
| Summary (≤132) | `manifest.json` `description`, copied as `store/listing.json` `summary` |
| Description (≤16,000) | `store/description.md` |
| Category | `store/listing.json` `category` (`Developer Tools`) |
| Language | `store/listing.json` `language` |
| Store icon (128×128) | taken from the package (`icons/icon128.png`) |
| Screenshots (1–5, 1280×800 or 640×400) | `store/screenshots/*.png` |
| Small promo tile (440×280) | optional |
| Marquee (1400×560) | optional |
| Support URL | `store/listing.json` `supportUrl` |
| Homepage URL | `store/listing.json` `homepageUrl` |

Keep the disclaimer line from `store/listing.json` `disclaimer` in the description: the extension is unofficial, and the store's impersonation policy is stricter about third-party names than it looks.

## Privacy tab

| Field | Answer |
|---|---|
| Single purpose | `store/listing.json` `singlePurpose` |
| Permission justifications | one per key in `store/listing.json` `justifications`; the build fails if the key set and the manifest disagree |
| Remote code | `store/listing.json` `remoteCode` — *No, I am not using remote code* |
| Data usage | `store/listing.json` `dataUse` |
| Certifications | `store/listing.json` `certifications` |
| Privacy policy URL | `store/listing.json` `privacyPolicyUrl` |

`node scripts/package.mjs --check` is the guard: it fails when a manifest permission has no justification, or a justification names something the manifest does not request.

## Distribution tab

- Paid or free: **free**.
- Countries: all, unless there is a reason to restrict.
- Visibility: start **Private** with the trusted testers listed on the Account page, move to **Unlisted** for a wider beta, then **Public**.

## Test instructions tab

Paste `store/listing.json` `testInstructions`. This matters more than usual here: every screen is empty without a GridPane session, and a reviewer who cannot reach a working state may reject the item as unverifiable. Provide a test account with some alerts in it if GridPane will issue one; otherwise the instructions must show that Settings, the sync log, search, export and webhook configuration all work from an empty archive.

## Review

Review time varies with the permissions requested; broad optional host permissions and account-bound functionality tend to take longer. After approval you can publish immediately or defer — a staged submission expires after 30 days and must be reviewed again.

### What gets this rejected

1. **The reviewer cannot sign in** and cannot tell whether the extension works.
2. **Single purpose** read as two products: archiving and webhook forwarding. Keep the statement about the archive, with forwarding as part of it.
3. **Broad optional host permissions** (`https://*/*`, `http://*/*`) without the runtime-request explanation in the justification.
4. **The third-party name.** Keep the unofficial disclaimer in the description; changing the item's name means changing `manifest.json`, which needs a new version and a new upload.
5. **Screenshots showing a real fleet** — server labels, IPs, author emails.
6. **A stale privacy policy or a URL that does not load.**

## Updating a published item

1. Change the code.
2. Bump `version` in `manifest.json` — the store refuses a version that is not higher than the published one.
3. `node --test && node scripts/package.mjs`
4. Upload the new zip on the same item, update any copy that changed, submit.
5. Tag the release so the GitHub Release carries the same artifact:

   ```bash
   git tag v1.2.1 && git push origin v1.2.1
   ```

## Pre-submission checklist

- [ ] `node --test` passes.
- [ ] `node scripts/package.mjs --check` passes.
- [ ] The zip's first entry is `manifest.json`.
- [ ] `privacyPolicyUrl` loads, with the placeholders in `docs/PRIVACY.md` replaced.
- [ ] Four screenshots pass `node scripts/check-screenshots.mjs store/screenshots`.
- [ ] Every permission has a justification in `store/listing.json`.
- [ ] The description carries the unofficial disclaimer.
- [ ] `testInstructions` explains how a reviewer reaches a working state.
- [ ] Distribution and visibility match the intended audience.
