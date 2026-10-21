const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
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
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  app.use(require('./routes'));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
