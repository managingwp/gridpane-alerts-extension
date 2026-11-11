Keeps every alert from your GridPane notification bell in a searchable archive in your browser, and can forward new ones to a webhook.

Unofficial extension. Not affiliated with, endorsed by, or supported by GridPane.

GridPane's notification bell only keeps recent alerts, and the panel has no way to search or export them. This extension reads the alerts you can already see while you are signed in to my.gridpane.com and keeps a copy on your own computer, so you can find them again weeks later.

WHAT IT DOES

Keeps an archive continuously, every five minutes by default (configurable, minimum two minutes).
Searches by text, title, server, site, IP, severity, author or id, with quoted phrases and exclusions.
Filters and sorts by date, severity, alert type, server and site, and can group similar alerts.
Shows the full alert message, with the raw JSON and a copy button on each row.
Exports whatever is currently filtered as CSV or JSON.
Shows a badge with the number of new alerts since you last opened the page.
Records every check in a sync log, including what was scanned, what was stored and how long it took, and exports that log as CSV.
Reports gaps in the archive and re-imports older history, so an interrupted check does not leave a hole.
Optionally forwards each new alert to a webhook you choose — full JSON, chat text or a Slack message, with an optional HMAC signature, a retry queue, and headers you can de-duplicate on.

HOW TO USE IT

1. Install the extension and stay signed in to my.gridpane.com in the same Chrome profile.
2. Click the toolbar icon to open the archive. The first check stores the newest page of alerts and starts tracking from there.
3. Open Settings to change the check interval, configure a webhook, import older history, or check for gaps.

PRIVACY AND PERMISSIONS

Everything is stored locally, using IndexedDB and Chrome's extension storage. There is no account, no analytics, no telemetry and no server of ours: the only requests go to my.gridpane.com with your existing session and, if you configure one, to the webhook URL you chose. The extension never reads or stores your GridPane cookies or password, and it never marks an alert as read. Uninstalling removes the archive, so export anything you want to keep first.

The extension needs access to my.gridpane.com to read the alerts you already see, plus background checks and local storage. The webhook host is requested only when you save a webhook URL, for that one host.

SUPPORT

Report a problem or ask for a feature at https://github.com/managingwp/gridpane-alerts-extension/issues.
