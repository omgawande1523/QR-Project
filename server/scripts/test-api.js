// A throwaway API for the iOS cloud check (mobile/scripts/ios-ci.sh): an in-memory MongoDB loaded with the demo
// restaurant, served on PORT (default 5000). It never connects to a real database, so it is safe on any machine.
//
//   node scripts/test-api.js        (from server/)

const path = require('path');
const { execFileSync } = require('child_process');
const { MongoMemoryServer } = require('mongodb-memory-server');

(async () => {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri('qr-menu-test-api');
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';
  process.env.JWT_SECRET = process.env.JWT_SECRET || `test-api-only-${'x'.repeat(40)}`;
  execFileSync(process.execPath, [path.join(__dirname, 'seed.js')], { stdio: 'inherit', env: process.env });
  require('../server');
})().catch((err) => {
  console.error('Test API failed to start:', err);
  process.exit(1);
});
