import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sitePlugin } from './site/assets.js';
import { appPlugin, appDefines } from './site/app.js';

// Every screen is lazy-loaded (src/App.jsx), so modules shared between screens would otherwise end up as
// dozens of sub-kilobyte chunks (one per icon, Button, format helpers...) that a phone requests one by one.
// Group them: React and the router in "vendor", icons, UI components and small helpers in "ui" (about
// 20 KB gzipped). Heavy code (PDF, QR, cropping, charts, axios, socket.io) keeps its own lazy chunks.
const UI_MODULES = /\/src\/(components\/ui\/|lib\/(config|session|platform|backStack|storage|format|pricing|orderStatus|srcset|usePageTitle|useNow|feedback|hours|menuLanguage|roles|tokens)\.js|config\.js)/;

function sharedChunk(id) {
  const path = id.replace(/\\/g, '/');
  if (/\/node_modules\/(react|react-dom|react-router|scheduler|cookie|set-cookie-parser)\//.test(path)) return 'vendor';
  if (path.includes('/node_modules/lucide-react/') || UI_MODULES.test(path)) return 'ui';
  return undefined;
}

// `vite build --mode app` builds the staff app (Capacitor, see mobile/) into dist-app: the sign-in and staff
// screens only, from src/main.app.jsx. Every other mode is the website.
export default defineConfig(({ mode }) => ({
  plugins: [react(), mode === 'app' ? appPlugin() : sitePlugin()],
  define: appDefines(mode),
  // The app reads its own settings (site/app.js appEnv): no public/ files, no .env files from client/.
  ...(mode === 'app' ? { publicDir: false, envDir: 'site' } : {}),
  server: {
    port: 3000, // falls back to the next free port (3001) when 3000 is taken
    open: false
  },
  preview: {
    port: 3000
  },
  build: {
    outDir: mode === 'app' ? 'dist-app' : 'build',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: sharedChunk
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
    passWithNoTests: true
  }
}));
