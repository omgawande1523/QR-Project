const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const { storage } = require('./services/storage');
const { notFound, errorHandler } = require('./middleware/error');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }));
  app.use(cors({
    origin: config.allowedOrigins
  }));
  // Images go through /api/uploads as multipart, so JSON bodies stay small.
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ limit: '100kb', extended: false }));

  if (config.storage.driver === 'local') {
    // File names are random UUIDs, so they can be cached forever.
    app.use(storage.publicPrefix, express.static(storage.uploadDir, {
      immutable: true,
      maxAge: '365d',
      index: false,
      fallthrough: false
    }));
  }

  app.use(require('./routes'));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
