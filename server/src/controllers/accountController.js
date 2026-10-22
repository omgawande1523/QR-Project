const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Staff = require('../models/Staff');
const MenuItem = require('../models/MenuItem');
const Order = require('../models/Order');
const ServiceRequest = require('../models/ServiceRequest');
const Upload = require('../models/Upload');
const Counter = require('../models/Counter');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { storage } = require('../services/storage');
const { endSessions } = require('../services/sessions');
const log = require('../utils/logger');

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Deletes every record and stored image of a restaurant. Images are removed one by one, best effort.
async function deleteRestaurant(restaurantId) {
  const uploads = await Upload.find({ owner: restaurantId }).select('key').lean();
  for (const upload of uploads) {
    try {
      await storage.remove(upload.key);
    } catch (err) {
      log.error('Account deletion: could not remove an image', { key: upload.key, error: err.message });
    }
  }
  await endSessions({ restaurant: restaurantId });
  await Promise.all([
    MenuItem.deleteMany({ owner: restaurantId }),
    Order.deleteMany({ restaurantId }),
    ServiceRequest.deleteMany({ restaurantId }),
    Staff.deleteMany({ restaurant: restaurantId }),
    Upload.deleteMany({ owner: restaurantId }),
    Counter.deleteMany({ _id: { $regex: `^${escapeRegex(String(restaurantId))}:` } })
  ]);
  await User.deleteOne({ _id: restaurantId });
}

/**
 * Account deletion (from Settings in the website and the app, and the public /delete-account page).
 * Needs the account's password again. An owner deletes the whole restaurant: menu, orders and bills, staff
 * logins, images and every signed-in device with its push token, and also types DELETE. A staff member deletes
 * only their own login.
 */
exports.deleteAccount = asyncHandler(async (req, res) => {
  const { password, confirm } = req.body;
  if (req.user.staffId) {
    const staff = await Staff.findById(req.user.staffId).select('+password');
    if (!staff || !(await bcrypt.compare(password, staff.password))) throw AppError.badRequest('Password is incorrect', 'WRONG_PASSWORD');
    await staff.deleteOne();
    await endSessions({ staff: staff._id });
    return res.json({ message: 'Your login has been deleted' });
  }

  const user = await User.findById(req.user.userId).select('+password isDemo');
  if (!user) throw AppError.notFound('Account not found');
  if (user.isDemo) throw AppError.forbidden('The demo restaurant cannot be deleted', 'DEMO_ACCOUNT');
  if (String(confirm || '').trim().toUpperCase() !== 'DELETE') throw AppError.badRequest('Type DELETE to confirm', 'CONFIRM_DELETE');
  if (!(await bcrypt.compare(password, user.password))) throw AppError.badRequest('Password is incorrect', 'WRONG_PASSWORD');
  await deleteRestaurant(user._id);
  log.info('Restaurant account deleted', { restaurantId: String(user._id) });
  res.json({ message: 'Your restaurant account and all its data have been deleted' });
});

exports.deleteRestaurant = deleteRestaurant;
