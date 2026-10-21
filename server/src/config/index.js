const path = require('path');
const { z } = require('zod');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGODB_URI: z.string().min(1).default('mongodb://localhost:27017/qr-menu'),
  JWT_SECRET: z.string({ required_error: 'JWT_SECRET is required' })
    .min(32, 'JWT_SECRET must be at least 32 characters'),
  FRONTEND_URL: z.string().optional(),
  // Extra allowed browser origins, comma separated (FRONTEND_URL is always allowed)
  CORS_ORIGINS: z.string().optional(),
  // Number of reverse proxies in front of the app (1 on Render/Railway/Heroku), so rate limits see real IPs
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional(),
  // Public base URL of this API, used to build links to uploaded images
  PUBLIC_URL: z.string().url().optional(),
  STORAGE_DRIVER: z.enum(['local']).default('local'),
  UPLOAD_DIR: z.string().optional()
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`);
    // Fail fast: never start with a missing or weak secret.
    throw new Error(`Invalid server configuration:\n${problems.join('\n')}\nSee server/.env.example.`);
  }
  return parsed.data;
}

const env = loadEnv();

const config = {
  env: env.NODE_ENV,
  port: env.PORT,
  mongoUri: env.MONGODB_URI,
  jwtSecret: env.JWT_SECRET,
  frontendUrl: env.FRONTEND_URL,
  email: {
    user: env.EMAIL_USER,
    pass: env.EMAIL_PASS
  },
  publicUrl: (env.PUBLIC_URL || `http://localhost:${env.PORT}`).replace(/\/+$/, ''),
  storage: {
    driver: env.STORAGE_DRIVER,
    uploadDir: path.resolve(env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads'))
  },
  // Removes images that were added but never used (see services/uploadCleanup.js); UPLOAD_CLEANUP=off disables it.
  uploadCleanup: env.UPLOAD_CLEANUP !== 'off'
};

const splitList = (value) => (value || '').split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
const DEV_ORIGINS = ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000'];

config.trustProxy = env.TRUST_PROXY;
config.allowedOrigins = [...new Set([
  ...splitList(env.FRONTEND_URL),
  ...splitList(env.CORS_ORIGINS),
  ...(env.NODE_ENV === 'development' ? DEV_ORIGINS : [])
])];

module.exports = config;
