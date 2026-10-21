const User = require('../models/User');
const Lead = require('../models/Lead');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { isEmailConfigured, sendLeadNotification } = require('../services/mailer');
const log = require('../utils/logger');

// "Try live demo" on the landing page opens the seeded demo restaurant.
exports.getDemo = asyncHandler(async (req, res) => {
  const demo = await User.findOne({ isDemo: true }).select('_id tables').lean();
  if (!demo) throw AppError.notFound('The demo restaurant is not set up. Run npm run seed.', 'NO_DEMO');
  res.json({ restaurantId: demo._id, table: demo.tables?.[0] || 1 });
});

exports.contact = asyncHandler(async (req, res) => {
  const lead = await Lead.create(req.body);
  if (isEmailConfigured()) {
    // The enquiry is already saved; a failed notification email must not fail the request.
    sendLeadNotification(lead).catch((err) => log.error('Lead notification failed', { err }));
  }
  res.status(201).json({ message: 'Thanks! We will get back to you within one working day.' });
});
