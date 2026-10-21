const mongoose = require('mongoose');

// Atomic sequences, e.g. invoice numbers per restaurant per financial year ("<restaurantId>:invoice:2026-27").
const counterSchema = new mongoose.Schema({
  _id: { type: String },
  seq: { type: Number, default: 0 }
});

const Counter = mongoose.model('Counter', counterSchema);

Counter.next = async (key) => {
  const doc = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return doc.seq;
};

module.exports = Counter;
