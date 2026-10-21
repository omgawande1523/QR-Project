const mongoose = require('mongoose');

// Every price on an order is a snapshot computed by the server when the order was placed.
const orderItemSchema = new mongoose.Schema({
  menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem' },
  menuItemName: String,
  variant: { name: String, price: Number },
  addOns: [{ _id: false, name: String, price: Number }],
  price: Number, // unit price including variant and add-ons
  quantity: { type: Number, default: 1 },
  notes: String,
  lineTotal: Number
});

const orderSchema = new mongoose.Schema({
  items: [orderItemSchema],
  tableNumber: Number,
  customerName: String,
  customerPhone: String,
  status: { type: String, default: 'pending' },
  subtotal: Number,
  serviceChargePercent: { type: Number, default: 0 },
  serviceChargeAmount: { type: Number, default: 0 },
  taxPercent: { type: Number, default: 0 },
  taxAmount: { type: Number, default: 0 },
  totalAmount: Number,
  restaurantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  // Secret handed to the customer who placed the order; required to read or follow it.
  trackingToken: { type: String, select: false },
  createdAt: { type: Date, default: Date.now }
});

orderSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.trackingToken;
    return ret;
  }
});

module.exports = mongoose.model('Order', orderSchema);
