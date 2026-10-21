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
  EMAIL_USER: z.string().optional(),
  EMAIL_PASS: z.string().optional()
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
  }
};

config.allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://qrmenusystem.netlify.app',
  'https://qrmenusystem.netlify.app/',
  config.frontendUrl
].filter(Boolean);

module.exports = config;
