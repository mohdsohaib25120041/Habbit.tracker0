// Nexus service worker: works offline, and always tries to fetch the newest page first.
// When you publish a new version, change CACHE (for example nexus-v4) so old files are dropped.
const CACHE = 'nexus-v4';
const ASSETS = ['./', 'index.html', 'config.js', 'native.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const u = new URL(req.url);
  // never cache or touch login/database calls
  if (req.method !== 'GET' || u.origin !== self.location.origin || u.pathname.includes('/rest/v1/') || u.pathname.includes('/auth/v1/')) return;
  // pages and config.js are fetched fresh first, so edits and updates show up quickly
  const isPage = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html') || u.pathname.endsWith('/config.js');
  if (isPage) {
    // network first, so updates show up; fall back to the saved copy when offline
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)); return res; })
      .catch(() => caches.match(req).then(r => r || caches.match('index.html') || caches.match('./'))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })));
});
