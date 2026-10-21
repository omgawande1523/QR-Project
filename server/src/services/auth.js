const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const Staff = require('../models/Staff');

const TOKEN_TTL = '7d';

// Roles: the owner is the restaurant account itself; staff are Staff documents linked to it.
const ROLES = ['owner', 'manager', 'waiter', 'kitchen'];

// Tokens carry a tokenVersion; bumping it (password change or reset, role change, deactivation) signs
// out every session issued before. Tokens issued before versioning existed count as version 0.
function signToken(user) {
  return jwt.sign({ userId: String(user._id), tv: user.tokenVersion || 0 }, config.jwtSecret, { expiresIn: TOKEN_TTL });
}

function signStaffToken(staff) {
  return jwt.sign(
    { userId: String(staff.restaurant), staffId: String(staff._id), tv: staff.tokenVersion || 0 },
    config.jwtSecret,
    { expiresIn: TOKEN_TTL }
  );
}

/**
 * Resolves a valid, current token to the acting session:
 *   { userId: <restaurant id>, role: 'owner' | 'manager' | 'waiter' | 'kitchen', staffId?, name? }
 * userId is always the restaurant, so every restaurant-scoped query works for staff too.
 */
async function verifySessionToken(token) {
  const decoded = jwt.verify(token, config.jwtSecret);
  if (decoded.staffId) {
    const staff = await Staff.findById(decoded.staffId).select('restaurant role active tokenVersion name').lean();
    if (!staff || !staff.active || (staff.tokenVersion || 0) !== (decoded.tv || 0) || String(staff.restaurant) !== decoded.userId) {
      throw new Error('Session is no longer valid');
    }
    return { userId: String(staff.restaurant), role: staff.role, staffId: String(staff._id), name: staff.name };
  }
  const user = await User.findById(decoded.userId).select('tokenVersion').lean();
  if (!user || (user.tokenVersion || 0) !== (decoded.tv || 0)) {
    throw new Error('Session is no longer valid');
  }
  return { userId: String(user._id), role: 'owner' };
}

module.exports = { ROLES, signToken, signStaffToken, verifySessionToken };
