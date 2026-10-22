const path = require('path');
const { z } = require('zod');
const { parseCloudinaryUrl } = require('../services/storage/cloudinaryStorage');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const VERSION = /^\d+\.\d+\.\d+$/;

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
  STORAGE_DRIVER: z.enum(['local', 'cloudinary']).default('local'),
  UPLOAD_DIR: z.string().optional(),
  // cloudinary://<api_key>:<api_secret>@<cloud_name> (Cloudinary console > API Keys), for STORAGE_DRIVER=cloudinary
  CLOUDINARY_URL: z.string().optional(),
  CLOUDINARY_FOLDER: z.preprocess((v) => v || undefined, z.string()
    .regex(/^[a-z0-9_-]+(\/[a-z0-9_-]+)*$/i, 'may only contain letters, digits, - _ and /')
    .default('qr-menu')),
  UPLOAD_CLEANUP: z.string().optional(),
  // Firebase service-account key (the JSON itself, or a path to the .json file outside the repo) for push
  // notifications to the staff app. Empty: no push notifications.
  FIREBASE_SERVICE_ACCOUNT: z.string().optional(),
  // Staff app versions (x.y.z): below APP_MIN_VERSION the app asks to update before it can be used, below
  // APP_LATEST_VERSION it offers the update. APP_UPDATE_URL is where the update button goes.
  APP_MIN_VERSION: z.preprocess((v) => v || undefined, z.string().regex(VERSION, 'must look like 1.2.3').default('1.0.0')),
  APP_LATEST_VERSION: z.preprocess((v) => v || undefined, z.string().regex(VERSION, 'must look like 1.2.3').optional()),
  APP_UPDATE_URL: z.preprocess((v) => v || undefined, z.string().url().default('https://play.google.com/store/apps/details?id=com.qrmenu.staff')),
  // The iPhone app's update button: its App Store page (https://apps.apple.com/app/id<Apple ID>) once it is live.
  APP_UPDATE_URL_IOS: z.preprocess((v) => v || undefined, z.string().url().default('https://apps.apple.com/search?term=QR%20Menu%20Staff'))
}).superRefine((env, ctx) => {
  if (env.STORAGE_DRIVER === 'cloudinary' && !parseCloudinaryUrl(env.CLOUDINARY_URL || '')) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['CLOUDINARY_URL'],
      message: 'set it to cloudinary://<api_key>:<api_secret>@<cloud_name> when STORAGE_DRIVER=cloudinary'
    });
  }
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
    uploadDir: path.resolve(env.UPLOAD_DIR || path.join(__dirname, '..', '..', 'uploads')),
    cloudinary: env.STORAGE_DRIVER === 'cloudinary'
      ? { ...parseCloudinaryUrl(env.CLOUDINARY_URL), folder: env.CLOUDINARY_FOLDER }
      : null
  },
  // Removes images that were added but never used (see services/uploadCleanup.js); UPLOAD_CLEANUP=off disables it.
  uploadCleanup: env.UPLOAD_CLEANUP !== 'off',
  push: { serviceAccount: env.FIREBASE_SERVICE_ACCOUNT },
  app: {
    minVersion: env.APP_MIN_VERSION,
    latestVersion: env.APP_LATEST_VERSION || env.APP_MIN_VERSION,
    updateUrl: env.APP_UPDATE_URL,
    updateUrlIos: env.APP_UPDATE_URL_IOS
  }
};

const splitList = (value) => (value || '').split(',').map((s) => s.trim().replace(/\/+$/, '')).filter(Boolean);
// Development only: the website's dev servers, and http://localhost, the origin of staff app test builds that
// talk to this PC over plain http (mobile/capacitor.config.ts).
const DEV_ORIGINS = ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:3000', 'http://localhost'];
// The staff app (Capacitor) loads its screens from these origins on Android and iOS. Exact matches only:
// other ports and look-alike hosts are not allowed (nor http://localhost outside development).
const APP_ORIGINS = ['https://localhost', 'capacitor://localhost'];

config.trustProxy = env.TRUST_PROXY;
config.allowedOrigins = [...new Set([
  ...splitList(env.FRONTEND_URL),
  ...splitList(env.CORS_ORIGINS),
  ...APP_ORIGINS,
  ...(env.NODE_ENV === 'development' ? DEV_ORIGINS : [])
])];
config.appOrigins = APP_ORIGINS;

module.exports = config;
