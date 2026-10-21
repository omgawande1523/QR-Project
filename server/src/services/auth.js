const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const Staff = require('../models/Staff');
const Session = require('../models/Session');

const DAY_MS = 24 * 60 * 60 * 1000;
// Website logins last 7 days. The staff app stays signed in for 30 days and renews its token while in use
// (POST /api/sessions/refresh), so a kitchen tablet does not get logged out mid-service.
const TOKEN_TTL_DAYS = { web: 7, app: 30 };
// lastActiveAt is written at most this often, not on every request.
const TOUCH_EVERY_MS = 5 * 60 * 1000;

// Roles: the owner is the restaurant account itself; staff are Staff documents linked to it.
const ROLES = ['owner', 'manager', 'waiter', 'kitchen'];

const ttlFor = (session) => TOKEN_TTL_DAYS[session?.client] || TOKEN_TTL_DAYS.web;

// Tokens carry a tokenVersion; bumping it (password change or reset, role change, deactivation) signs
// out every session issued before. Tokens issued before versioning existed count as version 0.
// `session` adds its id (sid); tokens from before sessions existed have none and stay valid until they expire.
function signToken(user, session) {
  return jwt.sign(
    { userId: String(user._id), tv: user.tokenVersion || 0, ...(session ? { sid: String(session._id) } : {}) },
    config.jwtSecret,
    { expiresIn: `${ttlFor(session)}d` }
  );
}

function signStaffToken(staff, session) {
  return jwt.sign(
    { userId: String(staff.restaurant), staffId: String(staff._id), tv: staff.tokenVersion || 0, ...(session ? { sid: String(session._id) } : {}) },
    config.jwtSecret,
    { expiresIn: `${ttlFor(session)}d` }
  );
}

// A token with a session id is valid only while that session exists (it is deleted on sign-out).
async function checkSession(decoded) {
  if (!decoded.sid) return undefined;
  const session = await Session.findById(decoded.sid).select('restaurant staff lastActiveAt expiresAt').lean();
  if (!session || session.expiresAt < new Date()
    || String(session.restaurant) !== decoded.userId
    || String(session.staff || '') !== String(decoded.staffId || '')) {
    throw new Error('Session is no longer valid');
  }
  if (Date.now() - new Date(session.lastActiveAt).getTime() > TOUCH_EVERY_MS) {
    Session.updateOne({ _id: session._id }, { lastActiveAt: new Date() }).catch(() => {});
  }
  return String(session._id);
}

/**
 * Resolves a valid, current token to the acting session:
 *   { userId: <restaurant id>, role: 'owner' | 'manager' | 'waiter' | 'kitchen', staffId?, name?, sessionId? }
 * userId is always the restaurant, so every restaurant-scoped query works for staff too.
 */
async function verifySessionToken(token) {
  const decoded = jwt.verify(token, config.jwtSecret);
  if (decoded.staffId) {
    const staff = await Staff.findById(decoded.staffId).select('restaurant role active tokenVersion name').lean();
    if (!staff || !staff.active || (staff.tokenVersion || 0) !== (decoded.tv || 0) || String(staff.restaurant) !== decoded.userId) {
      throw new Error('Session is no longer valid');
    }
    const sessionId = await checkSession(decoded);
    return { userId: String(staff.restaurant), role: staff.role, staffId: String(staff._id), name: staff.name, sessionId };
  }
  const user = await User.findById(decoded.userId).select('tokenVersion').lean();
  if (!user || (user.tokenVersion || 0) !== (decoded.tv || 0)) {
    throw new Error('Session is no longer valid');
  }
  const sessionId = await checkSession(decoded);
  return { userId: String(user._id), role: 'owner', sessionId };
}

module.exports = { ROLES, TOKEN_TTL_DAYS, DAY_MS, ttlFor, signToken, signStaffToken, verifySessionToken };
