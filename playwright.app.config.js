// End-to-end tests of the staff app build (vite --mode app) in a browser, at phone and tablet sizes, next to
// the website (for the guest side of the order flow). Android sizes run in Chromium (Android's WebView); iPhone
// and iPad sizes in WebKit, the engine of iOS's WKWebView. Native features (camera, push, share sheet) are
// tested on the emulator and in the iOS cloud check instead; here the app build runs with its web fallbacks.
// Run: npm run seed, then npm run e2e:app. Needs ports 3000, 3001 and 5000 (and `npx playwright install webkit`).
const { devices } = require('@playwright/test');
const base = require('./playwright.config');

const iPhone = devices['iPhone 15 Pro'];
const iPad = devices['iPad Pro 11'];

module.exports = {
  ...base,
  testDir: './e2e/app',
  testIgnore: [],
  globalSetup: require.resolve('./e2e/app/global-setup.js'),
  use: { ...base.use, baseURL: 'http://localhost:3001' },
  projects: [
    { name: 'app-phone', use: { ...devices['Pixel 7'], browserName: 'chromium' } },
    { name: 'app-tablet', use: { ...devices['Galaxy Tab S4 landscape'], browserName: 'chromium' } },
    // iPhone 16 / 15 Pro (393 x 852) and 13-inch iPad Pro portrait (1024 x 1366)
    { name: 'ios-iphone', use: { browserName: 'webkit', userAgent: iPhone.userAgent, viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } },
    { name: 'ios-ipad', use: { browserName: 'webkit', userAgent: iPad.userAgent, viewport: { width: 1024, height: 1366 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true } }
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
