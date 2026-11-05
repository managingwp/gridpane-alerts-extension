// IndexedDB storage shared by the service worker and the archive page.
const DB_NAME = 'gp-alerts';
const DB_VERSION = 2;
const LOG_KEEP = 1000;
let dbPromise;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, DB_VERSION);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('notifications')) {
          const s = d.createObjectStore('notifications', { keyPath: 'id' });
          s.createIndex('created_at', 'created_at');
        }
        if (!d.objectStoreNames.contains('outbox')) d.createObjectStore('outbox', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
        if (!d.objectStoreNames.contains('synclog')) d.createObjectStore('synclog', { keyPath: 'id', autoIncrement: true });
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  return dbPromise;
}

const wrap = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
const done = (t) => new Promise((res, rej) => { t.oncomplete = () => res(); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });

export async function getAll(store) {
  const d = await open();
  return wrap(d.transaction(store).objectStore(store).getAll());
}

export async function get(store, key) {
  const d = await open();
  return wrap(d.transaction(store).objectStore(store).get(key));
}

export async function count(store) {
  const d = await open();
  return wrap(d.transaction(store).objectStore(store).count());
}

export async function put(store, value, key) {
  const d = await open();
  const t = d.transaction(store, 'readwrite');
  const s = t.objectStore(store);
  if (key === undefined) s.put(value); else s.put(value, key);
  return done(t);
}

export async function putMany(store, values) {
  if (!values.length) return;
  const d = await open();
  const t = d.transaction(store, 'readwrite');
  const s = t.objectStore(store);
  for (const v of values) s.put(v);
  return done(t);
}

export async function del(store, key) {
  const d = await open();
  const t = d.transaction(store, 'readwrite');
  t.objectStore(store).delete(key);
  return done(t);
}

export async function clear(store) {
  const d = await open();
  const t = d.transaction(store, 'readwrite');
  t.objectStore(store).clear();
  return done(t);
}

// Returns a Map of id -> stored record for the ids that already exist.
export async function getExisting(ids) {
  const d = await open();
  const s = d.transaction('notifications').objectStore('notifications');
  const found = await Promise.all(ids.map((id) => wrap(s.get(id))));
  const m = new Map();
  found.forEach((rec, i) => { if (rec) m.set(ids[i], rec); });
  return m;
}

// Append a sync-log entry and keep only the newest LOG_KEEP entries.
export async function addLog(entry) {
  const d = await open();
  const t = d.transaction('synclog', 'readwrite');
  const s = t.objectStore('synclog');
  s.add(entry);
  const c = s.count();
  c.onsuccess = () => {
    let extra = c.result - LOG_KEEP;
    if (extra <= 0) return;
    s.openCursor().onsuccess = (e) => {
      const cur = e.target.result;
      if (cur && extra-- > 0) { cur.delete(); cur.continue(); }
    };
  };
  return done(t);
}

export const kvGet = (key) => get('kv', key);
export const kvSet = (key, value) => put('kv', value, key);
