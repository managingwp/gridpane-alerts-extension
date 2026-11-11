# 20261111-storage-destinations

**Version:** 6
**Status:** ✅ Implemented (2026-11-11)
**Commit:** `860cec1` — `docs: close out 20261111-storage-destinations`
**Type:** todo

## Original Prompt

> Can you take the todos and create a PGF?
>
> Source todo (from `plans/todos.md` before the move): #2 — "investigate temporary storage somewhere on computer or remotely using a cloudflare database or worker etc, notion".
>
> Scaffolded with `pgf todo plan --only 2 --move --name storage-destinations`.

## Plan Contract

- **Mission:** Investigate where the alert archive could live outside this Chrome profile — a local file, a Cloudflare Worker with D1/R2, Notion, Google Sheets, or an existing webhook into the user's own tool — and produce a sourced decision record with a recommendation, an implementation sketch and a follow-up PGF prompt. No runtime change in this plan.
- **Execution Size:** small — one research/draft phase, one recommendation/decision phase, then verification of the document.
- **Session Title:** Alert storage destinations
- **Scope:** In scope: a new `docs/reference/storage-decisions.md` covering the current local-only model, at least six candidate destinations, a comparison table, a recommendation with a runner-up, a data-flow/auth/schema/retry/permission sketch for the recommended option, a privacy and Chrome Web Store review impact, and a ready-to-paste follow-up PGF prompt. Out of scope: implementing any destination; changing `background.js`, `db.js`, `normalize.js`, `manifest.json`, the outbox or the webhook; creating Cloudflare, Notion or Google resources; buying a plan or accepting terms; deciding the destination on the user's behalf; changing the existing JSON/CSV export.
- **Success Metrics:** `docs/reference/storage-decisions.md` states the problem and constraints (IndexedDB is per-profile, uninstall deletes it, other tools cannot read `chrome-extension://` pages, the existing outbox already handles delivery/retry) and evaluates at least six options against the same criteria: setup burden, running cost and free-tier limits, auth/secret handling, read path for Claude and scripts, retention and queryability, Chrome Web Store review impact, failure/retry/dedupe behaviour, data residency/privacy and implementation effort. Every factual claim about a product limit or price is linked to an official source with an access date. The record contains one clear **Recommendation**, one runner-up, the reasons tied to the criteria, and the conditions that would change the answer. The recommended option has a concrete sketch: extension-side change, endpoint/auth, storage schema, dedupe key, retry/batch policy, permission and manifest delta, privacy-policy text, and a phased implementation outline. A **Decision gate** section states exactly what the user must approve or veto. No runtime file changes; `node --test`, `node scripts/package.mjs --check` and `pgf check` still pass, and `dist/unpacked/` is unchanged.
- **Touched paths:** docs/reference/storage-decisions.md, plans/20261111-storage-destinations.md
- **Version Target:** release-assigned (git-squash-release)
- **Version Note:** Documentation only; no version bump and no release until a follow-up implementation plan is approved.
- **Approach / Architectural Fit:** The extension already has the right delivery machinery for any remote destination: `storeNew` writes an alert and an outbox record, `doFlush` posts oldest first with backoff, `X-GPAlerts-Id` gives receivers a de-duplication key, and an optional HMAC signs the raw body. The open question is not *how to send* but *where a durable copy should live* so the user's other tools can read it and so uninstalling Chrome does not destroy the history. The investigation therefore compares destinations on the axis the code cannot answer: setup and running cost, auth model, query surface, retention, store review and privacy. Keep the existing JSON/CSV export as the zero-setup baseline and the current generic webhook as the "bring your own endpoint" bridge; treat Cloudflare (Worker + D1 or R2), Notion and Google Sheets as candidate managed stores, and a local scheduled file as the no-cloud option. The output is deliberately a decision record, not an implementation: a destination changes the privacy policy, the store listing, the permission set and the failure model, so it needs the user's explicit choice first. The follow-up PGF prompt must be specific enough that the next session can start without repeating this research.
- **References:** `README.md` (Limits: local IndexedDB, uninstall deletes it; Webhook: full JSON, headers, outbox), `db.js` (IndexedDB stores and `DB_VERSION`), `background.js` (`storeNew`, `doFlush`, `postWebhook`, `hmac`, `DEFAULTS`, `testWebhook`), `manifest.json` (current permissions and optional host permissions), `docs/PRIVACY.md` (what leaves the browser), `docs/CHROME-WEB-STORE.md` (permission justifications and review), `store/listing.json` (`justifications`, `dataUse`, `testInstructions`), `plans/20261110-google-sheets-destination.md` (the abandoned Sheets design — reuse its constraints and record why it was abandoned), official sources to cite: Cloudflare D1 (`https://developers.cloudflare.com/d1/`), Cloudflare R2 (`https://developers.cloudflare.com/r2/`), Cloudflare Workers (`https://developers.cloudflare.com/workers/`), Cloudflare pricing (`https://developers.cloudflare.com/workers/platform/pricing/`), Notion API (`https://developers.notion.com/`), Notion request limits (`https://developers.notion.com/reference/request-limits`), Google Sheets API (`https://developers.google.com/sheets/api`), File System Access API (`https://developer.mozilla.org/en-US/docs/Web/API/File_System_API`), Chrome `downloads` API (`https://developer.chrome.com/docs/extensions/reference/api/downloads`), and skills `plan-generation-skill`, `lmt-skills-development-workflow`, `chrome-extensions` and `cloudflare`.

### Assumptions (marked, veto any of these before execution)

- **The goal is durable, machine-readable access outside this Chrome profile.** The archive should survive uninstall and be readable by Claude or scripts, not merely be backed up. If the goal is only "a second copy", the local export option wins and the remote options should be dropped.
- **This plan decides nothing.** It recommends; the user approves or vetoes at the decision gate. No account is created, no token is stored and no extension permission is added during this plan.
- **The existing JSON/CSV export and generic webhook stay.** They are the baseline against which the other options are measured, not work to be redone.
- **Cloudflare and Notion are evaluated as managed services**, including their free-tier limits and current pricing pages. The record must cite the pages it relies on and add an access date, because limits and prices change.
- **The abandoned Google Sheets plan is evidence, not a candidate to revive silently.** The record explains why it was abandoned and what a Sheets option would cost to restart (OAuth client, `identity` permission, store review, setup burden).
- **The recommendation is allowed to be "keep local + export"** if the other options fail the criteria; the plan is complete either way.
- **No runtime code and no new dependency.** The deliverable is Markdown under `docs/`, which is not part of the packaged runtime allowlist.

## Skills Used

- **Creation:** `plan-generation-skill` (PGF format, contract, testing phase), `lmt-skills-development-workflow` (explicit-path commits, push, secret-scan cadence).
- **Research:** official Cloudflare, Notion, Google and MDN/Chrome documentation; `chrome-extensions` (permission and store-review constraints); `cloudflare` (product selection and limits).
- **Implementation:** none in this plan; the follow-up PGF will name its own skills.

## Phases

### Phase 1: Research and draft the option set

**Goal:** Establish the constraints and describe each candidate destination from primary sources, before comparing them.

#### Tasks

- [x] Create `docs/reference/storage-decisions.md` with a **Problem and constraints** section: alerts live in IndexedDB in one Chrome profile (`db.js`), uninstalling deletes them, other tools cannot read `chrome-extension://` pages, the archive is read-only against GridPane, the extension already has an outbox with oldest-first delivery, backoff and `X-GPAlerts-Id`, and the optional HMAC signs the raw body. State the two jobs to be done: survive uninstall and be readable by the user's tools.
- [x] Describe at least six options, each with what it is, how data gets there, the read path for Claude/scripts, setup steps, running cost/free-tier limits, auth and secret storage, retention/queryability, Chrome Web Store review impact (permissions/OAuth), privacy/data residency, failure/retry/dedupe behaviour and implementation effort: (A) local scheduled export or a chosen folder; (B) Cloudflare Worker + D1; (C) Cloudflare Worker + R2; (D) Notion database; (E) Google Sheets (the abandoned plan); (F) the existing webhook into a user-owned tool such as NocoDB/Baserow/Airtable; (G) no change — local archive plus manual export.
- [x] Cite an official source for every product limit, price or API constraint used (Cloudflare D1/R2/Workers and pricing, Notion API and request limits, Google Sheets API, MDN File System Access, Chrome `downloads`), with an access date. Do not rely on memory for a free-tier number.
- [x] Record what the code already makes easy: the outbox/backoff, the per-alert id header, HMAC, `normalize.webhookPayload`, the optional host permission pattern, and the fact that the archive is not re-read from GridPane. Note where each option would need a new extension permission or a content-script/Worker path.
- [x] **Validation:** `test -f docs/reference/storage-decisions.md`; `test "$(grep -c '^## ' docs/reference/storage-decisions.md)" -ge 5`; `test "$(grep -ci 'cloudflare' docs/reference/storage-decisions.md)" -ge 3`; `test "$(grep -ci 'notion' docs/reference/storage-decisions.md)" -ge 2`; `test "$(grep -c 'https://' docs/reference/storage-decisions.md)" -ge 8`.

### Phase 2: Comparison, recommendation and decision gate

**Goal:** Turn the option descriptions into a decision the user can make in one read.

#### Tasks

- [x] Add a comparison table with one row per option and one column per criterion (setup, cost, auth, read path, retention/query, store review, failure model, privacy, effort), using short cells and a clear "best/worst" marker rather than a score with no basis.
- [x] Add a **Recommendation** with one primary option and one runner-up, each tied to the criteria and to the user's stated priorities (durable, readable by Claude, low setup, low cost). State the conditions that would change the answer (for example: "if you will not run a Cloudflare account, Notion wins"; "if Chrome Web Store review must not change, the Worker + existing webhook wins").
- [x] For the recommended option, add an implementation sketch: extension-side change (settings card, destination gate, batch size), endpoint and auth (HMAC or bearer, secret storage, rotation), storage schema (table/columns or object layout), dedupe key, retry/batch policy, permission and `manifest.json` delta, privacy-policy and store-listing text, and a phased outline (settings + auth, schema + ingest, query/read path, docs + review). For the runner-up, sketch only the delta.
- [x] Add a **Decision gate** section: the exact question for the user, the recommended answer, what is deferred until approval, and a ready-to-paste follow-up PGF prompt (repo, plan name, goal, decided approach, references and constraints) that does not require redoing the research.
- [x] Do not implement, scaffold code, create accounts or add permissions. Stop at the decision gate and ask for approval.
- [x] **Validation:** `test "$(grep -c 'Recommendation' docs/reference/storage-decisions.md)" -ge 1`; `test "$(grep -c 'Decision gate' docs/reference/storage-decisions.md)" -ge 1`; `test "$(grep -c '^|' docs/reference/storage-decisions.md)" -ge 10`; `test "$(grep -c 'follow-up PGF' docs/reference/storage-decisions.md)" -ge 1`.

**Commit:** `e3cb135` — `docs: add the storage destinations decision record`

### Phase 3: Testing & Verification

**Goal:** Prove the record is complete, sourced, internally consistent and that no runtime file changed.

#### Tasks

- [x] Run every command in **How to Test** and confirm each exits 0.
- [x] Record the outcome of each **Manual / UI Checks** step in the closing reply.
- [x] Record the test outcomes with `pgf test run 20261111-storage-destinations`.
- [x] **Validation:** every command in **How to Test** produces the expected output.

> **Notes:** all 11 `How to Test` commands passed on 2026-11-11 and are recorded in `plans/tests.md`. The three **Manual / UI Checks** are a human review and the destination decision; they were not run in this session and the decision is filed as a follow-up todo. The recommendation in the record is Cloudflare Worker + D1, with Notion as the runner-up.

#### How to Test

Prerequisites: Node 22; no build step and no npm dependencies. These checks assert the document's structure and that the runtime still packages unchanged.

```bash
test -f docs/reference/storage-decisions.md
test "$(grep -c '^## ' docs/reference/storage-decisions.md)" -ge 5
test "$(grep -ci 'cloudflare' docs/reference/storage-decisions.md)" -ge 3
test "$(grep -ci 'notion' docs/reference/storage-decisions.md)" -ge 2
test "$(grep -c 'Recommendation' docs/reference/storage-decisions.md)" -ge 1
test "$(grep -c 'Decision gate' docs/reference/storage-decisions.md)" -ge 1
test "$(grep -c '^|' docs/reference/storage-decisions.md)" -ge 10
test "$(grep -c 'https://' docs/reference/storage-decisions.md)" -ge 8
node --test
node scripts/package.mjs --check
test -z "$(git status --short dist/)"
```

Expected: every `test` and `grep` line exits 0; `node --test` passes all 74 tests; `node scripts/package.mjs --check` reports 13 runtime files and exits 0; `dist/` has no tracked change.

#### Manual / UI Checks

1. Read `docs/reference/storage-decisions.md` end to end and check that every free-tier or price claim has a linked official page and an access date; flag any claim you cannot verify.
2. Confirm the recommendation matches your priorities: durable across uninstall, readable by Claude/scripts, low setup, low cost, no surprising store-review work. If it does not, note which criterion should dominate.
3. At the decision gate, choose the recommended option, the runner-up, or "keep local + export". Do not start the follow-up plan until you have chosen.

## Summary

- **What was asked:** "investigate temporary storage somewhere on computer or remotely using a cloudflare database or worker etc, notion".
- **What was achieved:** `docs/reference/storage-decisions.md` is a sourced decision record. It states the two jobs (survive an uninstall, be readable by Claude/scripts), describes seven destinations — local file, Cloudflare Worker + D1, Cloudflare Worker + R2, Notion, Google Sheets, the existing webhook into a user-owned tool, and no change — and compares them on setup, cost, auth, read path, retention/query, store review, failure/dedupe, privacy and effort. Every free-tier and limit claim links to an official page with the access date 2026-11-11. The **Recommendation** is **Cloudflare Worker + D1**, with **Notion** as the runner-up, and the record explains when the answer changes. The recommended option has an implementation sketch: Settings card, outbox destination and batching, bearer/HMAC auth, `POST /v1/alerts` with `ON CONFLICT(id) DO NOTHING`, a scalar `alerts` schema with indexes, a `GET /v1/alerts` read endpoint, optional-host-permission handling, privacy/store text and an effort estimate. The **Decision gate** holds the question, the deferred work and a ready-to-paste follow-up PGF prompt.
- **Files changed:** `docs/reference/storage-decisions.md` (new), `plans/20261111-storage-destinations.md`.
- **How to test:** from the repository root, Node 22; no build step and no npm dependencies. All 11 commands in **How to Test** passed on 2026-11-11 and are recorded in `plans/tests.md`; `node --test` reports 74 passing tests and the package check reports 13 runtime files. No runtime file changed.
- **Manual checks:** not run — the record needs the user's read of the sources, a check that the recommendation matches their priorities, and the destination choice at the decision gate. Filed as a follow-up todo.
- **Recommendation:** Cloudflare Worker + D1 (durable, SQL-queryable, idempotent ingest, free for a personal archive, no OAuth review); runner-up Notion (best human/Claude UI, but about 3 requests/second, a 2,000-character rich-text cap and no native idempotency).
- **Skills used:** creation — `plan-generation-skill`, `lmt-skills-development-workflow`; research — `chrome-extensions`, `cloudflare`, official Cloudflare, Notion, Google, MDN and Chrome documentation.
- **Skill feedback:** None.
- **Known issues / suggestions:**
  - Prices and free-tier limits change; the record cites the pages and access date, so re-check them before the follow-up plan.
  - The abandoned Google Sheets plan is still in `plans/` and is still counted as open by `pgf list`; this record explains why it was abandoned, and archiving it would clean the queue.
  - The decision is genuinely open: D1 wins on query/durability, Notion wins on zero custom query code. The follow-up PGF should not start until the decision gate is answered.
- **Commits:** `e3cb135` docs: add the storage destinations decision record; `860cec1` docs: close out 20261111-storage-destinations.
