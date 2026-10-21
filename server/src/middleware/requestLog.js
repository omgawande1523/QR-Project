const crypto = require('crypto');
const defaultLogger = require('../utils/logger');

/**
 * One log line per request (production only, see app.js): method, path, status, duration and a request
 * id that is also sent back as X-Request-Id. The query string is left out because it can carry order
 * tracking tokens; bodies, headers, cookies and IP addresses are never logged. Successful health checks
 * and image downloads are skipped: they would drown out everything else.
 */
function requestLog(log = defaultLogger) {
  return (req, res, next) => {
    const started = process.hrtime.bigint();
    // Render puts its own request id in rndr-id; keep it so both logs can be matched up.
    const id = req.get('rndr-id') || req.get('x-request-id') || crypto.randomUUID();
    res.setHeader('X-Request-Id', id);
    res.on('finish', () => {
      const path = req.originalUrl.split('?')[0];
      if (res.statusCode < 400 && (path === '/health' || path.startsWith('/uploads/'))) return;
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      const ms = Math.round(Number(process.hrtime.bigint() - started) / 1e6);
      log[level]('request', { id, method: req.method, path, status: res.statusCode, ms });
    });
    next();
  };
}

module.exports = requestLog;
