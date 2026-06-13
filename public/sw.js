// PWA offline service worker (hand-rolled — no Workbox/Serwist dep).
//  • static assets → cache-first (immutable)
//  • pages + RSC payloads → network-first, fall back to cache, then an offline page
//  • review-queue APIs → network-first, fall back to cache (so SRS review works offline)
//  • other /api/ GET → network only;  all writes → handled by the app's IndexedDB outbox
// See vault/knowledge/business/post-mvp-backlog.md (PWA offline).
const VERSION = 'v2';
const SHELL = `lla-shell-${VERSION}`;
const STATIC = `lla-static-${VERSION}`;
const API = `lla-api-${VERSION}`;
const PRECACHE = ['/icon.svg'];
// GET endpoints worth keeping for offline review (the due queues).
const CACHEABLE_API = ['/api/vocabulary/review', '/api/grammar/review'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll(PRECACHE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const keep = new Set([SHELL, STATIC, API]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // writes never cached — the app outbox handles them
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Immutable build assets + the icon → cache-first.
  if (url.pathname.startsWith('/_next/static/') || url.pathname === '/icon.svg' || url.pathname === '/manifest.webmanifest') {
    event.respondWith(cacheFirst(request, STATIC));
    return;
  }
  // Review queues → network-first so they're fresh online but available offline.
  if (CACHEABLE_API.includes(url.pathname)) {
    event.respondWith(networkFirst(request, API, false));
    return;
  }
  // Other API GETs: network only (don't cache mutable user data).
  if (url.pathname.startsWith('/api/')) return;
  // Pages (navigations) + RSC payloads + misc same-origin GET → network-first.
  event.respondWith(networkFirst(request, SHELL, request.mode === 'navigate'));
});

function cacheFirst(request, cacheName) {
  return caches.match(request).then(
    (hit) =>
      hit ||
      fetch(request).then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(cacheName).then((c) => c.put(request, copy));
        }
        return res;
      }),
  );
}

function networkFirst(request, cacheName, navFallback) {
  return fetch(request)
    .then((res) => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(cacheName).then((c) => c.put(request, copy));
      }
      return res;
    })
    .catch(() =>
      caches.match(request).then((hit) => {
        if (hit) return hit;
        if (navFallback) return offlinePage();
        return new Response('', { status: 504, statusText: 'Offline' });
      }),
    );
}

function offlinePage() {
  return new Response(
    '<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<title>Офлайн — LLA</title><style>body{font-family:system-ui,sans-serif;background:#18171F;color:#EDEAF6;display:flex;min-height:100vh;margin:0;align-items:center;justify-content:center;text-align:center;padding:2rem}' +
      'h1{font-size:1.4rem;margin:0 0 .5rem}p{color:#A9A4BC;max-width:24rem;line-height:1.5}</style></head>' +
      '<body><div><h1>Вы офлайн</h1><p>Откройте этот раздел один раз при подключении — после этого он будет доступен без сети. Повторения сохранятся и синхронизируются, когда связь вернётся.</p></div></body></html>',
    { headers: { 'content-type': 'text/html; charset=utf-8' } },
  );
}
