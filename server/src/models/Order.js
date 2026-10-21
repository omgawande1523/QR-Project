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
  // Billing: invoice number assigned when the bill is made; payment recorded when it is settled.
  invoiceNumber: String,
  invoicedAt: Date,
  payment: {
    method: { type: String, enum: ['cash', 'upi', 'card', 'online'] },
    reference: String,
    paidAt: Date
  },
  // The customer's rating once the meal is served (one per order).
  feedback: {
    rating: { type: Number, min: 1, max: 5 },
    tags: { type: [String], default: undefined },
    comment: String,
    createdAt: Date
  },
  // Secret handed to the customer who placed the order; required to read or follow it.
  trackingToken: { type: String, select: false },
  createdAt: { type: Date, default: Date.now }
});

// Dashboard and analytics: one restaurant's orders, newest first.
orderSchema.index({ restaurantId: 1, createdAt: -1 });
orderSchema.index({ restaurantId: 1, invoiceNumber: 1 }, { unique: true, partialFilterExpression: { invoiceNumber: { $type: 'string' } } });

orderSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.trackingToken;
    return ret;
  }
});

module.exports = mongoose.model('Order', orderSchema);
