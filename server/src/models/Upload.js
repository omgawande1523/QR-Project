const mongoose = require('mongoose');

// Images an owner added. An "original" is the full-size image as uploaded (or downloaded from a link);
// a "final" is a crop of it that a dish or profile field uses. Keeping the original lets the owner
// re-crop later without uploading again. Finals nothing uses, and originals no final was made from, are
// removed after 24 hours by services/uploadCleanup.js.
const uploadSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, enum: ['original', 'final'], required: true },
  kind: String, // final only: menu | profile | banner | logo
  key: { type: String, required: true },
  url: { type: String, required: true },
  width: Number,
  height: Number,
  original: { type: mongoose.Schema.Types.ObjectId, ref: 'Upload' }, // final only
  crop: { _id: false, x: Number, y: Number, width: Number, height: Number },
  rotation: { type: Number, default: 0 },
  source: { type: String, enum: ['upload', 'url', 'existing'], default: 'upload' },
  createdAt: { type: Date, default: Date.now }
});

uploadSchema.index({ owner: 1, url: 1 });
uploadSchema.index({ role: 1, createdAt: 1 });

module.exports = mongoose.model('Upload', uploadSchema);
