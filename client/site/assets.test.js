import { menuPrefetchScript } from './assets.js';
import { takePrefetched } from '../src/lib/prefetch';

const ID = '6ad8b2a2f0cb4a85da88cabb';

function runAt(path) {
  window.history.pushState({}, '', path);
  delete window.__qrPrefetch;
  const fetch = vi.fn(async (url) => ({ ok: true, json: async () => ({ url }) }));
  vi.stubGlobal('fetch', fetch);
  new Function(menuPrefetchScript('https://api.example.com'))();
  return fetch;
}

afterEach(() => vi.unstubAllGlobals());

describe('menu prefetch script in index.html', () => {
  test('a scanned menu link starts the restaurant and menu requests', async () => {
    const fetch = runAt(`/menu/${ID}/browse?table=2`);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      `https://api.example.com/api/users/${ID}/public`,
      `https://api.example.com/api/menu/${ID}`
    ]);
    await expect(takePrefetched(`/api/menu/${ID}`)).resolves.toEqual({ url: `https://api.example.com/api/menu/${ID}` });
    // Handed out once only.
    expect(takePrefetched(`/api/menu/${ID}`)).toBeUndefined();
  });

  test('works for the welcome screen URL too', () => {
    expect(runAt(`/menu/${ID}`)).toHaveBeenCalledTimes(2);
  });

  test('other pages fetch nothing', () => {
    for (const path of ['/', '/dashboard', '/menu/', '/menu/not-an-id/browse']) {
      expect(runAt(path)).not.toHaveBeenCalled();
      expect(window.__qrPrefetch).toBeUndefined();
    }
  });

  test('a failed prefetch rejects for the app to retry, without an unhandled rejection', async () => {
    window.history.pushState({}, '', `/menu/${ID}/browse`);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })));
    new Function(menuPrefetchScript('https://api.example.com'))();
    await expect(takePrefetched(`/api/menu/${ID}`)).rejects.toThrow('503');
  });

  test('the API address cannot close the script tag', () => {
    expect(menuPrefetchScript('https://evil.example/</script><script>alert(1)')).not.toContain('</script>');
  });
});
