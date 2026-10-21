const mongoose = require('mongoose');
const config = require('./index');

// Rejects if MongoDB cannot be reached, so the server never starts without a database.
async function connectDB() {
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 });
  console.log(`Connected to MongoDB (${mongoose.connection.name})`);

  mongoose.connection.on('disconnected', () => console.warn('MongoDB disconnected'));
  mongoose.connection.on('reconnected', () => console.log('MongoDB reconnected'));
}

module.exports = connectDB;
