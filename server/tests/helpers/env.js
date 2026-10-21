// Runs before every test file, before any app module loads. dotenv never overrides variables that are
// already set, so these win over server/.env. MONGODB_URI points at a closed port: tests connect to
// mongodb-memory-server explicitly and must never reach a real database.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-validation-0123456789';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/never-used-in-tests';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.EMAIL_USER = '';
process.env.EMAIL_PASS = '';
