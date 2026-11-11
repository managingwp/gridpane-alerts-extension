# 20261111-slack-webhook-template

**Version:** 6
**Status:** ✅ Implemented (2026-11-11)
**Commit:** `61d490d` — `docs: close out 20261111-slack-webhook-template`
**Type:** feature

## Original Prompt

> Can you take the todos and create a PGF?
>
> Source todo (from `plans/todos.md` before the move): #1 — "webhook option for slack template".
>
> Scaffolded with `pgf todo plan --only 1 --move --name slack-webhook-template`.

## Plan Contract

- **Mission:** Add a Slack-native webhook format, **Slack message (Block Kit)**, beside Full JSON and Chat text, so a Slack incoming webhook receives a coloured, readable card with severity, title, server/site, the full alert message and a GridPane link, while the existing formats, outbox, retry and signature behaviour stay unchanged.
- **Execution Size:** small — one payload phase, one settings/documentation phase, and verification.
- **Session Title:** Slack webhook template
- **Scope:** In scope: `slackPayload()` plus small pure helpers in `normalize.js`; the `slack` branch in `webhookPayload()`; a third option in the Settings payload-format select; loading an unknown stored format as `full`; a sample preview that already flows through `renderSample()`; `tests/normalize.test.mjs`; the README webhook section and `store/description.md`. Out of scope: a Slack app, bot token, OAuth, `chat.postMessage`, interactive buttons/actions or slash commands; a second webhook URL or destination; changing the outbox, retry, HMAC headers, `full`/`chat` shapes or the stored alert shape; per-format settings beyond the existing `webhookFormat`; new permissions or a manifest change; bumping the version.
- **Success Metrics:** Choosing **Slack message (Block Kit)** and saving stores `webhookFormat: "slack"`; **Send test** posts exactly one Block Kit payload and Slack accepts it (no `invalid_blocks`). The payload has a top-level `text` fallback, one coloured attachment, a header block of at most 150 characters, a fields section for severity and any known server/site, a message section of at most 3,000 characters, and a context block linking to `https://my.gridpane.com`. `&`, `<` and `>` are escaped in every Slack text field. A 10,000-character message and a 300-character title are truncated with an ellipsis instead of failing. An alert with no server or site omits those fields; an alert with no message omits the message section. `full` and `chat` payloads are byte-for-byte the same shape as before, an unknown stored format falls back to `full`, and the webhook host permission handling is untouched. `node --test`, `node scripts/package.mjs --check` and `pgf check` pass; `manifest.json` is unchanged.
- **Touched paths:** normalize.js, tests/normalize.test.mjs, app.html, app.js, README.md, store/description.md, plans/tests.md, plans/20261111-slack-webhook-template.md
- **Version Target:** release-assigned (git-squash-release)
- **Version Note:** No version bump in this plan; the release helper owns the version. The format is additive, so it ships in the next ordinary release.
- **Approach / Architectural Fit:** `webhookPayload(rec, lookups, format)` in `normalize.js` is already the single presentation adapter between a stored alert and every delivery path (`flushOutbox`, `testWebhook`, the Settings sample). Slack belongs there as a third branch, not as a destination: the outbox, backoff, HMAC signature, de-duplication header and one-POST-per-alert ordering stay exactly as they are. `resolve()` and `summaryText()` already produce the server label, IP, site URL and plain-text summary the Slack card needs. The new `slackPayload()` wraps that text in Slack Block Kit: a coloured attachment (`error` red, `warning` amber, `info` blue), a plain-text header, a fields section, a message section and a context link. Slack treats `&`, `<` and `>` as control characters in `mrkdwn`/`plain_text`, so every dynamic string goes through `escapeSlack()`; every block respects Slack's documented limits through `truncate()`. The existing `format === 'chat'` branch and the default full-JSON return value are left alone, and any unrecognised stored value still lands on full JSON, so an older or hand-edited setting can never break delivery. The Settings select and `renderSample()` already pass the selected format through `webhookPayload`, so the preview needs no new rendering code. No manifest change: the optional host permission is still requested for the user's webhook origin when settings are saved.
- **References:** `normalize.js` (`webhookPayload`, `summaryText`, `resolve`, `severityOf`), `app.html` (Webhook card, around lines 128–145), `app.js` (`loadSettings`, `renderSample`, `saveSettings`, the `sWhFormat` change handler), `background.js` (`DEFAULTS.webhookFormat`, `doFlush`, `testWebhook`), `README.md` (Webhook), `store/description.md`, `tests/package.test.mjs` (Node-test style, no dependencies), Slack Block Kit reference (`https://api.slack.com/block-kit`, `https://api.slack.com/reference/block-kit/blocks`) and incoming-webhook payload rules, skills `plan-generation-skill`, `lmt-skills-development-workflow` and `chrome-extensions`.

### Assumptions (marked, veto any of these before execution)

- **"Slack template" means a third payload format, not a second destination.** The existing webhook URL receives the Slack payload; there is no separate Slack URL field, Slack app, bot token or OAuth flow.
- **Incoming webhooks only.** The payload is posted to the user's Slack incoming webhook with the existing one-POST-per-alert, oldest-first outbox, HMAC header and retry/backoff behaviour. No `chat.postMessage`, no interactive actions, no slash commands.
- **The card is a coloured attachment with four block kinds:** header, fields, message section, context link. A URL button is not used, so no interaction URL or signing secret is required.
- **Slack limits are enforced locally:** header text 150 characters, section and fallback text 3,000 characters, at most 50 blocks. A message longer than 2,900 characters is truncated with `…`; the full text remains in the archive.
- **Escaping applies only to the Slack branch.** `chat` is shared with Discord and Google Chat, whose escaping rules differ, so it keeps the current plain summary text.
- **Severity stays a best guess** from `severityOf()`; the Slack warning colour/emoji follows that guess, exactly like the archive and the other payloads.
- **An unknown or old `webhookFormat` value falls back to `full`.** No migration is needed; the Settings select shows `full` when the stored value is not one of the three known formats.
- **No new permission and no manifest change.** Saving a Slack webhook URL asks for that one origin through the existing `optional_host_permissions` flow.

## Skills Used

- **Creation:** `plan-generation-skill` (PGF format, contract, testing phase), `lmt-skills-development-workflow` (explicit-path commits, push, secret-scan cadence).
- **Implementation:** `plan-generation-skill` (phase execution and close-out), `lmt-skills-development-workflow` (phase commits, pushes, secret scans), `chrome-extensions` (MV3 extension packaging, optional host permission unchanged), Slack Block Kit and incoming-webhook documentation.

## Phases

### Phase 1: Slack payload builder and tests

**Goal:** Put the Slack presentation in one pure function beside the existing formats, with local enforcement of Slack's text limits and escaping.

#### Tasks

- [x] In `normalize.js`, add `escapeSlack(value)` (`&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`), `truncate(value, max)` (returns the value, or `max - 1` characters plus `…`), `slackColor(severity)` (`error` → `#dc2626`, `warning` → `#d97706`, `info` → `#2563eb`) and `slackPayload(rec, lookups)`. Export the helpers so Node can test them directly.
- [x] Build the payload as `{ text, attachments: [{ color, blocks: [...] }] }`. The fallback `text` is the escaped and truncated `summaryText(rec, resolve(rec, lookups))`. Blocks, in order: a `header` with a severity emoji plus the escaped title (plain_text, at most 150 characters); a `fields` section with **Severity**, **Server** (label plus IP) and **Site** (URL) only when known, plus **Created** (ISO-8601 UTC); a `message` section (`mrkdwn`, at most 3,000 characters) only when the message is non-empty; a `context` block with `<https://my.gridpane.com|Open GridPane>` and the alert id. Skip the fields block when no fields remain, and never emit an empty block.
- [x] In `webhookPayload(rec, lookups, format)`, return `slackPayload(rec, lookups)` when `format === 'slack'`, keep the current `chat` branch, and leave every other value on the existing full-JSON return. Do not change the full-JSON or chat shapes.
- [x] Add `tests/normalize.test.mjs` covering: the full-JSON shape and `event`; the chat shape and its 1,990-character `content` cap; the Slack attachment shape and that it has no `event`; each severity colour and emoji; `&`, `<` and `>` escaped in the header, message and fallback; a 10,000-character message truncated to at most 3,000; a 300-character title truncated to at most 150; unknown server/site omitted but `Severity` and `Created` kept; an empty message omitting the message section; an unknown format falling back to full JSON; and one alert producing one payload, never an array.
- [x] **Validation:** `node --test` exits 0 and reports the new test file; `node scripts/package.mjs --check` exits 0; `test "$(grep -c 'function slackPayload' normalize.js)" -ge 1`; `test "$(grep -c "format === 'slack'" normalize.js)" -ge 1`.

**Commit:** `30006f1` — `feat: add a Slack Block Kit webhook payload`; `fed52f6` — `test: cover the Slack severity emoji`

### Phase 2: Settings option, preview and documentation

**Goal:** Let the user pick the Slack format from Settings, preview it from a stored alert, and document what Slack receives.

#### Tasks

- [x] In `app.html` (Webhook card, payload format select), add `<option value="slack">Slack message (Block Kit)</option>` after the chat option. Keep the full-JSON option first so it stays the default.
- [x] In `app.js` `loadSettings`, accept only `full`, `chat` or `slack` for the stored `webhookFormat`, otherwise use `full`, so the select and the sample never show an unknown value. Leave `saveSettings` and the `sWhFormat` change handler otherwise unchanged; `renderSample()` already renders the selected format.
- [x] Update `README.md` **Webhook**: add a **Slack message** bullet with a short Block Kit shape (fallback `text`, coloured attachment, header/fields/message/context), state that Slack accepts the existing one-POST-per-alert flow and HMAC headers, and note the truncation/escaping behaviour. Keep the **Chat text** bullet for Discord and Google Chat.
- [x] Update `store/description.md` so the webhook sentence names the three formats: full JSON, chat text or a Slack message.
- [x] **Validation:** `node --test` exits 0; `node scripts/package.mjs --check` exits 0; `test "$(grep -c 'value="slack"' app.html)" -ge 1`; `test "$(grep -c 'Slack message' README.md)" -ge 1`; `test "$(grep -c 'slack' app.js)" -ge 1`.

**Commit:** `a70af98` — `feat: offer the Slack message webhook format in Settings`

### Phase 3: Testing & Verification

**Goal:** Prove the Slack payload is accepted, the existing formats are unchanged, and the extension still packages with no new permission.

#### Tasks

- [x] Run every command in **How to Test** and confirm each exits 0.
- [x] Record the outcome of each **Manual / UI Checks** step in the closing reply.
- [x] Record the test outcomes with `pgf test run 20261111-slack-webhook-template`.
- [x] **Validation:** every command in **How to Test** produces the expected output.

> **Notes:** all 9 `How to Test` commands passed on 2026-11-11 and are recorded in `plans/tests.md`. The five **Manual / UI Checks** need a live Chrome profile and a real Slack incoming webhook; they were not run in this session and are filed as a follow-up todo, with the outcome stated in the closing reply.

#### How to Test

Prerequisites: Node 22 and `python3`; no build step and no npm dependencies. The package check reads the working tree only. The `node -e` checks exercise the pure payload builder without Chrome.

```bash
node --test
node scripts/package.mjs --check
test "$(grep -c 'function slackPayload' normalize.js)" -ge 1
test "$(grep -c "format === 'slack'" normalize.js)" -ge 1
test "$(grep -c 'value="slack"' app.html)" -ge 1
test "$(grep -c 'Slack message' README.md)" -ge 1
node -e "import('./normalize.js').then(({ webhookPayload }) => { const rec = { id: 'a', created_at: 0, title: 'Disk <full> & more', message: 'line1\nline2 <3 & >2', severity: 'warning', icon: '', server_id: 1, site_id: null, team_id: 1, creator_name: 'A & B', creator_email: '', read: false, action_url: '' }; const p = webhookPayload(rec, { servers: { 1: { label: 'web1', ip: '203.0.113.10' } }, sites: {} }, 'slack'); const a = p.attachments && p.attachments[0]; if (!a || !Array.isArray(a.blocks) || !a.blocks.length) process.exit(1); if (!p.text || /[<>]/.test(p.text)) process.exit(1); if (a.color !== '#d97706') process.exit(1); if (!a.blocks.some((b) => b.type === 'header')) process.exit(1); })"
node -e "import('./normalize.js').then(({ webhookPayload }) => { const rec = { id: 'a', created_at: 0, title: 't', message: 'm', severity: 'info', icon: '', server_id: null, site_id: null, team_id: null, creator_name: '', creator_email: '', read: false, action_url: '' }; const c = webhookPayload(rec, {}, 'chat'); if (c.text !== c.content || c.content.length > 1990) process.exit(1); const f = webhookPayload(rec, {}, 'nope'); if (f.event !== 'gridpane.notification') process.exit(1); })"
python3 -c "import json,sys; m=json.load(open('manifest.json')); sys.exit(0 if m['permissions']==['storage','unlimitedStorage','alarms','scripting'] and not m.get('optional_permissions') else 1)"
```

Expected: `node --test` passes all 74 tests; the package check reports 13 runtime files; every `test` line exits 0; both `node -e` checks exit 0; the manifest permissions are unchanged.

#### Manual / UI Checks

1. Load `dist/unpacked/` in Chrome with Developer mode on, open Settings, choose **Slack message (Block Kit)**, and select a stored alert. Confirm the *What gets sent* sample shows `attachments`, a `color`, and `header`/`fields`/`section`/`context` blocks, with no `event` or `notification` key.
2. Paste a real Slack incoming-webhook URL, press **Save settings** (grant the host permission), then **Send test**. Confirm the message appears in Slack with the severity colour, title, server/site fields, alert text and an **Open GridPane** link, and that Slack reports no `invalid_blocks` error.
3. Switch back to **Full JSON** and **Chat text**, save and send a test for each. Confirm the existing payloads still arrive and differ as documented.
4. Post an alert with a very long body and a title longer than 150 characters (or a stored one), and one with no server/site. Confirm Slack accepts both: the long text ends with `…`, the title is shortened, and the unknown fields are absent rather than empty.
5. Deny the host permission when saving a new Slack webhook URL. Confirm the existing "Chrome permission … was declined" message still appears and nothing is sent.

## Summary

- **What was asked:** the todo "webhook option for slack template".
- **What was achieved:** Settings → Webhook now offers **Slack message (Block Kit)** beside **Full JSON** and **Chat text**. `normalize.js` builds one Block Kit card in a coloured attachment: a severity emoji and escaped title, severity/server/site/created fields, the alert text and an **Open GridPane** link. The top-level `text` is the escaped summary used as the notification fallback. `escapeSlack()` handles `&`, `<` and `>`; `truncate()` enforces Slack's 150-character header and 3,000-character section limits with `…`; `slackColor()` maps error/warning/info to red/amber/blue. The `full` and `chat` branches are unchanged, and an unknown stored format still falls back to full JSON. The format uses the same one-POST-per-alert outbox, headers, HMAC signature and backoff; `manifest.json` gains no permission.
- **Files changed:** `normalize.js`, `tests/normalize.test.mjs` (new), `app.html`, `app.js`, `README.md`, `store/description.md`, `plans/tests.md`, `plans/20261111-slack-webhook-template.md`.
- **How to test:** from the repository root, Node 22 and `python3`; no build step and no npm dependencies. All 9 commands in **How to Test** passed on 2026-11-11 and are recorded in `plans/tests.md`; `node --test` reports 74 passing tests and the package check reports 13 runtime files.
- **Manual checks:** not run — all five need a live Chrome profile and a real Slack incoming webhook. They are filed as a follow-up todo: the sample shows the card, Slack accepts the test without `invalid_blocks`, full/chat still deliver, long text/title truncate and unknown fields disappear, and a denied host permission still blocks the save.
- **Skills used:** creation — `plan-generation-skill`, `lmt-skills-development-workflow`; implementation — `plan-generation-skill`, `lmt-skills-development-workflow`, `chrome-extensions`.
- **Skill feedback:** None.
- **Known issues / suggestions:**
  - The five **Manual / UI Checks** have not been run — load `dist/unpacked/` in Chrome and point it at a Slack incoming webhook.
  - The context block links to `https://my.gridpane.com` rather than a per-alert deep link, because the stored `action_url` is not guaranteed to be absolute; a future version could use it when it parses.
  - Slack's `chat` format is unchanged on purpose: Discord and Google Chat have different escaping rules.
- **Commits:** `30006f1` feat: add a Slack Block Kit webhook payload; `fed52f6` test: cover the Slack severity emoji; `14f6f6a` docs: record phase 1; `a70af98` feat: offer the Slack message webhook format in Settings; `36928bf` docs: record phase 2; `61d490d` docs: close out 20261111-slack-webhook-template.
