const mongoose = require('mongoose');

const serviceRequestSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: String,
  tableNumber: String,
  customerName: String,
  timestamp: { type: Date, default: Date.now },
  status: { type: String, default: 'pending' } // pending, handled
});

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);
