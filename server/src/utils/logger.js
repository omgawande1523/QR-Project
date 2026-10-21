const util = require('util');
const config = require('../config');

// Removes secrets that can end up in a message or an error: credentials inside URLs
// (mongodb+srv://user:pass@..., cloudinary://key:secret@...), bearer tokens and JWTs.
function redact(text) {
  return String(text)
    .replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]+:[^\s/@]+@/gi, '$1***@')
    .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/g, 'Bearer ***')
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '***');
}

const serializeError = (err) => ({
  name: err.name,
  message: redact(err.message),
  ...(err.code !== undefined ? { code: err.code } : {}),
  ...(err.stack ? { stack: redact(err.stack) } : {})
});

const cleanFields = (fields) => Object.fromEntries(Object.entries(fields)
  .filter(([, v]) => v !== undefined)
  .map(([k, v]) => [k, v instanceof Error ? serializeError(v) : typeof v === 'string' ? redact(v) : v]));

/**
 * Logs one JSON line per event in production (Render and most hosts can search the fields), readable
 * text in development, and nothing in tests. Callers pass a short message and plain fields; never pass
 * request bodies, headers, passwords or tokens.
 *   log.info('Server is running', { port });   log.error('Upload cleanup failed', { err });
 */
function createLogger({ env = config.env, stdout = process.stdout, stderr = process.stderr } = {}) {
  const emit = (level, message, fields = {}) => {
    if (env === 'test') return;
    const clean = cleanFields(fields);
    const line = env === 'production'
      ? JSON.stringify({ time: new Date().toISOString(), level, msg: redact(message), ...clean })
      : [level === 'info' ? '' : `${level.toUpperCase()} `, redact(message), Object.keys(clean).length ? ` ${util.inspect(clean, { depth: 4, breakLength: Infinity })}` : ''].join('');
    (level === 'error' ? stderr : stdout).write(`${line}\n`);
  };
  return {
    info: (message, fields) => emit('info', message, fields),
    warn: (message, fields) => emit('warn', message, fields),
    error: (message, fields) => emit('error', message, fields)
  };
}

module.exports = { ...createLogger(), createLogger, redact };
