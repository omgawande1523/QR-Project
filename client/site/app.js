// Build settings for the staff app (`vite build --mode app`, packaged by Capacitor from mobile/).
import { readFileSync, existsSync } from 'node:fs';
import process from 'node:process';

const MOBILE = new URL('../../mobile/', import.meta.url);

// App id, name and version live in one place: mobile/app.config.json (also read by Capacitor and Gradle).
export function appConfig() {
  return JSON.parse(readFileSync(new URL('app.config.json', MOBILE), 'utf8'));
}

function readEnvFile(url) {
  if (!existsSync(url)) return {};
  return Object.fromEntries(readFileSync(url, 'utf8').split(/\r?\n/)
    .map((line) => line.match(/^\s*(VITE_[A-Z0-9_]+)\s*=\s*(.*?)\s*$/))
    .filter(Boolean)
    .map(([, key, value]) => [key, value.replace(/^["']|["']$/g, '')]));
}

// The app build's VITE_* settings: client/.env.app, then client/.env.app.local, then the environment.
// The website's client/.env is deliberately not read: its localhost API address is wrong for a phone.
// Also used by mobile/scripts/app.mjs.
export function appEnv() {
  const fromEnv = Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('VITE_')));
  const env = { ...readEnvFile(new URL('../.env.app', import.meta.url)), ...readEnvFile(new URL('../.env.app.local', import.meta.url)), ...fromEnv };
  return { VITE_API_URL: 'http://10.0.2.2:5000', ...env };
}

// Build-time constants (see src/lib/platform.js). Push is on per platform once its Firebase file is in place:
// google-services.json for Android, GoogleService-Info.plist for iOS (added by the cloud build).
export function appDefines(mode) {
  if (mode !== 'app') return { 'import.meta.env.VITE_APP': JSON.stringify('false') };
  const env = appEnv();
  return {
    ...Object.fromEntries(['VITE_API_URL', 'VITE_SOCKET_URL', 'VITE_SITE_URL', 'VITE_CONTACT_EMAIL']
      .map((key) => [`import.meta.env.${key}`, JSON.stringify(env[key] || '')])),
    'import.meta.env.VITE_APP': JSON.stringify('true'),
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(appConfig().versionName),
    'import.meta.env.VITE_PUSH_ANDROID': JSON.stringify(String(existsSync(new URL('android/app/google-services.json', MOBILE)))),
    'import.meta.env.VITE_PUSH_IOS': JSON.stringify(String(existsSync(new URL('ios/App/App/GoogleService-Info.plist', MOBILE))))
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
