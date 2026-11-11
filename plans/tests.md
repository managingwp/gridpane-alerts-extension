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
