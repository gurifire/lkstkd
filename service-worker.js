const CACHE = 'lkstkd-pwa-v5';
const STATIC = [
  './offline.html','./icon-192.png','./icon-512.png','./manifest.webmanifest',
  './assets/logo.png','./assets/login-bg-1.png','./assets/login-bg-2.png','./assets/login-bg-3.png',
  './assets/dobok-white.png','./assets/dobok-yellow.png','./assets/dobok-orange.png','./assets/dobok-purple.png','./assets/dobok-green.png',
  './assets/dobok-blue.png','./assets/dobok-brown.png','./assets/dobok-red.png','./assets/dobok-poom.png','./assets/dobok-black.png'
];
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
  // 화면(HTML)은 항상 최신본을 받고, 끊겼을 때만 안내 화면을 보여준다.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('./offline.html')));
    return;
  }
  // 이미지 등 정적 파일: 캐시 우선(빠른 표시) 후 백그라운드 갱신
  if (/\/assets\/|\.png$/.test(new URL(request.url).pathname)) {
    event.respondWith(caches.open(CACHE).then(cache => cache.match(request).then(hit => {
      const net = fetch(request).then(res => { if (res.ok) cache.put(request, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    })));
    return;
  }
  event.respondWith(fetch(request).catch(() => caches.match(request)));
});
