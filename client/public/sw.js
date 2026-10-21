// Service worker: makes the app installable and shows an offline page instead of the browser error.
// Pages and the API always come from the network (orders and menus must be live); only the offline
// page, icons and content-hashed build files are cached.
const CACHE = 'qr-menu-v1';
const PRECACHE = ['/offline.html', '/favicon.svg', '/logo192.png'];
const MAX_ASSETS = 80;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function trim(cache) {
  const keys = (await cache.keys()).filter((request) => new URL(request.url).pathname.startsWith('/assets/'));
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ASSETS)).map((request) => cache.delete(request)));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // API, sockets, uploads and fonts on other origins

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.match('/offline.html')) || Response.error()));
    return;
  }

  // Build files have a content hash in their name, so a cached copy is always correct.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE);
        await cache.put(request, response.clone());
        trim(cache);
      }
      return response;
    })());
  }
});
