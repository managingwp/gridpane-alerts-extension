// Fictional sample data for the archive.
//
// `buildDemo(now)` returns the same shapes the sync writes: normalized
// notifications (with their raw GridPane JSON), the server/site lookups, a set
// of Sync-log runs, the default settings and a seeded state. Every value is
// clearly fake: TEST-NET IPs, example.com sites and a "Demo Operator" creator.
// Timestamps are relative to `now`, so a capture session always looks current.
//
// This module is pure on purpose: no chrome, indexedDB, document or window, so
// Node can import it directly in tests.

import { normalize } from './normalize.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const TEAM_ID = 1;
const OVERLAP_SECONDS = 2 * 3600;

const CREATORS = [
  { name: 'Demo Operator', email: 'demo@example.com' },
  { name: 'Sam Sample', email: 'sam@example.com' },
];

const SERVERS = [
  { id: 101, label: 'web1', ip: '203.0.113.10' },
  { id: 102, label: 'web2', ip: '198.51.100.22' },
  { id: 103, label: 'db1', ip: '192.0.2.15' },
];

const SITES = [
  { id: 201, url: 'example.com', server_id: 101 },
  { id: 202, url: 'shop.example.com', server_id: 101 },
  { id: 203, url: 'blog.example.com', server_id: 102 },
  { id: 204, url: 'api.example.com', server_id: 103 },
];

// Newest first. The four "Disk usage" alerts and the two "SSL certificate"
// alerts share a title, server and site, so Group similar collapses them.
const NOTIFICATIONS = [
  {
    ago: 8 * MINUTE,
    title: 'Disk usage > 85%',
    icon: 'fa-hdd',
    server_id: 101, site_id: 202, creator: 0, read: false,
    body: '<p>Disk usage on <b>web1</b> is above 85%.</p><p>Used 43.1 GB of 50 GB.</p>',
    action_text: 'Open server', action_url: 'https://my.gridpane.com/servers',
  },
  {
    ago: 22 * MINUTE,
    title: 'Backup completed',
    icon: 'fa-check',
    server_id: 101, site_id: 201, creator: 0, read: true,
    body: '<p>The nightly backup of example.com finished successfully.</p>',
    action_text: 'Open backups', action_url: 'https://my.gridpane.com/sites',
  },
  {
    ago: 45 * MINUTE,
    title: 'SSL certificate expires in 7 days',
    icon: 'fa-lock',
    server_id: 101, site_id: 202, creator: 1, read: false,
    body: '<p>The certificate for shop.example.com expires in 7 days.</p><p>GridPane will renew it automatically.</p>',
    action_text: 'Open site', action_url: 'https://my.gridpane.com/sites',
  },
  {
    ago: 70 * MINUTE,
    title: 'PHP 8.3 upgrade completed',
    icon: 'fa-code',
    server_id: 102, site_id: 203, creator: 1, read: true,
    body: '<p>PHP 8.3 is now active on blog.example.com.</p>',
    action_text: 'Open site', action_url: 'https://my.gridpane.com/sites',
  },
  {
    ago: 95 * MINUTE,
    title: 'Disk usage > 85%',
    icon: 'fa-hdd',
    server_id: 101, site_id: 202, creator: 0, read: true,
    body: '<p>Disk usage on <b>web1</b> is above 85%.</p><p>Used 44.6 GB of 50 GB.</p>',
    action_text: 'Open server', action_url: 'https://my.gridpane.com/servers',
  },
  {
    ago: 130 * MINUTE,
    title: 'Backup failed',
    icon: 'fa-exclamation-triangle',
    server_id: 103, site_id: 204, creator: 0, read: false,
    body: '<p>The backup of api.example.com failed.</p><p>Remote storage returned 503.</p>',
    action_text: 'Open backups', action_url: 'https://my.gridpane.com/sites',
  },
  {
    ago: 180 * MINUTE,
    title: 'Disk usage > 85%',
    icon: 'fa-hdd',
    server_id: 101, site_id: 202, creator: 1, read: true,
    body: '<p>Disk usage on <b>web1</b> is above 85%.</p><p>Used 45.9 GB of 50 GB.</p>',
    action_text: 'Open server', action_url: 'https://my.gridpane.com/servers',
  },
  {
    ago: 220 * MINUTE,
    title: 'Cloning/Migrate Notice',
    icon: 'fa-clone',
    server_id: 101, site_id: 201, creator: 0, read: false,
    body: '<p>Cloning/Migrate Notice</p><p>A site clone has been queued for example.com.</p><p>Source: web1</p><p>Destination: web2</p><p>You will receive another notice when it completes.</p>',
    action_text: 'Open site', action_url: 'https://my.gridpane.com/sites',
  },
  {
    ago: 260 * MINUTE,
    title: 'Server offline',
    icon: 'fa-server',
    server_id: 102, site_id: null, creator: 0, read: false,
    body: '<p>web2 stopped responding to health checks.</p>',
    action_text: 'Open server', action_url: 'https://my.gridpane.com/servers',
  },
  {
    ago: 300 * MINUTE,
    title: 'PHP memory limit is low',
    icon: 'fa-memory',
    server_id: 102, site_id: 203, creator: 1, read: true,
    body: '<p>PHP memory usage on blog.example.com is above 90% of the configured limit.</p>',
    action_text: 'Open site', action_url: 'https://my.gridpane.com/sites',
  },
  {
    ago: 360 * MINUTE,
    title: 'New site created',
    icon: 'fa-plus',
    server_id: 101, site_id: 201, creator: 0, read: true,
    body: '<p>example.com was created on web1.</p>',
    action_text: 'Open site', action_url: 'https://my.gridpane.com/sites',
  },
  {
    ago: 420 * MINUTE,
    title: 'SSL certificate expires in 7 days',
    icon: 'fa-lock',
    server_id: 101, site_id: 202, creator: 0, read: true,
    body: '<p>The certificate for shop.example.com expires in 7 days.</p>',
    action_text: 'Open site', action_url: 'https://my.gridpane.com/sites',
  },
  {
    ago: 480 * MINUTE,
    title: "Let's Encrypt certificate renewed",
    icon: 'fa-lock',
    server_id: 101, site_id: 202, creator: 1, read: true,
    body: "<p>The Let's Encrypt certificate for shop.example.com was renewed.</p>",
    action_text: 'Open site', action_url: 'https://my.gridpane.com/sites',
  },
  {
    ago: 600 * MINUTE,
    title: 'High load on web2',
    icon: 'fa-chart-line',
    server_id: 102, site_id: 203, creator: 0, read: false,
    body: '<p>Load average on web2 reached 12.4 over the last 15 minutes.</p>',
    action_text: 'Open server', action_url: 'https://my.gridpane.com/servers',
  },
  {
    ago: 720 * MINUTE,
    title: 'Site provisioning failed',
    icon: 'fa-exclamation-circle',
    server_id: 102, site_id: 203, creator: 0, read: false,
    body: '<p>Provisioning failed for blog.example.com.</p><p>Steps completed: DNS, vhost</p><p>Step failed: database creation</p><p>No changes were made to the server.</p>',
    action_text: 'Open site', action_url: 'https://my.gridpane.com/sites',
  },
  {
    ago: 960 * MINUTE,
    title: 'DNS records updated',
    icon: 'fa-globe',
    server_id: 101, site_id: 201, creator: 1, read: true,
    body: '<p>DNS records for example.com were updated to 203.0.113.10.</p>',
    action_text: 'Open site', action_url: 'https://my.gridpane.com/sites',
  },
  {
    ago: 1200 * MINUTE,
    title: 'Disk usage > 85%',
    icon: 'fa-hdd',
    server_id: 101, site_id: 202, creator: 0, read: true,
    body: '<p>Disk usage on <b>web1</b> is above 85%.</p><p>Used 47.2 GB of 50 GB.</p>',
    action_text: 'Open server', action_url: 'https://my.gridpane.com/servers',
  },
  {
    ago: 1440 * MINUTE,
    title: 'MySQL restart required',
    icon: 'fa-database',
    server_id: 103, site_id: 204, creator: 1, read: true,
    body: "<p>MySQL on db1 will restart during tonight's maintenance window.</p>",
    action_text: 'Open server', action_url: 'https://my.gridpane.com/servers',
  },
  {
    ago: 1800 * MINUTE,
    title: 'Backup retention warning',
    icon: 'fa-exclamation-triangle',
    server_id: 103, site_id: 204, creator: 0, read: false,
    body: '<p>Only 2 of 7 daily backups are available for api.example.com.</p>',
    action_text: 'Open backups', action_url: 'https://my.gridpane.com/sites',
  },
  {
    ago: 2160 * MINUTE,
    title: 'Plugin update available',
    icon: 'fa-plug',
    server_id: 102, site_id: 203, creator: 1, read: true,
    body: '<p>3 plugin updates are available for blog.example.com.</p>',
    action_text: 'Open site', action_url: 'https://my.gridpane.com/sites',
  },
  {
    ago: 2520 * MINUTE,
    title: 'Critical: database connection refused',
    icon: 'fa-exclamation-circle',
    server_id: 103, site_id: null, creator: 0, read: false,
    body: '<p>Database connections on db1 are being refused.</p><p>Error: Too many connections</p>',
    action_text: 'Open server', action_url: 'https://my.gridpane.com/servers',
  },
  {
    ago: 3000 * MINUTE,
    title: 'Redis object cache enabled',
    icon: 'fa-bolt',
    server_id: 101, site_id: 201, creator: 1, read: true,
    body: '<p>Redis object cache is now enabled for example.com.</p>',
    action_text: 'Open site', action_url: 'https://my.gridpane.com/sites',
  },
  {
    ago: 3480 * MINUTE,
    title: 'Site clone failed',
    icon: 'fa-clone',
    server_id: 102, site_id: 203, creator: 0, read: false,
    body: '<p>The clone of blog.example.com failed while copying files.</p>',
    action_text: 'Open site', action_url: 'https://my.gridpane.com/sites',
  },
  {
    ago: 3960 * MINUTE,
    title: 'PHP-FPM pool capacity reached',
    icon: 'fa-gauge-high',
    server_id: 102, site_id: null, creator: 1, read: true,
    body: '<p>The PHP-FPM pool on web2 reached its capacity limit.</p>',
    action_text: 'Open server', action_url: 'https://my.gridpane.com/servers',
  },
];

// Nine runs: seven syncs and two history imports, all successful. `ago` is
// relative to the seed moment; `newCount` and the notes are illustrative.
const RUNS = [
  { ago: 2 * MINUTE, kind: 'sync', trigger: 'auto', newCount: 1, pages: 1, requests: 1, notes: '' },
  { ago: 7 * MINUTE, kind: 'sync', trigger: 'auto', newCount: 0, pages: 1, requests: 1, notes: '' },
  { ago: 12 * MINUTE, kind: 'sync', trigger: 'manual', newCount: 0, pages: 1, requests: 1, notes: '' },
  { ago: 17 * MINUTE, kind: 'sync', trigger: 'auto', newCount: 2, pages: 1, requests: 1, notes: '' },
  { ago: 1 * HOUR, kind: 'sync', trigger: 'auto', newCount: 0, pages: 1, requests: 1, notes: '' },
  { ago: 2 * HOUR, kind: 'sync', trigger: 'auto', newCount: 3, pages: 1, requests: 1, notes: '' },
  { ago: 3 * HOUR, kind: 'history', trigger: 'manual', newCount: 12, pages: 20, requests: 20, notes: 'backfill: pages 2–21' },
  { ago: 4 * HOUR, kind: 'sync', trigger: 'auto', newCount: 1, pages: 1, requests: 1, notes: '' },
  { ago: 6 * HOUR, kind: 'history', trigger: 'auto', newCount: 8, pages: 20, requests: 20, notes: 'backfill complete (reached the oldest alert)' },
];

function dateText(unix) {
  return `${new Date(unix * 1000).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

function newestAt(notifications, ms) {
  return notifications.filter((n) => n.created_at * 1000 <= ms)
    .sort((a, b) => b.created_at - a.created_at)[0] || notifications.at(-1) || null;
}

function olderBy(notifications, rec, offset) {
  if (!rec) return null;
  const list = notifications.filter((n) => n.created_at <= rec.created_at)
    .sort((a, b) => b.created_at - a.created_at);
  return list[Math.min(offset, list.length - 1)] || rec;
}

export function buildDemo(now = Date.now()) {
  const nowSec = Math.floor(now / 1000);

  const lookups = {
    servers: Object.fromEntries(SERVERS.map((s) => [s.id, { label: s.label, ip: s.ip }])),
    sites: Object.fromEntries(SITES.map((s) => [s.id, { url: s.url, server_id: s.server_id }])),
    updated_at: now - 15 * MINUTE,
  };

  const notifications = NOTIFICATIONS.map((n, i) => {
    const created = nowSec - Math.round(n.ago / 1000);
    const raw = {
      id: `demo-${String(i + 1).padStart(3, '0')}`,
      created_at: created,
      title: n.title,
      body: n.body,
      icon: n.icon,
      server_id: n.server_id ?? null,
      site_id: n.site_id ?? null,
      team_id: TEAM_ID,
      read: !!n.read,
      action_text: n.action_text || '',
      action_url: n.action_url || '',
      date: dateText(created),
      creator: CREATORS[n.creator || 0],
    };
    return { ...normalize(raw), first_seen_at: (created + 45) * 1000 };
  });

  const synclog = RUNS.map((r) => {
    const started = now - r.ago;
    const finished = started + (r.kind === 'history' ? 24000 : 1200);
    const to = newestAt(notifications, started);
    const from = olderBy(notifications, to, 4);
    return {
      started,
      finished,
      kind: r.kind,
      trigger: r.trigger,
      status: 'ok',
      pages: r.pages,
      requests: r.requests,
      rateLimited: 0,
      newCount: r.newCount,
      webhookSent: r.kind === 'history' ? 0 : r.newCount,
      webhookFailed: 0,
      error: null,
      notes: r.notes,
      cursorFrom: from ? { id: from.id, created_at: from.created_at } : null,
      cursorTo: to ? { id: to.id, created_at: to.created_at } : null,
      floor: from ? from.created_at - OVERLAP_SECONDS : 0,
      capped: false,
      backfillFrom: r.kind === 'history' ? 2 : null,
      backfillTo: r.kind === 'history' ? 21 : null,
      backfillDone: r.kind === 'history' ? r.notes.startsWith('backfill complete') : null,
    };
  });

  const newest = notifications[0] || null;
  const state = {
    status: 'ok',
    lastError: null,
    lastSync: now - 2 * MINUTE,
    lastAttempt: now - 2 * MINUTE,
    cursor: newest ? { id: newest.id, created_at: newest.created_at } : null,
    backfill: { nextPage: 1, done: true },
    unseen: 3,
    syncGap: false,
    syncing: false,
    syncMode: null,
    syncPage: 0,
    rateLimitStreak: 0,
    backoffUntil: 0,
  };

  const settings = {
    pollMinutes: 5,
    overlapHours: 2,
    webhookEnabled: true,
    webhookUrl: 'https://hooks.example.com/services/demo',
    webhookSecret: '',
    webhookFormat: 'slack',
    webhookIncludeBackfill: false,
  };

  return { notifications, lookups, synclog, state, settings };
}
