const crypto = require('crypto');
const Order = require('../models/Order');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const emit = require('../sockets/io');
const safeEqual = require('../utils/safeEqual');

exports.create = asyncHandler(async (req, res) => {
  const raw = req.body;
  const items = (raw.items || []).map(i => ({
    menuItem: i.menuItem || null,
    menuItemName: i.menuItemName || i.name || 'Unknown Item',
    price: i.price !== undefined ? i.price : 0,
    quantity: i.quantity || 1,
    notes: i.notes || ''
  }));

  const trackingToken = crypto.randomBytes(24).toString('hex');
  const savedOrder = await Order.create({
    items,
    tableNumber: raw.tableNumber,
    customerName: raw.customerName || '',
    totalAmount: raw.totalAmount || 0,
    restaurantId: raw.restaurantId || null,
    trackingToken
  });
  if (savedOrder.restaurantId) emit.toRestaurant(savedOrder.restaurantId, 'newOrder', savedOrder);

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
