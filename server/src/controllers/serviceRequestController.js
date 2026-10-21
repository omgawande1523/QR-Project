const ServiceRequest = require('../models/ServiceRequest');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const emit = require('../sockets/io');

// Customers call the waiter, ask for water, etc. Public, but the table must belong to the restaurant.
exports.create = asyncHandler(async (req, res) => {
  const { restaurantId, tableNumber, type, customerName } = req.body;

  const restaurant = await User.findById(restaurantId).select('tables');
  if (!restaurant) throw AppError.notFound('Restaurant not found');
  if (!restaurant.tables.includes(tableNumber)) throw AppError.badRequest('Unknown table number', 'UNKNOWN_TABLE');

  const request = await ServiceRequest.create({
    restaurantId,
    tableNumber,
    type,
    customerName: customerName || 'Guest'
  });

  emit.toRestaurant(restaurantId, 'serviceRequest', request);
  res.status(201).json({ _id: request._id, type: request.type, tableNumber: request.tableNumber, status: request.status });
});

exports.listPending = asyncHandler(async (req, res) => {
  const requests = await ServiceRequest.find({ restaurantId: req.user.userId, status: 'pending' })
    .sort({ timestamp: -1 });
  res.json(requests);
});

exports.markHandled = asyncHandler(async (req, res) => {
  const request = await ServiceRequest.findById(req.params.id);
  if (!request) throw AppError.notFound('Request not found');
  if (request.restaurantId.toString() !== req.user.userId) throw AppError.forbidden('Not authorized to handle this request');

  request.status = 'handled';
  request.handledAt = new Date();
  await request.save();
  res.json({ message: 'Request handled' });
});
