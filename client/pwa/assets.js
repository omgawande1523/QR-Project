// Web app manifests and the offline page, built from APP_NAME so the product name stays in src/config.js.
// The Vite plugin in vite.config.js serves these in dev and writes them into the build.
import { readFileSync } from 'node:fs';

const CREAM = '#faf6ee';
const INK = '#1e2112';
const OLIVE_700 = '#656c1c';

export function appName() {
  const config = readFileSync(new URL('../src/config.js', import.meta.url), 'utf8');
  return config.match(/export const APP_NAME = '([^']+)'/)[1];
}

const icons = [
  { src: '/logo192.png', sizes: '192x192', type: 'image/png' },
  { src: '/logo512.png', sizes: '512x512', type: 'image/png' },
  { src: '/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
];

const manifest = (fields) => JSON.stringify({ display: 'standalone', background_color: CREAM, theme_color: CREAM, icons, ...fields }, null, 2);

export function pwaFiles(name = appName()) {
  return {
    // Restaurant staff: installs the dashboard.
    'manifest.webmanifest': manifest({
      id: '/dashboard', name: `${name} for restaurants`, short_name: name, start_url: '/dashboard', scope: '/',
      description: 'Live orders, kitchen display, menu and bills for your restaurant.'
    }),
    // Guests: installs the menu; /menu/ reopens the restaurant they last visited.
    'menu.webmanifest': manifest({
      id: '/menu/', name: `${name}: restaurant menu`, short_name: 'Menu', start_url: '/menu/', scope: '/menu/',
      description: 'Browse the menu, order from your table and track your food.'
    }),
    'offline.html': `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="${CREAM}">
<title>Offline · ${name}</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<style>
  :root { color-scheme: light; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; box-sizing: border-box;
    background: ${CREAM}; color: ${INK}; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; text-align: center; }
  main { max-width: 340px; }
  img { width: 72px; height: 72px; border-radius: 18px; }
  h1 { font-size: 24px; margin: 20px 0 8px; }
  p { color: #5f634e; line-height: 1.5; margin: 0 0 24px; }
  button { min-height: 48px; padding: 0 28px; border: 0; border-radius: 999px; background: ${OLIVE_700}; color: #fff;
    font: inherit; font-weight: 700; cursor: pointer; }
  button:focus-visible { outline: 3px solid ${INK}; outline-offset: 3px; }
</style>
</head>
<body>
<main>
  <img src="/logo192.png" alt="">
  <h1>You're offline</h1>
  <p>${name} needs an internet connection to show the menu and send orders. Check your Wi-Fi or mobile data and try again.</p>
  <button type="button" onclick="location.reload()">Try again</button>
</main>
<script>window.addEventListener('online', function () { location.reload(); });</script>
</body>
</html>
`
  };
}

const TYPES = { webmanifest: 'application/manifest+json', html: 'text/html; charset=utf-8' };

export function pwaPlugin() {
  return {
    name: 'qr-menu-pwa',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = pwaFiles()[req.url.split('?')[0].slice(1)];
        if (!file) return next();
        res.setHeader('Content-Type', TYPES[req.url.split('?')[0].split('.').pop()]);
        res.end(file);
      });
    },
    generateBundle() {
      for (const [fileName, source] of Object.entries(pwaFiles())) this.emitFile({ type: 'asset', fileName, source });
    }
  };
}
