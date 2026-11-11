---
title: Release
description: Bump the manifest version, tag, and let the release workflow test, validate and attach the zip.
---

## Cut a release

1. Bump `version` in `manifest.json` and commit.
2. Tag and push:

   ```bash
   git tag v1.5.0
   git push origin v1.5.0
   ```

The `release` workflow runs the tests and the validation again, refuses a tag that does not match the manifest version, and attaches `gridpane-alerts-<version>.zip` to the GitHub Release. That same zip is what the Chrome Web Store dashboard accepts, and what a manual install unpacks.

## Version sources

`manifest.json` is the only version source in the repository. The release helper takes the version from the last reachable tag; do not keep a root `package.json` for the site — it lives in `website/` so the release gate is not confused by a second version.

## Store submission

See [Chrome Web Store submission](./chrome-web-store.md) for the dashboard steps and [`store/listing.json`](https://github.com/managingwp/gridpane-alerts-extension/blob/main/store/listing.json) for the listing copy.
