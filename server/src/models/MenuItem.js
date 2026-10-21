const mongoose = require('mongoose');

// A size or portion (Half / Full, Small / Large). Its price replaces the base price.
const variantSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 }
});

// An optional extra (cheese, extra gravy). Its price is added to the unit price.
const addOnSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  price: { type: Number, required: true, min: 0 }
});

const menuItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true, min: 0 },
  category: String,
  image: String,
  available: { type: Boolean, default: true },
  variants: { type: [variantSchema], default: [] },
  addOns: { type: [addOnSchema], default: [] },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false }
});

module.exports = mongoose.model('MenuItem', menuItemSchema);
