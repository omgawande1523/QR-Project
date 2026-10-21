const bcrypt = require('bcryptjs');
const Staff = require('../models/Staff');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { reissue, endSessions, otherSessions } = require('../services/sessions');

// An email can belong to one login only (owner accounts and staff share the login screen).
async function assertEmailFree(email, exceptStaffId) {
  const [owner, staff] = await Promise.all([User.exists({ email }), Staff.findOne({ email }).select('_id').lean()]);
  if (owner || (staff && String(staff._id) !== String(exceptStaffId))) {
    throw AppError.conflict('That email is already used by another account', 'EMAIL_TAKEN');
  }
}

async function findOwnStaff(req) {
  const staff = await Staff.findOne({ _id: req.params.id, restaurant: req.user.userId });
  if (!staff) throw AppError.notFound('Staff member not found');
  return staff;
}

exports.list = asyncHandler(async (req, res) => {
  res.json(await Staff.find({ restaurant: req.user.userId }).sort({ createdAt: 1 }));
});

exports.create = asyncHandler(async (req, res) => {
  const { name, email, role, password } = req.body;
  await assertEmailFree(email);
  const staff = await Staff.create({ restaurant: req.user.userId, name, email, role, password: await bcrypt.hash(password, 10) });
  res.status(201).json(staff);
});

exports.update = asyncHandler(async (req, res) => {
  const staff = await findOwnStaff(req);
  const signOut = (req.body.role && req.body.role !== staff.role) || req.body.active === false;
  staff.set(req.body);
  if (signOut) staff.tokenVersion += 1; // a new role or deactivation takes effect immediately
  await staff.save();
  if (signOut) await endSessions({ staff: staff._id });
  res.json(staff);
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const staff = await findOwnStaff(req);
  staff.password = await bcrypt.hash(req.body.password, 10);
  staff.tokenVersion += 1;
  await staff.save();
  await endSessions({ staff: staff._id });
  res.json({ message: `Password reset for ${staff.name}. They have been signed out.` });
});

exports.remove = asyncHandler(async (req, res) => {
  const staff = await findOwnStaff(req);
  await staff.deleteOne();
  await endSessions({ staff: staff._id });
  res.json({ message: 'Staff member removed' });
});

// A staff member changes their own password (the owner uses /api/users/:id/change-password).
exports.changeOwnPassword = asyncHandler(async (req, res) => {
  if (!req.user.staffId) throw AppError.badRequest('Use the account settings to change the owner password', 'NOT_STAFF');
  const staff = await Staff.findById(req.user.staffId).select('+password');
  if (!staff || !(await bcrypt.compare(req.body.currentPassword, staff.password))) {
    throw AppError.badRequest('Current password is incorrect', 'WRONG_PASSWORD');
  }
  staff.password = await bcrypt.hash(req.body.newPassword, 10);
  staff.tokenVersion += 1;
  await staff.save();
  await endSessions(otherSessions(req.user));
  res.json({ message: 'Password changed', token: await reissue(req.user.sessionId, { staff }) });
});

exports.assertEmailFree = assertEmailFree;
