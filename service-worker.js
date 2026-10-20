const CACHE = 'lkstkd-pwa-v3';
const STATIC = ['./icon-192.png','./icon-512.png','./manifest.webmanifest'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(STATIC)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('lkstkd-pwa-') && key !== CACHE).map(key => caches.delete(key))
  )));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request));
    return;
  }
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
