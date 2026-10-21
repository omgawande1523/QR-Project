const mongoose = require('mongoose');
const AppError = require('../utils/AppError');
const log = require('../utils/logger');

function notFound(req, res, next) {
  next(AppError.notFound(`Route not found: ${req.method} ${req.path}`, 'ROUTE_NOT_FOUND'));
}

// Translates known error types into AppErrors; everything else is an unexpected 500.
function normalise(err) {
  if (err instanceof AppError) return err;
  if (err.type === 'entity.parse.failed') return AppError.badRequest('Request body is not valid JSON', 'INVALID_JSON');
  if (err.type === 'entity.too.large') return new AppError(413, 'Request body is too large', 'PAYLOAD_TOO_LARGE');
  if (err instanceof mongoose.Error.CastError) return AppError.badRequest(`Invalid ${err.path}`, 'INVALID_ID');
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    return AppError.badRequest(details[0]?.message || 'Invalid data', 'VALIDATION_ERROR', details);
  }
  if (err.code === 11000) return AppError.conflict('A record with these details already exists', 'DUPLICATE');
  if (err.status === 404 || err.statusCode === 404) return AppError.notFound('File not found'); // express.static
  return null;
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const known = normalise(err);
  if (!known) {
    // Log the error server-side; the client never sees internals or stack traces. The path is logged
    // without its query string, which can carry order tracking tokens.
    log.error('Unexpected error', { method: req.method, path: req.originalUrl.split('?')[0], requestId: res.getHeader('X-Request-Id'), err });
    return res.status(500).json({ message: 'Something went wrong. Please try again.', code: 'INTERNAL_ERROR' });
  }
  const body = { message: known.message, code: known.code };
  if (known.details) body.details = known.details;
  res.status(known.status).json(body);
}

module.exports = { notFound, errorHandler };
