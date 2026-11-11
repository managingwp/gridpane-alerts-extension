---
title: Limits
description: "The conditions the archive depends on: Chrome running, an open GridPane tab, one selected team, and the notification bell as the only source."
---

- Only runs while Chrome is open.
- Covers the GridPane team currently selected in the panel.
- Only stores what GridPane keeps in the notification bell. A transient pop-up that never becomes a bell notification (for example a progress toast) is out of reach; the gap audit can only compare what the bell still serves, up to the 50-page walk.
- Uses internal panel endpoints, not GridPane's public API, so a GridPane front-end change could break it.
- The archive lives in one Chrome profile. Uninstalling the extension deletes it, and another browser or profile cannot read it. Export first, or add a storage destination — see [Collection and storage](./collection-and-storage.md).

## Related

- [Sync, backfill and gaps](../guides/sync.md)
- [Data and privacy](./privacy.md)
