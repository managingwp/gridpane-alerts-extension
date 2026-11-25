---
title: Release
description: Bump the manifest version, tag, and let the release workflow test, validate and attach the zip.
---

## Cut a release

1. Bump `version` in `manifest.json` and commit.
2. Tag and push:

   ```bash
   git tag v1.7.0
   git push origin v1.7.0
   ```

The `release` workflow runs the tests and the validation again, refuses a tag that does not match the manifest version, and attaches `gridpane-alerts-<version>.zip` to the GitHub Release. That same zip is what the Chrome Web Store dashboard accepts, and what a manual install unpacks.

If the publish step fails with a GitHub 5xx, the release may already exist as a draft with the zip attached. Publish it with `gh release edit vX.Y.Z --draft=false` and verify the asset, instead of re-running the workflow — its create step then fails on the existing release.

## Version sources

`manifest.json` is the only version source in the repository. The release helper takes the version from the last reachable tag; do not keep a root `package.json` for the site — it lives in `website/` so the release gate is not confused by a second version.

## Store submission

See [Chrome Web Store submission](./chrome-web-store.md) for the dashboard steps and [`store/listing.json`](https://github.com/managingwp/gridpane-alerts-extension/blob/main/store/listing.json) for the listing copy.
