# Tests — gridpane-alerts-extension

Baseline: 2026-11-06

## 20261106-full-alert-messages
- 2026-11-06T21:03:44Z | phase 3 | pass | ea76c3d | `test -z "$(grep 'line-clamp' app.css)"`
- 2026-11-06T21:03:44Z | phase 3 | pass | ea76c3d | `test "$(grep -c "className: 'msg'" app.js)" -ge 1`
- 2026-11-06T21:03:44Z | phase 3 | pass | ea76c3d | `test "$(grep -c 'td.c-message .msg' app.css)" -ge 1`
- 2026-11-06T21:03:44Z | phase 3 | pass | ea76c3d | `test "$(grep -c 'overflow-wrap: anywhere' app.css)" -ge 1`
- 2026-11-06T21:03:44Z | phase 3 | pass | ea76c3d | `test "$(grep -c 'full alert text' README.md)" -ge 1`
- 2026-11-06T21:03:44Z | phase 3 | pass | ea76c3d | `test -z "$(grep 'row to expand it (full message' README.md)"`

## 20261106-alert-gap-recovery
- 2026-11-06T22:21:40Z | phase 5 | pass | 6d625e6 | `node --test` | # duration_ms 153.400479
- 2026-11-06T22:21:40Z | phase 5 | pass | 6d625e6 | `test -z "$(grep 'hitCursor' background.js)"`
- 2026-11-06T22:21:40Z | phase 5 | pass | 6d625e6 | `test "$(grep -c 'OVERLAP_SEC' background.js)" -ge 1`
- 2026-11-06T22:21:40Z | phase 5 | pass | 6d625e6 | `test "$(grep -c 'nextCursor' background.js)" -ge 1`
- 2026-11-06T22:21:40Z | phase 5 | pass | 6d625e6 | `test "$(grep -c 'syncGap' background.js)" -ge 1`
- 2026-11-06T22:21:40Z | phase 5 | pass | 6d625e6 | `test "$(grep -c 'gapAudit' background.js)" -ge 1`
- 2026-11-06T22:21:40Z | phase 5 | pass | 6d625e6 | `test "$(grep -c 'sGapAudit' app.html)" -ge 1`
- 2026-11-06T22:21:40Z | phase 5 | pass | 6d625e6 | `test "$(grep -c 'syncGap' app.js)" -ge 1`
- 2026-11-06T22:21:40Z | phase 5 | pass | 6d625e6 | `test "$(grep -c 'Cursor' app.html)" -ge 1`
- 2026-11-06T22:21:40Z | phase 5 | pass | 6d625e6 | `test "$(grep -c '2-hour overlap' README.md)" -ge 1`
- 2026-11-06T22:21:40Z | phase 5 | pass | 6d625e6 | `test "$(grep -c 'Check for gaps' README.md)" -ge 1`
- 2026-11-06T22:23:30Z | phase 5 | pass | 3edda48 | `node --test` | # duration_ms 150.381998
- 2026-11-06T22:23:30Z | phase 5 | pass | 3edda48 | `test -z "$(grep 'hitCursor' background.js)"`
- 2026-11-06T22:23:30Z | phase 5 | pass | 3edda48 | `test "$(grep -c 'OVERLAP_SEC' background.js)" -ge 1`
- 2026-11-06T22:23:30Z | phase 5 | pass | 3edda48 | `test "$(grep -c 'nextCursor' background.js)" -ge 1`
- 2026-11-06T22:23:30Z | phase 5 | pass | 3edda48 | `test "$(grep -c 'syncGap' background.js)" -ge 1`
- 2026-11-06T22:23:30Z | phase 5 | pass | 3edda48 | `test "$(grep -c 'gapAudit' background.js)" -ge 1`
- 2026-11-06T22:23:30Z | phase 5 | pass | 3edda48 | `test "$(grep -c 'sGapAudit' app.html)" -ge 1`
- 2026-11-06T22:23:30Z | phase 5 | pass | 3edda48 | `test "$(grep -c 'syncGap' app.js)" -ge 1`
- 2026-11-06T22:23:30Z | phase 5 | pass | 3edda48 | `test "$(grep -c 'Cursor' app.html)" -ge 1`
- 2026-11-06T22:23:30Z | phase 5 | pass | 3edda48 | `test "$(grep -c '2-hour overlap' README.md)" -ge 1`
- 2026-11-06T22:23:30Z | phase 5 | pass | 3edda48 | `test "$(grep -c 'Check for gaps' README.md)" -ge 1`

## 20261107-package-and-publish
- 2026-11-07T14:20:39Z | phase 5 | pass | 3c17533 | `node --test` | # duration_ms 215.92471
- 2026-11-07T14:20:39Z | phase 5 | pass | 3c17533 | `node scripts/package.mjs --check` | Store listing: 7 justification(s) match the manifest
- 2026-11-07T14:20:39Z | phase 5 | pass | 3c17533 | `node scripts/package.mjs` | Unpacked: /home/openchamber/git/gridpane-alerts-extension/dist/unpacked
- 2026-11-07T14:20:39Z | phase 5 | pass | 3c17533 | `python3 -c "import zipfile,glob,sys; n=zipfile.ZipFile(sorted(glob.glob('dist/*.zip'))[0]).namelist(); sys.exit(0 if n[0]=='manifest.json' else 1)"`
- 2026-11-07T14:20:39Z | phase 5 | pass | 3c17533 | `python3 -c "import zipfile,glob,sys; n=zipfile.ZipFile(sorted(glob.glob('dist/*.zip'))[0]).namelist(); bad=[x for x in n if x.split('/')[0] in ('plans','tests','docs','scripts','store','.github')]; sys.exit(0 if not bad else 1)"`
- 2026-11-07T14:20:40Z | phase 5 | pass | 3c17533 | `a=$(mktemp -d); b=$(mktemp -d); node scripts/package.mjs --out "$a" >/dev/null && node scripts/package.mjs --out "$b" >/dev/null && cmp "$a"/*.zip "$b"/*.zip`
- 2026-11-07T14:20:40Z | phase 5 | pass | 3c17533 | `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))"`
- 2026-11-07T14:20:40Z | phase 5 | pass | 3c17533 | `python3 -c "import json,sys; m=json.load(open('manifest.json')); l=json.load(open('store/listing.json')); p=set(m.get('permissions',[]))\|set(m.get('host_permissions',[]))\|set(m.get('optional_host_permissions',[])); sys.exit(0 if p==set(l['justifications']) else 1)"`
- 2026-11-07T14:20:40Z | phase 5 | pass | 3c17533 | `test "$(grep -c 'chrome://extensions' README.md)" -ge 1`
- 2026-11-07T14:20:40Z | phase 5 | pass | 3c17533 | `test "$(grep -c 'Load unpacked' README.md)" -ge 1`
- 2026-11-07T14:20:40Z | phase 5 | pass | 3c17533 | `test "$(grep -c 'gh release create' .github/workflows/release.yml)" -ge 1`

## 20261107-require-gridpane-tab
- 2026-11-11T13:10:21Z | phase 4 | pass | e4e3721 | `node --test` | # duration_ms 234.333485
- 2026-11-11T13:10:21Z | phase 4 | pass | e4e3721 | `node scripts/package.mjs --check` | Store listing: 7 justification(s) match the manifest
- 2026-11-11T13:10:21Z | phase 4 | pass | e4e3721 | `test "$(grep -c "from './lib/tabs.js'" background.js)" -ge 1`
- 2026-11-11T13:10:21Z | phase 4 | pass | e4e3721 | `test "$(grep -c 'NoTabError' background.js)" -ge 1`
- 2026-11-11T13:10:21Z | phase 4 | pass | e4e3721 | `test "$(grep -c 'no_tab' background.js)" -ge 1`
- 2026-11-11T13:10:21Z | phase 4 | pass | e4e3721 | `test "$(grep -c 'openGridPane' background.js)" -ge 1`
- 2026-11-11T13:10:21Z | phase 4 | pass | e4e3721 | `test "$(grep -c 'pickGridPaneTab' background.js)" -ge 1`
- 2026-11-11T13:10:21Z | phase 4 | pass | e4e3721 | `test "$(grep -c 'lib/tabs.js' scripts/package.mjs)" -ge 1`
- 2026-11-11T13:10:21Z | phase 4 | pass | e4e3721 | `test "$(grep -c 'no_tab' app.js)" -ge 1`
- 2026-11-11T13:10:21Z | phase 4 | pass | e4e3721 | `test "$(grep -c 'Open GridPane' app.js)" -ge 1`
- 2026-11-11T13:10:21Z | phase 4 | pass | e4e3721 | `test "$(grep -c 'my.gridpane.com tab' README.md)" -ge 1`
- 2026-11-11T13:10:21Z | phase 4 | pass | e4e3721 | `python3 -c "import json,sys; m=json.load(open('manifest.json')); sys.exit(0 if 'tabs' not in m.get('permissions',[]) else 1)"`

## 20261107-backfill-and-audit
- 2026-11-11T16:30:56Z | phase 5 | pass | 38b1769 | `node --test` | # duration_ms 198.45848
- 2026-11-11T16:30:56Z | phase 5 | pass | 38b1769 | `node scripts/package.mjs --check` | Store listing: 7 justification(s) match the manifest
- 2026-11-11T16:30:57Z | phase 5 | pass | 38b1769 | `test -z "$(grep 'shallow' background.js)"`
- 2026-11-11T16:30:57Z | phase 5 | pass | 38b1769 | `test "$(grep -c 'newestOf' lib/scan.js)" -ge 2`
- 2026-11-11T16:30:57Z | phase 5 | pass | 38b1769 | `test "$(grep -c 'backfillStart' lib/scan.js)" -ge 1`
- 2026-11-11T16:30:57Z | phase 5 | pass | 38b1769 | `test "$(grep -c 'batchDone' lib/scan.js)" -ge 1`
- 2026-11-11T16:30:57Z | phase 5 | pass | 38b1769 | `test "$(grep -c 'sortNewestFirst' lib/scan.js)" -ge 1`
- 2026-11-11T16:30:57Z | phase 5 | pass | 38b1769 | `test "$(grep -c 'AUTO_BACKFILL_PAGES' background.js)" -ge 2`
- 2026-11-11T16:30:57Z | phase 5 | pass | 38b1769 | `test "$(grep -c 'MANUAL_BACKFILL_PAGES' background.js)" -ge 2`
- 2026-11-11T16:30:57Z | phase 5 | pass | 38b1769 | `test "$(grep -c 'backfillState' background.js)" -ge 1`
- 2026-11-11T16:30:57Z | phase 5 | pass | 38b1769 | `test "$(grep -c 'MAX_WALK_PAGES' background.js)" -ge 2`
- 2026-11-11T16:30:57Z | phase 5 | pass | 38b1769 | `test "$(grep -c 'sortNewestFirst' background.js)" -ge 1`
- 2026-11-11T16:30:57Z | phase 5 | pass | 38b1769 | `test "$(grep -c "'busy'" background.js)" -ge 1`
- 2026-11-11T16:30:57Z | phase 5 | pass | 38b1769 | `test "$(grep -c 'sGapImport' app.html)" -ge 1`
- 2026-11-11T16:30:57Z | phase 5 | pass | 38b1769 | `test "$(grep -c 'backfill' app.js)" -ge 3`
- 2026-11-11T16:30:57Z | phase 5 | pass | 38b1769 | `test "$(grep -c 'Fill older history' app.html)" -ge 1`
- 2026-11-11T16:30:57Z | phase 5 | pass | 38b1769 | `test "$(grep -c 'automatic backfill' README.md)" -ge 1`

## 20261111-sync-resilience
- 2026-11-11T18:10:19Z | phase 4 | pass | 17a4846 | `node --test` | # duration_ms 207.91562
- 2026-11-11T18:10:19Z | phase 4 | pass | 17a4846 | `node scripts/package.mjs --check` | Store listing: 7 justification(s) match the manifest
- 2026-11-11T18:10:19Z | phase 4 | pass | 17a4846 | `test "$(grep -c 'function overlapSeconds' lib/scan.js)" -ge 1`
- 2026-11-11T18:10:19Z | phase 4 | pass | 17a4846 | `test "$(grep -c 'function shouldRetryOnTabLoad' lib/tabs.js)" -ge 1`
- 2026-11-11T18:10:19Z | phase 4 | pass | 17a4846 | `test "$(grep -c 'overlapSeconds' background.js)" -ge 1`
- 2026-11-11T18:10:19Z | phase 4 | pass | 17a4846 | `test "$(grep -c 'shouldRetryOnTabLoad' background.js)" -ge 1`
- 2026-11-11T18:10:19Z | phase 4 | pass | 17a4846 | `test "$(grep -c 'chrome.tabs.onUpdated' background.js)" -ge 1`
- 2026-11-11T18:10:19Z | phase 4 | pass | 17a4846 | `test "$(grep -c 'sOverlap' app.html)" -ge 1`
- 2026-11-11T18:10:19Z | phase 4 | pass | 17a4846 | `test "$(grep -c 'Catch-up overlap' app.html)" -ge 1`
- 2026-11-11T18:10:19Z | phase 4 | pass | 17a4846 | `test "$(grep -c 'retries the sync' README.md)" -ge 1`
- 2026-11-11T18:10:19Z | phase 4 | pass | 17a4846 | `node -e "import('./lib/scan.js').then(({ overlapSeconds }) => { if (overlapSeconds(undefined) !== 7200 \|\| overlapSeconds(0) !== 7200 \|\| overlapSeconds(2) !== 7200 \|\| overlapSeconds(48) !== 86400 \|\| overlapSeconds('abc') !== 7200) process.exit(1); })"`
- 2026-11-11T18:10:20Z | phase 4 | pass | 17a4846 | `node -e "import('./lib/tabs.js').then(({ shouldRetryOnTabLoad }) => { const base = { status: 'no_tab', complete: true, url: 'https://my.gridpane.com/servers', now: 60000, lastRetryAt: 0 }; if (!shouldRetryOnTabLoad(base)) process.exit(1); if (shouldRetryOnTabLoad({ ...base, status: 'ok' })) process.exit(1); if (shouldRetryOnTabLoad({ ...base, url: 'http://my.gridpane.com/' })) process.exit(1); if (shouldRetryOnTabLoad({ ...base, lastRetryAt: 45000 })) process.exit(1); })"`
- 2026-11-11T18:10:20Z | phase 4 | pass | 17a4846 | `python3 -c "import json,sys; m=json.load(open('manifest.json')); sys.exit(0 if 'tabs' not in m.get('permissions',[]) else 1)"`

## 20261111-slack-webhook-template
- 2026-11-11T18:19:08Z | phase 3 | pass | 36928bf | `node --test` | # duration_ms 201.869044
- 2026-11-11T18:19:08Z | phase 3 | pass | 36928bf | `node scripts/package.mjs --check` | Store listing: 7 justification(s) match the manifest
- 2026-11-11T18:19:08Z | phase 3 | pass | 36928bf | `test "$(grep -c 'function slackPayload' normalize.js)" -ge 1`
- 2026-11-11T18:19:08Z | phase 3 | pass | 36928bf | `test "$(grep -c "format === 'slack'" normalize.js)" -ge 1`
- 2026-11-11T18:19:08Z | phase 3 | pass | 36928bf | `test "$(grep -c 'value="slack"' app.html)" -ge 1`
- 2026-11-11T18:19:08Z | phase 3 | pass | 36928bf | `test "$(grep -c 'Slack message' README.md)" -ge 1`
- 2026-11-11T18:19:09Z | phase 3 | pass | 36928bf | `node -e "import('./normalize.js').then(({ webhookPayload }) => { const rec = { id: 'a', created_at: 0, title: 'Disk <full> & more', message: 'line1\nline2 <3 & >2', severity: 'warning', icon: '', server_id: 1, site_id: null, team_id: 1, creator_name: 'A & B', creator_email: '', read: false, action_url: '' }; const p = webhookPayload(rec, { servers: { 1: { label: 'web1', ip: '203.0.113.10' } }, sites: {} }, 'slack'); const a = p.attachments && p.attachments[0]; if (!a \|\| !Array.isArray(a.blocks) \|\| !a.blocks.length) process.exit(1); if (!p.text \|\| /[<>]/.test(p.text)) process.exit(1); if (a.color !== '#d97706') process.exit(1); if (!a.blocks.some((b) => b.type === 'header')) process.exit(1); })"`
- 2026-11-11T18:19:09Z | phase 3 | pass | 36928bf | `node -e "import('./normalize.js').then(({ webhookPayload }) => { const rec = { id: 'a', created_at: 0, title: 't', message: 'm', severity: 'info', icon: '', server_id: null, site_id: null, team_id: null, creator_name: '', creator_email: '', read: false, action_url: '' }; const c = webhookPayload(rec, {}, 'chat'); if (c.text !== c.content \|\| c.content.length > 1990) process.exit(1); const f = webhookPayload(rec, {}, 'nope'); if (f.event !== 'gridpane.notification') process.exit(1); })"`
- 2026-11-11T18:19:09Z | phase 3 | pass | 36928bf | `python3 -c "import json,sys; m=json.load(open('manifest.json')); sys.exit(0 if m['permissions']==['storage','unlimitedStorage','alarms','scripting'] and not m.get('optional_permissions') else 1)"`

## 20261111-storage-destinations
- 2026-11-11T18:25:15Z | phase 3 | pass | b8942c6 | `test -f docs/STORAGE-DESTINATIONS.md`
- 2026-11-11T18:25:15Z | phase 3 | pass | b8942c6 | `test "$(grep -c '^## ' docs/STORAGE-DESTINATIONS.md)" -ge 5`
- 2026-11-11T18:25:15Z | phase 3 | pass | b8942c6 | `test "$(grep -ci 'cloudflare' docs/STORAGE-DESTINATIONS.md)" -ge 3`
- 2026-11-11T18:25:15Z | phase 3 | pass | b8942c6 | `test "$(grep -ci 'notion' docs/STORAGE-DESTINATIONS.md)" -ge 2`
- 2026-11-11T18:25:15Z | phase 3 | pass | b8942c6 | `test "$(grep -c 'Recommendation' docs/STORAGE-DESTINATIONS.md)" -ge 1`
- 2026-11-11T18:25:15Z | phase 3 | pass | b8942c6 | `test "$(grep -c 'Decision gate' docs/STORAGE-DESTINATIONS.md)" -ge 1`
- 2026-11-11T18:25:15Z | phase 3 | pass | b8942c6 | `test "$(grep -c '^\|' docs/STORAGE-DESTINATIONS.md)" -ge 10`
- 2026-11-11T18:25:15Z | phase 3 | pass | b8942c6 | `test "$(grep -c 'https://' docs/STORAGE-DESTINATIONS.md)" -ge 8`
- 2026-11-11T18:25:16Z | phase 3 | pass | b8942c6 | `node --test` | # duration_ms 197.488525
- 2026-11-11T18:25:16Z | phase 3 | pass | b8942c6 | `node scripts/package.mjs --check` | Store listing: 7 justification(s) match the manifest
- 2026-11-11T18:25:16Z | phase 3 | pass | b8942c6 | `test -z "$(git status --short dist/)"`
- 2026-11-11T19:00:54Z | phase 3 | pass | 28eb3fe | `test -f docs/reference/storage-decisions.md`
- 2026-11-11T19:00:54Z | phase 3 | pass | 28eb3fe | `test "$(grep -c '^## ' docs/reference/storage-decisions.md)" -ge 5`
- 2026-11-11T19:00:54Z | phase 3 | pass | 28eb3fe | `test "$(grep -ci 'cloudflare' docs/reference/storage-decisions.md)" -ge 3`
- 2026-11-11T19:00:54Z | phase 3 | pass | 28eb3fe | `test "$(grep -ci 'notion' docs/reference/storage-decisions.md)" -ge 2`
- 2026-11-11T19:00:54Z | phase 3 | pass | 28eb3fe | `test "$(grep -c 'Recommendation' docs/reference/storage-decisions.md)" -ge 1`
- 2026-11-11T19:00:54Z | phase 3 | pass | 28eb3fe | `test "$(grep -c 'Decision gate' docs/reference/storage-decisions.md)" -ge 1`
- 2026-11-11T19:00:54Z | phase 3 | pass | 28eb3fe | `test "$(grep -c '^\|' docs/reference/storage-decisions.md)" -ge 10`
- 2026-11-11T19:00:54Z | phase 3 | pass | 28eb3fe | `test "$(grep -c 'https://' docs/reference/storage-decisions.md)" -ge 8`
- 2026-11-11T19:00:54Z | phase 3 | pass | 28eb3fe | `node --test` | # duration_ms 247.351264
- 2026-11-11T19:00:55Z | phase 3 | pass | 28eb3fe | `node scripts/package.mjs --check` | Store listing: 7 justification(s) match the manifest
- 2026-11-11T19:00:55Z | phase 3 | pass | 28eb3fe | `test -z "$(git status --short dist/)"`

## 20261111-docusaurus-docs-site
- 2026-11-11T19:03:34Z | phase 6 | pass | 9b2c56c | `npm --prefix website ci` | Run `npm audit` for details.
- 2026-11-11T19:04:13Z | phase 6 | pass | 9b2c56c | `npm --prefix website run build` | [INFO] Use `npm run serve` command to test your build locally.
- 2026-11-11T19:04:16Z | phase 6 | pass | 9b2c56c | `npm --prefix website run typecheck` | > tsc
- 2026-11-11T19:04:16Z | phase 6 | pass | 9b2c56c | `bash scripts/check-docs-site.sh --site website --repo-root . --docs docs --exclude PRIVACY.md` | 125 checks passed
- 2026-11-11T19:04:16Z | phase 6 | pass | 9b2c56c | `test -f website/docusaurus.config.ts`
- 2026-11-11T19:04:16Z | phase 6 | pass | 9b2c56c | `test -f website/package-lock.json`
- 2026-11-11T19:04:16Z | phase 6 | pass | 9b2c56c | `test -f website/sidebars.ts`
- 2026-11-11T19:04:16Z | phase 6 | pass | 9b2c56c | `test -f .github/workflows/docs.yml`
- 2026-11-11T19:04:16Z | phase 6 | pass | 9b2c56c | `test -f docs/reference/collection-and-storage.md`
- 2026-11-11T19:04:16Z | phase 6 | pass | 9b2c56c | `test -f docs/reference/features.md`
- 2026-11-11T19:04:16Z | phase 6 | pass | 9b2c56c | `test -f docs/reference/roadmap.md`
- 2026-11-11T19:04:16Z | phase 6 | pass | 9b2c56c | `test -f docs/history/google-sheets-destination.md`
- 2026-11-11T19:04:16Z | phase 6 | pass | 9b2c56c | `test "$(wc -l < README.md)" -le 90`
- 2026-11-11T19:04:16Z | phase 6 | pass | 9b2c56c | `test "$(grep -c '<!-- BEGIN docs-index -->' README.md)" -eq 1`
- 2026-11-11T19:04:16Z | phase 6 | pass | 9b2c56c | `test "$(grep -c '<!-- END docs-index -->' README.md)" -eq 1`
- 2026-11-11T19:04:16Z | phase 6 | pass | 9b2c56c | `test "$(grep -c 'https://' docs/reference/collection-and-storage.md)" -ge 8`
- 2026-11-11T19:04:16Z | phase 6 | pass | 9b2c56c | `test "$(grep -ci 'cloudflare' docs/reference/collection-and-storage.md)" -ge 3`
- 2026-11-11T19:04:16Z | phase 6 | pass | 9b2c56c | `test "$(grep -c 'MCP' docs/reference/collection-and-storage.md)" -ge 3`
- 2026-11-11T19:04:16Z | phase 6 | pass | 9b2c56c | `test "$(grep -ci 'google sheets' docs/reference/collection-and-storage.md)" -ge 2`
- 2026-11-11T19:04:16Z | phase 6 | pass | 9b2c56c | `test "$(grep -c 'Abandoned' docs/reference/collection-and-storage.md)" -ge 1`
- 2026-11-11T19:04:17Z | phase 6 | pass | 9b2c56c | `test -f docs/reference/storage-decisions.md`
- 2026-11-11T19:04:17Z | phase 6 | pass | 9b2c56c | `test "$(grep -c 'docs/reference/storage-decisions.md' plans/todos.md)" -ge 1`
- 2026-11-11T19:04:17Z | phase 6 | pass | 9b2c56c | `test "$(grep -c 'docs/STORAGE-DESTINATIONS.md' plans/todos.md)" -eq 0`
- 2026-11-11T19:04:17Z | phase 6 | pass | 9b2c56c | `test ! -f package.json`
- 2026-11-11T19:04:17Z | phase 6 | pass | 9b2c56c | `test -z "$(git status --short dist/)"`
- 2026-11-11T19:04:17Z | phase 6 | pass | 9b2c56c | `node --test` | # duration_ms 229.640912
- 2026-11-11T19:04:17Z | phase 6 | pass | 9b2c56c | `node scripts/package.mjs --check` | Store listing: 7 justification(s) match the manifest
- 2026-11-11T19:04:25Z | phase 6 | pass | 9b2c56c | `pgf check` | Tests: 69 pending (pgf test report)
- 2026-11-11T19:04:26Z | phase 6 | fail | 9b2c56c | `pgf secrets --quiet` | exit 1: Secrets: 2 finding(s)
- 2026-11-11T19:07:23Z | phase 6 | pass | 9b2c56c | `npm --prefix website ci` | Run `npm audit` for details.
- 2026-11-11T19:08:02Z | phase 6 | pass | 9b2c56c | `npm --prefix website run build` | [INFO] Use `npm run serve` command to test your build locally.
- 2026-11-11T19:08:05Z | phase 6 | pass | 9b2c56c | `npm --prefix website run typecheck` | > tsc
- 2026-11-11T19:08:05Z | phase 6 | pass | 9b2c56c | `bash scripts/check-docs-site.sh --site website --repo-root . --docs docs --exclude PRIVACY.md` | 125 checks passed
- 2026-11-11T19:08:05Z | phase 6 | pass | 9b2c56c | `test -f website/docusaurus.config.ts`
- 2026-11-11T19:08:05Z | phase 6 | pass | 9b2c56c | `test -f website/package-lock.json`
- 2026-11-11T19:08:05Z | phase 6 | pass | 9b2c56c | `test -f website/sidebars.ts`
- 2026-11-11T19:08:05Z | phase 6 | pass | 9b2c56c | `test -f .github/workflows/docs.yml`
- 2026-11-11T19:08:05Z | phase 6 | pass | 9b2c56c | `test -f docs/reference/collection-and-storage.md`
- 2026-11-11T19:08:05Z | phase 6 | pass | 9b2c56c | `test -f docs/reference/features.md`
- 2026-11-11T19:08:05Z | phase 6 | pass | 9b2c56c | `test -f docs/reference/roadmap.md`
- 2026-11-11T19:08:05Z | phase 6 | pass | 9b2c56c | `test -f docs/history/google-sheets-destination.md`
- 2026-11-11T19:08:05Z | phase 6 | pass | 9b2c56c | `test "$(wc -l < README.md)" -le 90`
- 2026-11-11T19:08:05Z | phase 6 | pass | 9b2c56c | `test "$(grep -c '<!-- BEGIN docs-index -->' README.md)" -eq 1`
- 2026-11-11T19:08:05Z | phase 6 | pass | 9b2c56c | `test "$(grep -c '<!-- END docs-index -->' README.md)" -eq 1`
- 2026-11-11T19:08:05Z | phase 6 | pass | 9b2c56c | `test "$(grep -c 'https://' docs/reference/collection-and-storage.md)" -ge 8`
- 2026-11-11T19:08:05Z | phase 6 | pass | 9b2c56c | `test "$(grep -ci 'cloudflare' docs/reference/collection-and-storage.md)" -ge 3`
- 2026-11-11T19:08:05Z | phase 6 | pass | 9b2c56c | `test "$(grep -c 'MCP' docs/reference/collection-and-storage.md)" -ge 3`
- 2026-11-11T19:08:05Z | phase 6 | pass | 9b2c56c | `test "$(grep -ci 'google sheets' docs/reference/collection-and-storage.md)" -ge 2`
- 2026-11-11T19:08:06Z | phase 6 | pass | 9b2c56c | `test "$(grep -c 'Abandoned' docs/reference/collection-and-storage.md)" -ge 1`
- 2026-11-11T19:08:06Z | phase 6 | pass | 9b2c56c | `test -f docs/reference/storage-decisions.md`
- 2026-11-11T19:08:06Z | phase 6 | pass | 9b2c56c | `test "$(grep -c 'docs/reference/storage-decisions.md' plans/todos.md)" -ge 1`
- 2026-11-11T19:08:06Z | phase 6 | pass | 9b2c56c | `test "$(grep -c 'docs/STORAGE-DESTINATIONS.md' plans/todos.md)" -eq 0`
- 2026-11-11T19:08:06Z | phase 6 | pass | 9b2c56c | `test ! -f package.json`
- 2026-11-11T19:08:06Z | phase 6 | pass | 9b2c56c | `test -z "$(git status --short dist/)"`
- 2026-11-11T19:08:06Z | phase 6 | pass | 9b2c56c | `node --test` | # duration_ms 220.298543
- 2026-11-11T19:08:06Z | phase 6 | pass | 9b2c56c | `node scripts/package.mjs --check` | Store listing: 7 justification(s) match the manifest
- 2026-11-11T19:08:16Z | phase 6 | pass | 9b2c56c | `pgf check` | Tests: 68 pending (pgf test report)
- 2026-11-11T19:08:17Z | phase 6 | pass | 9b2c56c | `pgf secrets --history --quiet` | Secrets: clean
- 2026-11-11T19:08:18Z | phase 6 | pass | 9b2c56c | `pgf release` | Blocked:    a release is refused while a plan is locked or a release is in progress
