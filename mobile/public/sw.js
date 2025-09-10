const CACHE = 'dragon-mobile-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    // Network-first for HTML to ensure updates; cache-first for others
    if (e.request.mode === 'navigate' || e.request.destination === 'document' || url.pathname === '/' || url.pathname.endsWith('/index.html')) {
      e.respondWith(
        fetch(e.request)
          .then((resp) => {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
            return resp;
          })
          .catch(() => caches.match(e.request))
      );
      return;
    }
    // Cache-first for static assets
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
    return;
  }
  // Network-first for API/WS (WS won't hit SW, but keep logic clear)
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
