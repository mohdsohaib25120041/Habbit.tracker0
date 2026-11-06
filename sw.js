// GoalForce service worker: works offline, and always tries to fetch the newest page first.
// When you publish a new version, change CACHE (for example goalforce-v3) so old files are dropped.
const CACHE = 'goalforce-v3';
const ASSETS = ['./', 'index.html', 'admin.html', 'privacy.html', 'config.js', 'native.js', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => {})))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const u = new URL(req.url);
  if (req.method !== 'GET' || u.origin !== self.location.origin || u.pathname.includes('/rest/v1/') || u.pathname.includes('/auth/v1/')) return;
  const isNav = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  const isNetworkFirst = isNav || u.pathname.endsWith('/config.js');
  if (isNetworkFirst) {
    e.respondWith(
      fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => {
            c.put(req, copy);
            if (isNav && (u.pathname.endsWith('/') || u.pathname.endsWith('/index.html'))) {
              c.put('index.html', res.clone());
            }
          });
        }
        return res;
      }).catch(() => caches.match(req).then(r => r || (isNav ? (caches.match('index.html') || caches.match('./')) : Response.error())))
    );
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res && res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy));
    }
    return res;
  })));
});
