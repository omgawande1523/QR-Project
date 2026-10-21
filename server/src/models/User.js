const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  phoneNumber: { type: String, unique: true, sparse: true },
  password: { type: String, required: true },
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
  resetToken: String,
  resetTokenExpiry: Date
});

module.exports = mongoose.model('User', userSchema);
