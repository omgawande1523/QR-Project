const rateLimit = require('express-rate-limit');
const config = require('../config');

const skipInTests = () => config.env === 'test';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per windowMs
  message: { message: 'Too many attempts, please try again later', code: 'RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests
});

// Unauthenticated writes from customer phones (orders, waiter calls, scan counts).
const publicWriteLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 30,
  message: { message: 'Too many requests, please slow down', code: 'RATE_LIMITED' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTests
});

module.exports = { authLimiter, publicWriteLimiter };
