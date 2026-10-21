import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { pwaPlugin } from './pwa/assets.js';

export default defineConfig({
  plugins: [react(), pwaPlugin()],
  server: {
    port: 3000, // falls back to the next free port (3001) when 3000 is taken
    open: false
  },
  preview: {
    port: 3000
  },
  build: {
    outDir: 'build'
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
    passWithNoTests: true
  }
});
