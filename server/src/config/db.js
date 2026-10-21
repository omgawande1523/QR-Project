const mongoose = require('mongoose');
const config = require('./index');
const log = require('../utils/logger');

// Rejects if MongoDB cannot be reached, so the server never starts without a database.
async function connectDB() {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
  log.info('Connected to MongoDB', { database: mongoose.connection.name });

  mongoose.connection.on('disconnected', () => log.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => log.info('MongoDB reconnected'));
}

module.exports = connectDB;
