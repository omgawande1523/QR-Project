// Build settings for the staff app (`vite build --mode app`, packaged by Capacitor from mobile/).
import { readFileSync, existsSync } from 'node:fs';

const MOBILE = new URL('../../mobile/', import.meta.url);

// App id, name and version live in one place: mobile/app.config.json (also read by Capacitor and Gradle).
export function appConfig() {
  return JSON.parse(readFileSync(new URL('app.config.json', MOBILE), 'utf8'));
}

// Build-time constants (see src/lib/platform.js). Push is on only when Firebase is set up for Android.
export function appDefines(mode) {
  if (mode !== 'app') return { 'import.meta.env.VITE_APP': JSON.stringify('false') };
  return {
    'import.meta.env.VITE_APP': JSON.stringify('true'),
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appConfig().versionName),
    'import.meta.env.VITE_PUSH': JSON.stringify(String(existsSync(new URL('android/app/google-services.json', MOBILE))))
  };
}

// The only files from public/ the app uses (the new-order chime and the icon); the website's service worker,
// manifests, link-preview image and robots.txt stay out of the app.
const APP_PUBLIC_FILES = { 'notification.wav': 'audio/wav', 'favicon.svg': 'image/svg+xml' };
const publicFile = (name) => readFileSync(new URL(`../public/${name}`, import.meta.url));

const FORBIDDEN_MODULES = /\/src\/(features\/(customer|landing)\/|App\.jsx$|main\.jsx$)/;

export function appPlugin() {
  return {
    name: 'qr-menu-staff-app',
    // 'pre': the entry script has to be swapped before Vite reads it from the HTML.
    transformIndexHtml: { order: 'pre', handler: (html) => html
        .replace('/src/main.jsx', '/src/main.app.jsx')
        .replace(/<title>[^<]*<\/title>/, `<title>${appConfig().appName}</title>`)
        // viewport-fit=cover makes env(safe-area-inset-*) work on edge-to-edge Android
        .replace('content="width=device-width, initial-scale=1"', 'content="width=device-width, initial-scale=1, viewport-fit=cover"')
        .replace(/\s*<!--[^>]*manifest[^>]*-->\s*<link rel="manifest"[^>]*>/, '')
        .replace(/\s*<link rel="apple-touch-icon"[^>]*>/, '')
        .replace(/\s*<link rel="icon" href="\/favicon-32\.png"[^>]*>/, '')
        .replace(/\s*<!-- Title, description[^>]*-->/, '') },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = req.url.split('?')[0].slice(1);
        if (!APP_PUBLIC_FILES[name]) return next();
        res.setHeader('Content-Type', APP_PUBLIC_FILES[name]);
        res.end(publicFile(name));
      });
    },
    generateBundle(options, bundle) {
      // Guests never use the app: fail the build if a customer or landing module (or the website's App.jsx)
      // is bundled. scripts/check-bundles.mjs double-checks the finished files.
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== 'chunk') continue;
        const leaked = chunk.moduleIds.map((id) => id.split(String.fromCharCode(92)).join('/')).find((id) => FORBIDDEN_MODULES.test(id));
        if (leaked) this.error(`Customer or landing code ended up in the staff app: ${leaked}`);
      }
      for (const name of Object.keys(APP_PUBLIC_FILES)) this.emitFile({ type: 'asset', fileName: name, source: publicFile(name) });
    }
  };
}
