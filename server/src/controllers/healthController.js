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

exports.health = (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
};

exports.apiInfo = (req, res) => {
  res.json({
    message: 'QR Menu API v1.0.0',
    documentation: 'Available endpoints: /api/users, /api/menu, /api/orders'
  });
};
