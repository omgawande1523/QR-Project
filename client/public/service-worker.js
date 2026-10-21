// Retired service worker. Earlier builds registered a cache-first worker that could serve a stale
// index.html. Browsers that still have it installed fetch this file on their next update check;
// it clears every cache, unregisters itself and reloads open tabs. A proper PWA worker replaces it later.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((client) => client.navigate(client.url));
  })());
});
