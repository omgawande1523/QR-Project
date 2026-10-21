const mongoose = require('mongoose');
const config = require('../config');

exports.root = (req, res) => {
  res.json({
    message: 'QR Menu Backend API',
    status: 'running',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api',
      users: '/api/users',
      menu: '/api/menu',
      orders: '/api/orders'
    }
  });
};

// 503 while the database is unreachable, so hosting health checks can restart or hold traffic.
exports.health = (req, res) => {
  const connected = mongoose.connection.readyState === 1;
  res.status(connected ? 200 : 503).json({
    status: connected ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: connected ? 'connected' : 'disconnected'
  });
};

exports.apiInfo = (req, res) => {
  res.json({
    message: 'QR Menu API v1.0.0',
    documentation: 'Available endpoints: /api/users, /api/menu, /api/orders'
  });
};

// The staff app checks this on start: below minVersion it must update, below latestVersion it may.
exports.appVersion = (req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json(config.app);
};
