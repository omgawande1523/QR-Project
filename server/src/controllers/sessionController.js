const Session = require('../models/Session');
const User = require('../models/User');
const Staff = require('../models/Staff');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { subjectFilter, otherSessions, reissue, endSessions } = require('../services/sessions');

const view = (session, currentId) => ({
  id: session._id,
  client: session.client,
  deviceName: session.deviceName,
  createdAt: session.createdAt,
  lastActiveAt: session.lastActiveAt,
  current: String(session._id) === String(currentId),
  notifications: Boolean(session.push?.token),
  // This device's own switches (shown in its Settings)
  ...(String(session._id) === String(currentId) ? { prefs: session.push?.prefs || {} } : {})
});

// Push tokens belong to a session, so a token from before sessions existed cannot register one.
function requireSession(req) {
  if (!req.user.sessionId) throw AppError.conflict('Please sign in again on this device to continue', 'SIGN_IN_AGAIN');
  return req.user.sessionId;
}

// The signed-in devices of this login (the owner's, or the staff member's own), newest activity first.
exports.list = asyncHandler(async (req, res) => {
  const sessions = await Session.find({ ...subjectFilter(req.user), expiresAt: { $gt: new Date() } })
    .sort({ lastActiveAt: -1 })
    .lean();
  res.json(sessions.map((s) => view(s, req.user.sessionId)));
});

// Signs out one device. Signing out this device is the same as DELETE /current.
exports.remove = asyncHandler(async (req, res) => {
  const ended = await endSessions({ ...subjectFilter(req.user), _id: req.params.id });
  if (!ended) throw AppError.notFound('That device is already signed out', 'SESSION_NOT_FOUND');
  res.status(204).end();
});

exports.removeCurrent = asyncHandler(async (req, res) => {
  if (req.user.sessionId) await endSessions({ _id: req.user.sessionId });
  res.status(204).end();
});

// Signs out every other device, including logins from before sessions existed (tokenVersion), and gives
// this device a fresh token.
exports.signOutEverywhere = asyncHandler(async (req, res) => {
  const Model = req.user.staffId ? Staff : User;
  const subject = await Model.findByIdAndUpdate(req.user.staffId || req.user.userId, { $inc: { tokenVersion: 1 } }, { new: true });
  if (!subject) throw AppError.notFound('Account not found');
  const ended = await endSessions(otherSessions(req.user));
  const token = await reissue(req.user.sessionId, req.user.staffId ? { staff: subject } : { user: subject });
  res.json({ token, signedOut: ended });
});

// The staff app renews its token while it is in use, so it stays signed in.
exports.refresh = asyncHandler(async (req, res) => {
  requireSession(req);
  const subject = req.user.staffId ? await Staff.findById(req.user.staffId) : await User.findById(req.user.userId);
  if (!subject) throw AppError.notFound('Account not found');
  res.json({ token: await reissue(req.user.sessionId, req.user.staffId ? { staff: subject } : { user: subject }) });
});

// Registers this device for push notifications, or updates its per-type switches.
exports.setPush = asyncHandler(async (req, res) => {
  const sessionId = requireSession(req);
  const { token, platform, prefs } = req.body;
  const session = await Session.findById(sessionId);
  if (!session) throw AppError.unauthorized('Your session has expired. Please log in again.', 'INVALID_TOKEN');
  if (token) {
    // A token belongs to one device: an older session on the same phone stops receiving its notifications.
    await Session.updateMany({ _id: { $ne: session._id }, 'push.token': token }, { $unset: { push: 1 } });
    session.set('push.token', token);
    session.set('push.platform', platform);
  }
  if (prefs) Object.entries(prefs).forEach(([type, on]) => session.set(`push.prefs.${type}`, on));
  session.set('push.updatedAt', new Date());
  await session.save();
  res.json({ notifications: Boolean(session.push?.token), prefs: session.push?.prefs || {} });
});

exports.removePush = asyncHandler(async (req, res) => {
  if (req.user.sessionId) await Session.updateOne({ _id: req.user.sessionId }, { $unset: { 'push.token': 1, 'push.platform': 1 } });
  res.status(204).end();
});
