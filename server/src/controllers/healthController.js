const mongoose = require('mongoose');

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
