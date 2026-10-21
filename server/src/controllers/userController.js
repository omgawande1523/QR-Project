const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const config = require('../config');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const safeEqual = require('../utils/safeEqual');
const { isEmailConfigured, sendPasswordResetEmail } = require('../services/mailer');
const { discardImage } = require('../services/storage');
const { signToken } = require('../services/auth');

const IMAGE_FIELDS = ['profilePicture', 'bannerImage', 'qrLogo'];
// What customers see before ordering (logo = profilePicture).
const PUBLIC_PROFILE_FIELDS = 'restaurantName tagline address profilePicture bannerImage tables categories openingHours '
  + 'taxPercent serviceChargePercent acceptingOrders';
// Never sent to clients (legacy resetToken fields may still exist on older documents).
const PRIVATE_FIELDS = '-password -resetCodeHash -resetCodeExpiry -resetCodeAttempts -tokenVersion -resetToken -resetTokenExpiry';

const RESET_CODE_TTL_MS = 30 * 60 * 1000;
const RESET_CODE_MAX_ATTEMPTS = 5;
const RESET_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L
const FORGOT_PASSWORD_REPLY = 'If an account exists for this email, a reset code has been sent.';
const INVALID_RESET = 'Invalid or expired reset code';

const hashCode = (code) => crypto.createHash('sha256').update(code).digest('hex');

function generateResetCode(length = 8) {
  return Array.from({ length }, () => RESET_CODE_ALPHABET[crypto.randomInt(RESET_CODE_ALPHABET.length)]).join('');
}

function assertSelf(req, message) {
  if (req.user.userId !== req.params.id) throw AppError.forbidden(message);
}

exports.register = asyncHandler(async (req, res) => {
  const { email, phoneNumber, password, restaurantName, tables } = req.body;

  if (await User.exists({ email })) throw AppError.badRequest('Email already registered', 'EMAIL_TAKEN');
  if (phoneNumber && await User.exists({ phoneNumber })) {
    throw AppError.badRequest('Phone number already registered', 'PHONE_TAKEN');
  }

  const user = await User.create({
    email,
    phoneNumber,
    password: await bcrypt.hash(password, 10),
    restaurantName,
    tables: tables && tables.length > 0 ? tables : [1]
  });
  res.json({ message: 'Registered', token: signToken(user), userId: user._id });
});

exports.login = asyncHandler(async (req, res) => {
  const { identifier, password } = req.body;
  // Emails are stored lowercase; older accounts may not be, so match the raw value too.
  const user = await User.findOne({
    $or: [
      { email: identifier.toLowerCase() },
      { email: identifier },
      { phoneNumber: identifier.replace(/[\s-]/g, '') }
    ]
  }).select('+password');
  const ok = user && await bcrypt.compare(password, user.password);
  if (!ok) throw AppError.badRequest('Invalid credentials', 'INVALID_CREDENTIALS');

  res.json({ token: signToken(user), userId: user._id });
});

// The reply is the same whether or not the email is registered, so it cannot be used to find accounts.
exports.forgotPassword = asyncHandler(async (req, res) => {
  if (!isEmailConfigured()) {
    throw new AppError(503, 'Password reset by email is not set up on this server', 'EMAIL_NOT_CONFIGURED');
  }
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.json({ message: FORGOT_PASSWORD_REPLY });

  const resetCode = generateResetCode();
  user.resetCodeHash = hashCode(resetCode);
  user.resetCodeExpiry = new Date(Date.now() + RESET_CODE_TTL_MS);
  user.resetCodeAttempts = 0;
  await user.save();

  const params = new URLSearchParams({ token: resetCode, email });
  const resetLink = `${config.frontendUrl || 'http://localhost:3000'}/reset-password?${params}`;
  try {
    await sendPasswordResetEmail({ to: email, resetCode, resetLink });
  } catch (err) {
    console.error('Forgot password email error:', err);
    await User.updateOne({ _id: user._id }, { $unset: { resetCodeHash: 1, resetCodeExpiry: 1 } });
    throw new AppError(502, 'Failed to send reset email', 'EMAIL_FAILED');
  }
  res.json({ message: FORGOT_PASSWORD_REPLY });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const { email, token, newPassword } = req.body;

  const user = await User.findOne({ email }).select('+resetCodeHash +resetCodeExpiry +resetCodeAttempts');
  if (!user || !user.resetCodeHash || !user.resetCodeExpiry || user.resetCodeExpiry < new Date()) {
    throw AppError.badRequest(INVALID_RESET, 'INVALID_RESET_CODE');
  }
  if (!safeEqual(user.resetCodeHash, hashCode(token.trim().toUpperCase()))) {
    // A code allows only a few guesses before it is thrown away.
    const attempts = (user.resetCodeAttempts || 0) + 1;
    const update = attempts >= RESET_CODE_MAX_ATTEMPTS
      ? { $unset: { resetCodeHash: 1, resetCodeExpiry: 1 }, $set: { resetCodeAttempts: 0 } }
      : { $set: { resetCodeAttempts: attempts } };
    await User.updateOne({ _id: user._id }, update);
    throw AppError.badRequest(INVALID_RESET, 'INVALID_RESET_CODE');
  }

  await User.updateOne({ _id: user._id }, {
    $set: { password: await bcrypt.hash(newPassword, 10), resetCodeAttempts: 0 },
    $unset: { resetCodeHash: 1, resetCodeExpiry: 1 },
    $inc: { tokenVersion: 1 }
  });
  res.json({ message: 'Password reset successfully' });
});

// Public restaurant info for the customer menu (no token needed)
exports.getPublicProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select(PUBLIC_PROFILE_FIELDS);
  if (!user) throw AppError.notFound('Restaurant not found');
  res.json(user);
});

// Scan analytics: increment the scan count for a table
exports.recordScan = asyncHandler(async (req, res) => {
  const { id, tableNumber } = req.params;
  // Count only real tables; the stats themselves are for the owner, not the public.
  const updated = await User.findOneAndUpdate(
    { _id: id, tables: tableNumber },
    { $inc: { [`tableStats.${tableNumber}`]: 1 } }
  ).select('_id');
  if (!updated) {
    if (!await User.exists({ _id: id })) throw AppError.notFound('Restaurant not found');
    throw AppError.badRequest('Unknown table number', 'UNKNOWN_TABLE');
  }
  res.json({ message: 'Scan recorded' });
});

exports.getProfile = asyncHandler(async (req, res) => {
  assertSelf(req, 'Not authorized to view this profile');
  const user = await User.findById(req.params.id).select(PRIVATE_FIELDS);
  if (!user) throw AppError.notFound('User not found');
  res.json(user);
});

exports.updateProfile = asyncHandler(async (req, res) => {
  assertSelf(req, 'Not authorized to update this profile');
  // req.body holds only fields allowed by validators/users.js; skip the ones not sent.
  const updateData = Object.fromEntries(Object.entries(req.body).filter(([, value]) => value !== undefined));

  const before = await User.findById(req.params.id).select('profilePicture bannerImage qrLogo');
  if (!before) throw AppError.notFound('User not found');

  const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true })
    .select(PRIVATE_FIELDS);

  // Delete uploaded images that were replaced or cleared.
  await Promise.all(IMAGE_FIELDS
    .filter((field) => before[field] && before[field] !== user[field])
    .map((field) => discardImage(before[field])));
  res.json(user);
});

exports.changePassword = asyncHandler(async (req, res) => {
  assertSelf(req, 'Not authorized to change password for this account');
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user.userId).select('+password');
  if (!user) throw AppError.notFound('User not found');
  if (!await bcrypt.compare(currentPassword, user.password)) {
    throw AppError.badRequest('Current password is incorrect', 'WRONG_PASSWORD');
  }

  // Bumping tokenVersion signs out every other session; this one gets a fresh token.
  user.password = await bcrypt.hash(newPassword, 10);
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  res.json({ message: 'Password changed successfully', token: signToken(user) });
});
