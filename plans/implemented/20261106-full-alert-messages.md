# 20261106-full-alert-messages

**Version:** 6
**Status:** ✅ Implemented (2026-11-06)
**Commit:** `99f2f77` — `docs: close out 20261106-full-alert-messages`
**Type:** fix

## Original Prompt

> Create PGF.
>
> The attached is an example line. The message is truncated, we don't need to truncate it on the list. The message should be full.

## Plan Contract

- **Mission:** Show the complete alert message in the archive list instead of clipping it to two lines.
- **Execution Size:** small
- **Session Title:** Full alert messages
- **Scope:** The Message cell of the archive list in `app.js` / `app.css` and the README line describing the list. Out of scope: the expanded-row detail view (already shows the full message), the grouped-rows occurrence table (already shows the full message), webhook payloads and their chat truncation (Discord's 2,000-character limit), pagination, any new collapse/expand control, and any new test harness (this repo has none, and the checks below are CLI assertions).
- **Success Metrics:** No `line-clamp` rule remains for the list message cell; the cell renders the stored `message` in full with preserved line breaks; every `How to Test` command exits 0; the README says the list shows the full message.
- **Touched paths:** app.js, app.css, README.md, plans/tests.md, plans/todos.md
- **Version Target:** release-assigned (git-squash-release)
- **Approach / Architectural Fit:** The truncation is purely presentational: `.clip` in `app.css` applies `-webkit-line-clamp: 2` with `overflow: hidden`. `cell()` in `app.js` wraps the message in that class. Replace the clipped wrapper with a plain `.msg` class that keeps `white-space: pre-line` (GridPane bodies contain newlines) and adds `overflow-wrap: anywhere` so long tokens wrap instead of overflowing. The 520 px max width stays so the other columns remain readable; rows grow vertically as needed. Verification stays as CLI assertions in the plan's final phase rather than a new test script, since this repo has no test framework and the workflow convention keeps ad-hoc test files out of the codebase.
- **References:** `README.md` (Archive page section), `normalize.js` `htmlToText()` (message already arrives as plain text with newlines), the Cloning/Migrate Notice example in the request (`Clone/Migration to: … is finished! Please disable any caching and check.`).

## Skills Used

- **Creation:** `plan-generation-skill` (PGF format, contract, testing phase).
- **Implementation:** `plan-generation-skill` (phase execution and close-out), `lmt-skills-development-workflow` (explicit-path commits, push, gitleaks gates).

## Phases

### Phase 1: Render the full message in the list

**Goal:** Remove the two-line clamp so the archive list shows every line of the stored message.

#### Tasks

- [x] In `app.js` `cell()`, change the message cell wrapper from `className: 'clip'` to `className: 'msg'`; leave `highlight()` and the `c-message` cell class untouched.
- [x] In `app.css`, replace the `td.c-message .clip` rule (which sets `display: -webkit-box`, `-webkit-line-clamp: 2`, `-webkit-box-orient` and `overflow: hidden`) with `td.c-message .msg { white-space: pre-line; overflow-wrap: anywhere; }`; keep `td.c-message`'s colour and `max-width: 520px`.
- [x] Confirm the grouped-rows occurrence table (`table.occ .occ-msg`) and the expanded-row `.detail-msg` are untouched and still show full text.
- [x] **Validation:** `test -z "$(grep 'line-clamp' app.css)"` and `test "$(grep -c "className: 'msg'" app.js)" -ge 1` both exit 0.

**Commit:** `9083019` — `fix: show full alert messages in the list`

### Phase 2: Align the README with the list behaviour

**Goal:** Stop telling readers that the full message requires expanding a row.

#### Tasks

- [x] In `README.md` under **Archive page**, replace the parenthetical in the sentence about clicking a row (`(full message, raw JSON, copy button)`) with wording that states the Message column shows the full alert text and that expanding a row still gives the raw JSON and copy button.
- [x] **Validation:** `test "$(grep -c 'full alert text' README.md)" -ge 1` and `test -z "$(grep 'row to expand it (full message' README.md)"` both exit 0.

**Commit:** `f2d99d8` — `docs: describe full alert text in the list`

### Phase 3: Testing & Verification

**Goal:** Prove the list renders full messages and give the user a repeatable way to check it.

#### Tasks

- [x] Run every command in **How to Test** and confirm each exits 0.
- [x] Record the **Manual / UI Checks** outcome: full-text rendering verified in a browser harness (5 lines, no clamp, no clipping); loading the unpacked extension, Copy JSON and the Columns toggle remain a follow-up todo for the user.
- [x] **Validation:** every command in `How to Test` produces the expected output.

> **Notes:** All six `How to Test` commands passed and were recorded with `pgf test run`
> (6 passed, 0 failed). A Playwright harness loaded this repository's `app.css` against the
> same `<td class="c-message"><div class="msg">` markup and confirmed 5 rendered lines,
> `webkitLineClamp: none`, and `scrollHeight === clientHeight` (no clipping). The
> extension-level manual check needs the user's Chrome profile; it is filed as a todo.

#### How to Test

Prerequisites: a checkout of this repository with `bash`; Chrome with the unpacked extension for the manual checks. No build step and no test framework exist in this repo.

```bash
test -z "$(grep 'line-clamp' app.css)"
test "$(grep -c "className: 'msg'" app.js)" -ge 1
test "$(grep -c 'td.c-message .msg' app.css)" -ge 1
test "$(grep -c 'overflow-wrap: anywhere' app.css)" -ge 1
test "$(grep -c 'full alert text' README.md)" -ge 1
test -z "$(grep 'row to expand it (full message' README.md)"
```

Expected: every command exits 0. The first command fails on the pre-fix tree (which still has `-webkit-line-clamp: 2`), so it proves the clamp is gone rather than merely that the file parses.

#### Manual / UI Checks

1. Open `chrome://extensions`, turn on **Developer mode**, and either **Load unpacked** on this repository folder or press **Reload** on the existing "GridPane Alerts Archive" card.
2. Click the toolbar icon to open the archive. Find an alert with a multi-line body, such as a **Cloning/Migrate Notice** (`Clone/Migration to: … is finished! Please disable any caching and check.`).
3. Confirm the Message column shows the entire body, including the final `is finished! Please disable any caching and check.` line, with no clipping or ellipsis and without clicking the row.
4. Click that row. Confirm the expanded detail still shows the full message, the raw JSON, and a working **Copy JSON** button.
5. Open **Columns**, hide **Message**, then show it again. Confirm the table still renders and no stale clipped column remains.

**Commit:** `99f2f77` — `docs: close out 20261106-full-alert-messages`

## Summary

- **What was asked:** The archive list clipped every alert message to two lines; show the message in full instead.
- **What was achieved:** The Message column renders the stored message in full with GridPane's line breaks preserved. The `-webkit-line-clamp: 2` / `overflow: hidden` rule is gone; `white-space: pre-line` and `overflow-wrap: anywhere` keep long lines inside the 520 px column, and rows grow as needed. The grouped-rows occurrence table and the expanded-row detail already showed full text and are unchanged. The README now states that the list shows the full alert text.
- **Files changed:** `app.js`, `app.css`, `README.md`, `plans/20261106-full-alert-messages.md`, `plans/tests.md`, `plans/todos.md`.
- **How to test:** from the repository root:

  ```bash
  test -z "$(grep 'line-clamp' app.css)"
  test "$(grep -c "className: 'msg'" app.js)" -ge 1
  test "$(grep -c 'td.c-message .msg' app.css)" -ge 1
  test "$(grep -c 'overflow-wrap: anywhere' app.css)" -ge 1
  test "$(grep -c 'full alert text' README.md)" -ge 1
  test -z "$(grep 'row to expand it (full message' README.md)"
  ```

  Expected: every command exits 0. For the browser check, reload the unpacked extension and confirm a multi-line alert (such as the Cloning/Migrate Notice) shows its full body in the Message column.
- **Manual checks:** Full-text rendering was verified in a Playwright harness against the real `app.css` and the same message-cell markup: 5 lines, `webkitLineClamp: none`, and `scrollHeight === clientHeight`. Loading the unpacked extension in the user's Chrome profile, Copy JSON and the Columns toggle were not run here and are filed as a Testing todo.
- **Skills used:** creation — `plan-generation-skill`, `lmt-skills-development-workflow`; implementation — `plan-generation-skill`, `lmt-skills-development-workflow`.
- **Commits:** `9083019` fix: show full alert messages in the list; `f2d99d8` docs: describe full alert text in the list; `6512c0a` and `ea76c3d` record phases 1 and 2; close-out recorded in the follow-up commit.
