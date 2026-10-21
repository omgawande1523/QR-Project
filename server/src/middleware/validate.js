const AppError = require('../utils/AppError');

// Validates and replaces req.body / req.params / req.query with the parsed (trimmed, coerced,
// unknown-keys-stripped) values, so controllers only ever see data that matched a schema.
const validate = (schemas) => (req, res, next) => {
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (!result.success) {
      const details = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || part,
        message: issue.message
      }));
      return next(AppError.badRequest(details[0].message, 'VALIDATION_ERROR', details));
    }
    req[part] = result.data;
  }
  next();
};

module.exports = validate;
