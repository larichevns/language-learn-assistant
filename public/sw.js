// Minimal service worker for installability. Full offline (SRS caching,
// background sync) is a post-MVP upgrade — see vault/knowledge/business/post-mvp-backlog.md.
const CACHE = 'lla-shell-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Never cache API or non-GET; let them hit the network.
  if (request.method !== 'GET' || new URL(request.url).pathname.startsWith('/api/')) return;
  // Network-first for navigations, fall back to cache when offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() => caches.match(request).then((r) => r ?? caches.match('/dashboard'))),
    );
  }
});
