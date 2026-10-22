const mongoose = require('mongoose');

const PUSH_TYPES = ['newOrder', 'tableRequest', 'orderReady'];

// One signed-in device: a browser or the staff app. Login tokens carry its id (sid), so a single device can
// be signed out from Settings. The app's push token lives here too and goes away with the session.
// Sessions are deleted on sign-out, password change or reset, role change and deactivation; expired ones
// are removed by MongoDB (TTL index on expiresAt).
const sessionSchema = new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  staff: { type: mongoose.Schema.Types.ObjectId, ref: 'Staff', default: null, index: true }, // null: the owner
  role: { type: String, enum: ['owner', 'manager', 'waiter', 'kitchen'], required: true },
  client: { type: String, enum: ['web', 'app'], default: 'web' },
  platform: { type: String, enum: ['web', 'android', 'ios'], default: 'web' }, // where the app runs
  deviceName: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  lastActiveAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
  push: {
    _id: false,
    token: String, // FCM registration token of this device
    platform: { type: String, enum: ['android', 'ios'] },
    // Per-device switches for each notification type (missing = on)
    prefs: { _id: false, ...Object.fromEntries(PUSH_TYPES.map((t) => [t, { type: Boolean, default: true }])) },
    updatedAt: Date
  }
});

sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ 'push.token': 1 }, { sparse: true });

const Session = mongoose.model('Session', sessionSchema);
Session.PUSH_TYPES = PUSH_TYPES;

module.exports = Session;
