const mongoose = require('mongoose');

const MENU_ITEM_TAGS = ['bestseller', 'chefs_special', 'new'];

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
  isVeg: { type: Boolean, default: true },
  tags: { type: [{ type: String, enum: MENU_ITEM_TAGS }], default: [] }, // badges on the customer menu
  spiceLevel: { type: Number, min: 0, max: 3, default: 0 },
  calories: { type: Number, min: 0, max: 5000 },
  variants: { type: [variantSchema], default: [] },
  addOns: { type: [addOnSchema], default: [] },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false }
});

// Customer menu and menu manager: one restaurant's items grouped by category.
menuItemSchema.index({ owner: 1, category: 1 });

const MenuItem = mongoose.model('MenuItem', menuItemSchema);
MenuItem.TAGS = MENU_ITEM_TAGS;

module.exports = MenuItem;
