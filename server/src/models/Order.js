const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  items: [{
    menuItem: { type: mongoose.Schema.Types.ObjectId, ref: 'MenuItem', required: false },
    menuItemName: String,
    price: Number,
    quantity: { type: Number, default: 1 },
    notes: String
  }],
  tableNumber: Number,
  customerName: String,
  status: { type: String, default: 'pending' },
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
