// Pure rules for reading GridPane's notification bell. No chrome.*, db.js or
// normalize.js imports, so Node can test the request shape and the
// maintenance-page check without an extension runtime.
//
// On 2026-11-26 GridPane started answering /notifications/recent?page=1 with a
// Cloudflare 503 maintenance page, while the same URL without the page
// parameter returned page 1 normally. Page 1 is therefore requested without
// the parameter; older pages keep ?page=N.

export const NOTIFICATIONS_PATH = '/notifications/recent';

export function notificationsPath(page) {
  if (!Number.isInteger(page) || page < 1) {
    throw new RangeError(`notifications page must be a positive integer, got ${page}`);
  }
  return page === 1 ? NOTIFICATIONS_PATH : `${NOTIFICATIONS_PATH}?page=${page}`;
}

// A 503 is GridPane's maintenance page whatever its body says. A 200 can also
// be the maintenance page when Cloudflare serves it as HTML, so the phrase is
// the fallback; a JSON body is never a maintenance page.
export function isMaintenanceResponse({ status, ct, body } = {}) {
  if (status === 503) return true;
  if (String(ct || '').toLowerCase().includes('json')) return false;
  return typeof body === 'string' && /we['’]ll be back soon/i.test(body);
}
