const mongoose = require('mongoose');

const STAFF_ROLES = ['manager', 'waiter', 'kitchen'];

// A login for someone who works at a restaurant. The restaurant owner is the User document itself.
const staffSchema = new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: STAFF_ROLES, required: true },
  active: { type: Boolean, default: true },
  // Bumped on password reset, role change or deactivation to sign out existing sessions.
  tokenVersion: { type: Number, default: 0 },
  lastLoginAt: Date,
  createdAt: { type: Date, default: Date.now }
});

staffSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.tokenVersion;
    return ret;
  }
});

const Staff = mongoose.model('Staff', staffSchema);
Staff.ROLES = STAFF_ROLES;

module.exports = Staff;
