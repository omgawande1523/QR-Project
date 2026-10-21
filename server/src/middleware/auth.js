const AppError = require('../utils/AppError');
const { verifySessionToken } = require('../services/auth');

const verifyToken = (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(AppError.unauthorized('Access denied. No token provided.', 'NO_TOKEN'));
  }

  verifySessionToken(token)
    .then((user) => {
      req.user = user;
      next();
    })
    .catch(() => next(AppError.unauthorized('Your session has expired. Please log in again.', 'INVALID_TOKEN')));
};

module.exports = { verifyToken };
