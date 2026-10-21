const rateLimit = require('express-rate-limit');
const config = require('../config');

const skipInTests = () => config.env === 'test';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per windowMs
  message: { message: 'Too many attempts, please try again later' },
  skip: skipInTests
});

module.exports = { authLimiter };
