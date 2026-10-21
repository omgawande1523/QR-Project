const crypto = require('crypto');
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const emit = require('../sockets/io');
const safeEqual = require('../utils/safeEqual');
const { priceOrder } = require('../services/pricing');

exports.create = asyncHandler(async (req, res) => {
  const { restaurantId, tableNumber, customerName, customerPhone, items } = req.body;

  const restaurant = await User.findById(restaurantId).select('tables taxPercent serviceChargePercent acceptingOrders');
  if (!restaurant) throw AppError.notFound('Restaurant not found');
  if (restaurant.acceptingOrders === false) {
    throw AppError.conflict('This restaurant is not accepting orders right now', 'NOT_ACCEPTING_ORDERS');
  }
  if (!restaurant.tables.includes(tableNumber)) throw AppError.badRequest('Unknown table number', 'UNKNOWN_TABLE');

  // Only this restaurant's items are loaded, so ids from another menu are simply "not found".
  const ids = [...new Set(items.map((line) => line.menuItem))];
  const menuItems = await MenuItem.find({ _id: { $in: ids }, owner: restaurantId });
  const pricing = priceOrder(restaurant, new Map(menuItems.map((m) => [String(m._id), m])), items);

  const trackingToken = crypto.randomBytes(24).toString('hex');
  const savedOrder = await Order.create({
    ...pricing,
    tableNumber,
    customerName: customerName || '',
    customerPhone,
    restaurantId,
    trackingToken
  });
  emit.toRestaurant(restaurantId, 'newOrder', savedOrder);

  res.status(201).json({ ...savedOrder.toJSON(), trackingToken });
});

exports.listForOwner = asyncHandler(async (req, res) => {
  const orders = await Order.find({ restaurantId: req.user.userId })
    .populate('items.menuItem')
    .sort({ createdAt: -1 });
  res.json(orders);
});

// Customer view of one order; needs the tracking token returned when the order was placed.
exports.getStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).select('+trackingToken');
  if (!order || !order.trackingToken || !safeEqual(order.trackingToken, req.query.token)) {
    throw AppError.notFound('Order not found');
  }
  res.json(order);
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw AppError.notFound('Order not found');
  if (order.restaurantId?.toString() !== req.user.userId) {
    throw AppError.forbidden('Not authorized to update this order');
  }

  order.status = req.body.status;
  await order.save();
  const updatedOrder = await order.populate('items.menuItem');

  emit.toRestaurant(updatedOrder.restaurantId, 'orderUpdated', updatedOrder);
  emit.toOrder(updatedOrder._id, 'orderUpdated', updatedOrder);
  res.json(updatedOrder);
});
