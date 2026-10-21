const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/qr-menu',
  jwtSecret: process.env.JWT_SECRET || 'secret',
  frontendUrl: process.env.FRONTEND_URL,
  email: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
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
