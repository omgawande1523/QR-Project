const rateLimit = require('express-rate-limit');
const config = require('../config');

// Limits are per client IP. Behind a reverse proxy set TRUST_PROXY, or every customer shares one IP.
// Customers at one restaurant may share its Wi-Fi IP, so the public limits leave room for a busy venue.
function limiter(windowMinutes, max, message, keyGenerator) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max,
    ...(keyGenerator ? { keyGenerator } : {}),
    message: { message, code: 'RATE_LIMITED' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => config.env === 'test'
  });
}

const authLimiter = limiter(15, 20, 'Too many attempts, please try again later');
const orderLimiter = limiter(5, 60, 'Too many orders from this network, please wait a moment');
const serviceRequestLimiter = limiter(5, 30, 'Too many requests, please wait a moment');
const scanLimiter = limiter(5, 120, 'Too many requests, please slow down');
const contactLimiter = limiter(15, 5, 'Too many messages, please try again later');
const feedbackLimiter = limiter(15, 20, 'Too many ratings from this network, please try again later');
// Image uploads and crops are counted per logged-in owner (these routes run after verifyToken).
const perOwner = (req) => `owner:${req.user.userId}`;
const imageLimiter = limiter(10, 120, 'Too many image uploads, please wait a few minutes', perOwner);
const imageUrlLimiter = limiter(10, 20, 'Too many image links, please wait a few minutes', perOwner);

module.exports = { authLimiter, orderLimiter, serviceRequestLimiter, scanLimiter, contactLimiter, feedbackLimiter, imageLimiter, imageUrlLimiter };
