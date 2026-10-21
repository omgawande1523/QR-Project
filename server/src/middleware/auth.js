const jwt = require('jsonwebtoken');
const config = require('../config');
const AppError = require('../utils/AppError');

const verifyToken = (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(AppError.unauthorized('Access denied. No token provided.', 'NO_TOKEN'));
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = { userId: String(decoded.userId) };
    next();
  } catch (ex) {
    next(AppError.unauthorized('Your session has expired. Please log in again.', 'INVALID_TOKEN'));
  }
};

module.exports = { verifyToken };
