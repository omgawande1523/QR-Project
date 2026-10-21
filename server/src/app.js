const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const config = require('./config');
const { storage } = require('./services/storage');
const { imageVariants } = require('./services/storage/imageVariants');
const { notFound, errorHandler } = require('./middleware/error');

function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }));
  app.use(cors({
    origin: config.allowedOrigins
  }));
  // gzip JSON (a menu is ~20 KB, ~5 KB compressed); images are already compressed and are skipped.
  app.use(compression());
  // Images go through /api/uploads as multipart, so JSON bodies stay small.
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ limit: '100kb', extended: false }));

  if (config.storage.driver === 'local') {
    // ?w=320 etc.: resized copies for srcset. File names are random UUIDs, so they can be cached forever.
    app.use(storage.publicPrefix, imageVariants(storage.uploadDir));
    app.use(storage.publicPrefix, express.static(storage.uploadDir, {
      immutable: true,
      maxAge: '365d',
      index: false,
      dotfiles: 'ignore', // also inside dot-folders such as .variants (not the default)
      fallthrough: false
    }));
  }

  app.use(require('./routes'));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
