// Generated site files: web app manifests, the offline page, robots.txt / sitemap.xml and the SEO and
// Open Graph tags in index.html. Built from APP_NAME so the product name stays in src/config.js, and from
// VITE_SITE_URL (the public address of the site) for absolute links. The Vite plugin below serves these in
// dev and writes them into the build.
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

export function siteFiles({ name = appName(), siteUrl = '' } = {}) {
  return {
    // Guests' menus stay crawlable; staff screens are not.
    'robots.txt': ['User-agent: *', 'Allow: /', 'Disallow: /dashboard', 'Disallow: /kitchen', ...(siteUrl ? ['', `Sitemap: ${siteUrl}/sitemap.xml`] : []), ''].join('\n'),
    ...(siteUrl ? {
      'sitemap.xml': [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ...['/', '/register', '/login'].map((path) => `  <url><loc>${siteUrl}${path}</loc></url>`),
        '</urlset>',
        ''
      ].join('\n')
    } : {}),
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

export const OG_IMAGE = { path: '/og-image.jpg', width: 1200, height: 630 };

// <head> tags for search engines and link previews (WhatsApp, LinkedIn, X, Slack...).
export function seoTags({ name = appName(), siteUrl = '' } = {}) {
  const title = `${name}: QR code menu and table ordering for restaurants`;
  const description = 'QR code menu and table ordering for Indian restaurants and cafés: guests scan, order and track; you get a live orders board, kitchen display and GST-ready bills.';
  const image = `${siteUrl}${OG_IMAGE.path}`;
  const meta = (attrs) => ({ tag: 'meta', attrs, injectTo: 'head' });
  return {
    title,
    tags: [
      meta({ name: 'description', content: description }),
      meta({ property: 'og:type', content: 'website' }),
      meta({ property: 'og:site_name', content: name }),
      meta({ property: 'og:title', content: title }),
      meta({ property: 'og:description', content: description }),
      meta({ property: 'og:image', content: image }),
      meta({ property: 'og:image:width', content: String(OG_IMAGE.width) }),
      meta({ property: 'og:image:height', content: String(OG_IMAGE.height) }),
      meta({ property: 'og:image:alt', content: `${name} on a phone: a restaurant menu with dishes and an Add button` }),
      meta({ property: 'og:locale', content: 'en_IN' }),
      meta({ name: 'twitter:card', content: 'summary_large_image' }),
      ...(siteUrl ? [
        meta({ property: 'og:url', content: `${siteUrl}/` }),
        { tag: 'link', attrs: { rel: 'canonical', href: `${siteUrl}/` }, injectTo: 'head' }
      ] : [])
    ]
  };
}

// A guest who scanned a table QR code is waiting for the menu, so index.html starts its two API requests
// while the app's code is still downloading. src/lib/prefetch.js hands the responses to CustomerContext.
export function menuPrefetchScript(apiUrl) {
  const api = JSON.stringify(apiUrl).replace(/</g, '\\u003c');
  return `(function () {
  var m = location.pathname.match(/^\\/menu\\/([0-9a-f]{24})(\\/|$)/);
  if (!m || !window.fetch) return;
  var store = window.__qrPrefetch = {};
  ['/api/users/' + m[1] + '/public', '/api/menu/' + m[1]].forEach(function (path) {
    store[path] = fetch(${api} + path).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
    store[path].catch(function () {});
  });
})();`;
}

// <head> tags that speed up the first screen: an early connection to the API (which also serves images)
// and the menu prefetch above.
export function performanceTags(apiUrl) {
  const origin = new URL(apiUrl).origin;
  return [
    { tag: 'link', attrs: { rel: 'preconnect', href: origin, crossorigin: '' }, injectTo: 'head' },
    { tag: 'link', attrs: { rel: 'preconnect', href: origin }, injectTo: 'head' },
    { tag: 'script', children: menuPrefetchScript(apiUrl), injectTo: 'head' }
  ];
}

const TYPES = { webmanifest: 'application/manifest+json', html: 'text/html; charset=utf-8', txt: 'text/plain; charset=utf-8', xml: 'application/xml' };

export function sitePlugin() {
  let siteUrl = '';
  let apiUrl = '';
  return {
    name: 'qr-menu-site-assets',
    configResolved(config) {
      siteUrl = (config.env.VITE_SITE_URL || '').replace(/\/+$/, '');
      // Same default as src/config.js
      apiUrl = (config.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');
    },
    transformIndexHtml(html) {
      const { title, tags } = seoTags({ siteUrl });
      return { html: html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`), tags: [...performanceTags(apiUrl), ...tags] };
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = siteFiles({ siteUrl })[req.url.split('?')[0].slice(1)];
        if (!file) return next();
        res.setHeader('Content-Type', TYPES[req.url.split('?')[0].split('.').pop()]);
        res.end(file);
      });
    },
    generateBundle() {
      for (const [fileName, source] of Object.entries(siteFiles({ siteUrl }))) this.emitFile({ type: 'asset', fileName, source });
    }
  };
}
