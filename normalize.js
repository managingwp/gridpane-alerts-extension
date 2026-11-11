// Turns raw GridPane notification JSON into a flat, searchable record,
// and builds webhook payloads from stored records.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function htmlToText(html) {
  if (!html) return '';
  let s = String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr)>/gi, '\n')
    .replace(/<[^>]*>/g, '');
  s = decodeEntities(s).replace(/<br\s*\/?>/gi, '\n'); // escaped <br> inside the text
  return s.split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
}

export function severityOf(title, icon) {
  const t = (title || '').toLowerCase();
  if (/fail|error|down\b|critical|offline|unreachable|denied|expired/.test(t)) return 'error';
  if (/warn|capacity|>\s*\d+%|expir|high load|\blow\b/.test(t)) return 'warning';
  if (['fa-exclamation', 'fa-warning', 'fa-exclamation-triangle', 'fa-exclamation-circle'].includes(icon)) return 'warning';
  return 'info';
}

export function normalize(raw) {
  return {
    id: String(raw.id),
    created_at: Number(raw.created_at) || 0,
    title: raw.title || '',
    message: htmlToText(raw.body || raw.parsed_body || ''),
    severity: severityOf(raw.title, raw.icon),
    icon: raw.icon || '',
    server_id: raw.server_id ?? null,
    site_id: raw.site_id ?? null,
    team_id: raw.team_id ?? null,
    creator_name: raw.creator?.name || '',
    creator_email: raw.creator?.email || '',
    read: !!raw.read,
    action_text: raw.action_text || '',
    action_url: raw.action_url || '',
    date_text: raw.date || '',
    raw,
  };
}

// Server/site names come from a separate lookup (GridPane only sends IDs).
export function resolve(rec, lookups) {
  const sv = lookups?.servers?.[rec.server_id];
  const st = lookups?.sites?.[rec.site_id];
  return { server_label: sv?.label || null, server_ip: sv?.ip || null, site_url: st?.url || null };
}

export function summaryText(rec, r) {
  const where = [r.server_label, r.site_url].filter(Boolean).join(' / ');
  return `[${rec.severity.toUpperCase()}] ${rec.title}${where ? ` (${where})` : ''}\n${rec.message}`;
}

const SLACK_COLORS = { error: '#dc2626', warning: '#d97706', info: '#2563eb' };
const SLACK_EMOJI = { error: ':rotating_light:', warning: ':warning:', info: ':information_source:' };

// Slack reads &, < and > as control characters in every text field, so alert
// text and names must be escaped before they reach a block.
export function escapeSlack(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function truncate(value, max) {
  const s = String(value ?? '');
  return s.length <= max ? s : s.slice(0, Math.max(0, max - 1)) + '…';
}

export function slackColor(severity) {
  return SLACK_COLORS[severity] || SLACK_COLORS.info;
}

// A Block Kit card in one coloured attachment: header, fields, the alert text
// and a link back to the panel. The top-level `text` is the notification
// fallback. Slack's documented limits are enforced locally, after escaping.
export function slackPayload(rec, lookups) {
  const r = resolve(rec, lookups);
  const emoji = SLACK_EMOJI[rec.severity] || SLACK_EMOJI.info;
  const fields = [
    { type: 'mrkdwn', text: truncate(escapeSlack(`*Severity*\n${rec.severity || 'info'}`), 2000) },
  ];
  if (r.server_label) {
    const server = `${r.server_label}${r.server_ip ? ` (${r.server_ip})` : ''}`;
    fields.push({ type: 'mrkdwn', text: truncate(escapeSlack(`*Server*\n${server}`), 2000) });
  }
  if (r.site_url) fields.push({ type: 'mrkdwn', text: truncate(escapeSlack(`*Site*\n${r.site_url}`), 2000) });
  if (rec.created_at) {
    fields.push({ type: 'mrkdwn', text: truncate(escapeSlack(`*Created*\n${new Date(rec.created_at * 1000).toISOString()}`), 2000) });
  }

  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: truncate(escapeSlack(`${emoji} ${rec.title || 'GridPane alert'}`), 150), emoji: true },
    },
    { type: 'section', fields },
  ];
  if (rec.message) {
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: truncate(escapeSlack(rec.message), 3000) } });
  }
  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: `<https://my.gridpane.com|Open GridPane> · ${escapeSlack(rec.id || '')}` }],
  });

  return {
    text: truncate(escapeSlack(summaryText(rec, r)), 3000),
    attachments: [{ color: slackColor(rec.severity), blocks }],
  };
}

export function webhookPayload(rec, lookups, format = 'full') {
  const r = resolve(rec, lookups);
  const text = summaryText(rec, r);
  if (format === 'chat') return { text, content: text.slice(0, 1990) };
  if (format === 'slack') return slackPayload(rec, lookups);
  return {
    event: 'gridpane.notification',
    text,
    notification: {
      id: rec.id,
      title: rec.title,
      message: rec.message,
      severity: rec.severity,
      icon: rec.icon,
      created_at: new Date(rec.created_at * 1000).toISOString(),
      created_unix: rec.created_at,
      server: { id: rec.server_id, label: r.server_label, ip: r.server_ip },
      site: { id: rec.site_id, url: r.site_url },
      creator: { name: rec.creator_name || null, email: rec.creator_email || null },
      team_id: rec.team_id,
      read: rec.read,
      action_url: rec.action_url || null,
      gridpane_url: 'https://my.gridpane.com',
    },
    sent_at: new Date().toISOString(),
  };
}
