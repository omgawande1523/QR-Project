const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { sendPasswordResetEmail } = require('../services/mailer');

const signToken = (userId) => jwt.sign({ userId }, config.jwtSecret, { expiresIn: '7d' });

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
  res.json({ message: 'Registered', token: signToken(user._id), userId: user._id });
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
  });
  const ok = user && await bcrypt.compare(password, user.password);
  if (!ok) throw AppError.badRequest('Invalid credentials', 'INVALID_CREDENTIALS');

  res.json({ token: signToken(user._id), userId: user._id });
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;

  const user = await User.findOne({ email });
  if (!user) throw AppError.badRequest('Email not found');

  // Generate reset token (6-digit code for simplicity, or use longer token)
  const resetToken = Math.random().toString(36).substring(2, 8).toUpperCase();
  user.resetToken = resetToken;
  user.resetTokenExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  await user.save();

  const resetLink = `${config.frontendUrl || 'http://localhost:3000'}/reset-password?token=${resetToken}&email=${email}`;
  try {
    await sendPasswordResetEmail({ to: email, resetToken, resetLink });
  } catch (err) {
    console.error('Forgot password email error:', err);
    throw new AppError(502, 'Failed to send reset email', 'EMAIL_FAILED');
  }
  res.json({ message: 'Password reset email sent' });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const { email, token, newPassword } = req.body;

  const user = await User.findOne({ email });
  if (!user) throw AppError.badRequest('User not found');
  if (!user.resetToken || user.resetToken !== token) throw AppError.badRequest('Invalid reset token');
  if (new Date() > user.resetTokenExpiry) throw AppError.badRequest('Reset token has expired');

  user.password = await bcrypt.hash(newPassword, 10);
  user.resetToken = null;
  user.resetTokenExpiry = null;
  await user.save();

  res.json({ message: 'Password reset successfully' });
});

// Public restaurant info for the customer menu (no token needed)
exports.getPublicProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('restaurantName profilePicture bannerImage tables taxPercent serviceChargePercent acceptingOrders');
  if (!user) throw AppError.notFound('Restaurant not found');
  res.json(user);
});

// Scan analytics: increment the scan count for a table
exports.recordScan = asyncHandler(async (req, res) => {
  const { id, tableNumber } = req.params;
  const user = await User.findByIdAndUpdate(id, { $inc: { [`tableStats.${tableNumber}`]: 1 } }, { new: true });
  if (!user) throw AppError.notFound('Restaurant not found');
  res.json({ message: 'Scan recorded', stats: user.tableStats });
});

exports.getProfile = asyncHandler(async (req, res) => {
  assertSelf(req, 'Not authorized to view this profile');
  const user = await User.findById(req.params.id).select('-password -resetToken -resetTokenExpiry');
  if (!user) throw AppError.notFound('User not found');
  res.json(user);
});

exports.updateProfile = asyncHandler(async (req, res) => {
  assertSelf(req, 'Not authorized to update this profile');
  const {
    restaurantName, tables, profilePicture, bannerImage, qrColor, qrLogo,
    taxPercent, serviceChargePercent, acceptingOrders
  } = req.body;

  const updateData = {
    restaurantName, tables, profilePicture, bannerImage, qrColor, qrLogo,
    taxPercent, serviceChargePercent, acceptingOrders
  };
  // Remove undefined fields to avoid overwriting existing data with null
  Object.keys(updateData).forEach((key) => updateData[key] === undefined && delete updateData[key]);

  const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true })
    .select('-password -resetToken -resetTokenExpiry');
  if (!user) throw AppError.notFound('User not found');
  res.json(user);
});

exports.changePassword = asyncHandler(async (req, res) => {
  assertSelf(req, 'Not authorized to change password for this account');
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user.userId);
  if (!user) throw AppError.notFound('User not found');
  if (!await bcrypt.compare(currentPassword, user.password)) {
    throw AppError.badRequest('Current password is incorrect', 'WRONG_PASSWORD');
  }

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();
  res.json({ message: 'Password changed successfully' });
});
