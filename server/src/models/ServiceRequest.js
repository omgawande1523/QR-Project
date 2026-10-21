const mongoose = require('mongoose');

const SERVICE_REQUEST_TYPES = ['Waiter', 'Water', 'Cutlery', 'Bill'];

const serviceRequestSchema = new mongoose.Schema({
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: SERVICE_REQUEST_TYPES, required: true },
  tableNumber: { type: Number, required: true },
  customerName: { type: String, default: 'Guest' },
  timestamp: { type: Date, default: Date.now },
  status: { type: String, enum: ['pending', 'handled'], default: 'pending' },
  handledAt: Date
});

// Dashboard: a restaurant's pending requests, newest first.
serviceRequestSchema.index({ restaurantId: 1, status: 1, timestamp: -1 });

const ServiceRequest = mongoose.model('ServiceRequest', serviceRequestSchema);
ServiceRequest.TYPES = SERVICE_REQUEST_TYPES;

module.exports = ServiceRequest;
