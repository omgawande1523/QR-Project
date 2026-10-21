// The same end-to-end tests against a production setup: the API with NODE_ENV=production (strict CORS,
// JSON request logs) and the built client served as static files, the way Vercel or Netlify would.
// Run: npm run e2e:prod  (builds the client first; needs the seeded database and free ports 3000 and 5000)
const base = require('./playwright.config');

module.exports = {
  ...base,
  webServer: [
    {
      command: 'node server.js',
      cwd: './server',
      // Everything else (MONGODB_URI, JWT_SECRET...) comes from server/.env.
      env: { NODE_ENV: 'production', FRONTEND_URL: 'http://localhost:3000', CORS_ORIGINS: '', UPLOAD_CLEANUP: 'off' },
      url: 'http://localhost:5000/health',
      reuseExistingServer: false,
      timeout: 60_000
    },
    {
      command: 'npx vite preview --port 3000 --strictPort',
      cwd: './client',
      url: 'http://localhost:3000',
      reuseExistingServer: false,
      timeout: 60_000
    }
  ]
};
