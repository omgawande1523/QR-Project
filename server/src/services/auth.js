const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');

const TOKEN_TTL = '7d';

// The token carries the user's tokenVersion; bumping it (password change or reset) signs out every
// session issued before. Tokens issued before versioning existed count as version 0.
function signToken(user) {
  return jwt.sign({ userId: String(user._id), tv: user.tokenVersion || 0 }, config.jwtSecret, { expiresIn: TOKEN_TTL });
}

// Resolves to { userId } for a valid, current token; rejects otherwise.
async function verifySessionToken(token) {
  const decoded = jwt.verify(token, config.jwtSecret);
  const user = await User.findById(decoded.userId).select('tokenVersion').lean();
  if (!user || (user.tokenVersion || 0) !== (decoded.tv || 0)) {
    throw new Error('Session is no longer valid');
  }
  return { userId: String(user._id) };
}

module.exports = { signToken, verifySessionToken };
