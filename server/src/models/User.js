const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, unique: true, sparse: true },
  password: { type: String, required: true, select: false },
  restaurantName: String,
  tables: [Number],
  profilePicture: String,
  bannerImage: String,
  qrColor: { type: String, default: '#000000' },
  qrLogo: String,
  tableStats: { type: Map, of: Number, default: {} }, // tableNumber -> scanCount
  // Billing settings used by the server when it prices an order
  taxPercent: { type: Number, default: 0, min: 0, max: 28 }, // GST %
  serviceChargePercent: { type: Number, default: 0, min: 0, max: 20 },
  acceptingOrders: { type: Boolean, default: true },
  // Password reset: only a SHA-256 hash of the emailed code is stored
  resetCodeHash: { type: String, select: false },
  resetCodeExpiry: { type: Date, select: false },
  resetCodeAttempts: { type: Number, default: 0, select: false },
  // Bumped on password change/reset to invalidate every token issued before
  tokenVersion: { type: Number, default: 0 }
});

module.exports = mongoose.model('User', userSchema);
