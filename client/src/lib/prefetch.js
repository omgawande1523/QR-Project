// Responses index.html started fetching before the app loaded (menuPrefetchScript in site/assets.js).
// Each one is handed out once; later loads, such as "Try again", go to the network.
export function takePrefetched(path) {
  const store = window.__qrPrefetch;
  const promise = store?.[path];
  if (promise) delete store[path];
  return promise;
}
