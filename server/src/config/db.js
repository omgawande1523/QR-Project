const mongoose = require('mongoose');
const config = require('./index');

function connectDB() {
  return mongoose.connect(config.mongoUri)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));
}

module.exports = connectDB;
