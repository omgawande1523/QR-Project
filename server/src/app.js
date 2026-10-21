const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');

function createApp() {
  const app = express();

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  }));
  app.use(cors({
    origin: config.allowedOrigins
  }));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  app.use(require('./routes'));

  return app;
}

module.exports = createApp;
