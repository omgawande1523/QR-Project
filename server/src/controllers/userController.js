const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const { sendPasswordResetEmail } = require('../services/mailer');

exports.register = async (req, res) => {
  try {
    const { email, phoneNumber, password, restaurantName, tables } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password required' });

    // Check if email already exists
    const emailExists = await User.findOne({ email });
    if (emailExists) return res.status(400).json({ message: 'Email already registered' });

    // Check if phone number already exists
    if (phoneNumber) {
      const phoneExists = await User.findOne({ phoneNumber });
      if (phoneExists) return res.status(400).json({ message: 'Phone number already registered' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({
      email,
      phoneNumber,
      password: hashed,
      restaurantName,
      tables: (tables && tables.length > 0) ? tables : [1]
    });
    await user.save();
    const token = jwt.sign({ userId: user._id }, config.jwtSecret, { expiresIn: '7d' });
    res.json({ message: 'Registered', token, userId: user._id });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Registration failed' });
  }
};

exports.login = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    const user = await User.findOne({
      $or: [
        { email: identifier },
        { phoneNumber: identifier }
      ]
    });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id }, config.jwtSecret, { expiresIn: '7d' });
    res.json({ token, userId: user._id });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Login failed' });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Email not found' });

    // Generate reset token (6-digit code for simplicity, or use longer token)
    const resetToken = Math.random().toString(36).substring(2, 8).toUpperCase();
    const resetTokenExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save();

    const resetLink = `${config.frontendUrl || 'http://localhost:3000'}/reset-password?token=${resetToken}&email=${email}`;
    await sendPasswordResetEmail({ to: email, resetToken, resetLink });
    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Failed to send reset email' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) {
      return res.status(400).json({ message: 'Email, token, and new password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'User not found' });

    // Check if token is valid and not expired
    if (!user.resetToken || user.resetToken !== token) {
      return res.status(400).json({ message: 'Invalid reset token' });
    }

    if (new Date() > user.resetTokenExpiry) {
      return res.status(400).json({ message: 'Reset token has expired' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Failed to reset password' });
  }
};

// Public restaurant info for the customer menu (no token needed)
exports.getPublicProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('restaurantName profilePicture bannerImage tables');
    if (!user) return res.status(404).json({ message: 'Restaurant not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Scan analytics: increment the scan count for a table
exports.recordScan = async (req, res) => {
  try {
    const { id, tableNumber } = req.params;

    const update = { $inc: { [`tableStats.${tableNumber}`]: 1 } };
    const user = await User.findByIdAndUpdate(id, update, { new: true });

    if (!user) return res.status(404).json({ message: 'Restaurant not found' });

    res.json({ message: 'Scan recorded', stats: user.tableStats });
  } catch (error) {
    console.error('Scan tracking error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    if (req.user.userId !== req.params.id) {
      return res.status(403).json({ message: 'Not authorized to view this profile' });
    }
    const user = await User.findById(req.params.id).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    if (req.user.userId !== req.params.id) {
      return res.status(403).json({ message: 'Not authorized to update this profile' });
    }
    const { restaurantName, tables, profilePicture, bannerImage, qrColor, qrLogo } = req.body;

    if (!restaurantName || !restaurantName.trim()) {
      return res.status(400).json({ message: 'Restaurant name is required' });
    }

    const updateData = { restaurantName, tables, profilePicture, bannerImage, qrColor, qrLogo };
    // Remove undefined fields to avoid overwriting existing data with null
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ message: error.message || 'Failed to update profile' });
  }
};

exports.changePassword = async (req, res) => {
  try {
    if (req.user.userId !== req.params.id) {
      return res.status(403).json({ message: 'Not authorized to change password for this account' });
    }
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(400).json({ message: 'Current password is incorrect' });

    const hashed = await bcrypt.hash(newPassword, 10);
    user.password = hashed;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
