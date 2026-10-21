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

// Use after verifyToken. requireRole('owner', 'manager') lets only those roles through.
const requireRole = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role)) {
    return next(AppError.forbidden('Your role does not allow this', 'ROLE_FORBIDDEN'));
  }
  return next();
};

// Common groups
const OWNER = ['owner'];
const MANAGERS = ['owner', 'manager'];
const FLOOR = ['owner', 'manager', 'waiter'];
const EVERYONE = ['owner', 'manager', 'waiter', 'kitchen'];

module.exports = { verifyToken, requireRole, OWNER, MANAGERS, FLOOR, EVERYONE };
