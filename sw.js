const STATIC_CACHE = 'app-shell-v2';
const DYNAMIC_CACHE = 'dynamic-v1';

const ASSETS = [
  '/',
  '/index.html',
  '/app.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== STATIC_CACHE && k !== DYNAMIC_CACHE).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  if (url.pathname.startsWith('/content/')) {
    event.respondWith(
      fetch(event.request).then(res => {
        caches.open(DYNAMIC_CACHE).then(cache => cache.put(event.request, res.clone()));
        return res;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(res => res || fetch(event.request))
  );
});