// Pure decisions about which open tab can carry a GridPane request. No chrome.*,
// db.js or normalize.js imports, so Node can test the matching rules without an
// extension runtime.

const GRIDPANE_HOST = 'my.gridpane.com';

// Only https on the exact host counts. A plain http URL, a subdomain or a
// lookalike host such as notmy.gridpane.com must never be treated as the panel,
// because scripting it would run a request against something that is not
// GridPane.
export function isGridPaneUrl(url) {
  if (typeof url !== 'string' || !url) return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return parsed.protocol === 'https:' && parsed.hostname.toLowerCase() === GRIDPANE_HOST;
}

// The first usable GridPane tab, or null when none is open. A discarded tab has
// no page in memory, so scripting it fails; skip it and let the caller ask for a
// real tab instead of reporting a sign-out.
export function pickGridPaneTab(tabs) {
  for (const tab of tabs || []) {
    if (!tab || tab.discarded) continue;
    if (isGridPaneUrl(tab.url)) return tab;
  }
  return null;
}
