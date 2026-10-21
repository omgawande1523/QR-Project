// End-to-end tests of the staff app build (vite --mode app) in a browser, at phone and tablet sizes, next to
// the website (for the guest side of the order flow). Native features (camera, push, share sheet) are tested
// on the emulator instead; here the app build runs with its web fallbacks.
// Run: npm run seed, then npm run e2e:app. Needs ports 3000, 3001 and 5000.
const { devices } = require('@playwright/test');
const base = require('./playwright.config');

module.exports = {
  ...base,
  testDir: './e2e/app',
  testIgnore: [],
  use: { ...base.use, baseURL: 'http://localhost:3001' },
  projects: [
    { name: 'app-phone', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
    { name: 'app-tablet', use: { ...devices['Galaxy Tab S4 landscape'], browserName: 'chromium' } }
  ],
  webServer: [
    // API and website (guests order from the website)
    { command: 'npm run dev', url: 'http://localhost:3000', reuseExistingServer: true, timeout: 120_000 },
    // The app build, pointed at the local API, served on 3001 (an origin the API allows in development)
    {
      command: 'npx vite build --mode app --outDir dist-app-test && npx vite preview --mode app --outDir dist-app-test --port 3001 --strictPort',
      cwd: './client',
      env: { VITE_API_URL: 'http://localhost:5000', VITE_SITE_URL: 'http://localhost:3000' },
      url: 'http://localhost:3001',
      reuseExistingServer: false,
      timeout: 180_000
    }
  ]
};
