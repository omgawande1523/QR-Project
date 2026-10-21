const crypto = require('crypto');
const Order = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const emit = require('../sockets/io');
const safeEqual = require('../utils/safeEqual');
const { priceOrder } = require('../services/pricing');
const { nextInvoiceNumber } = require('../services/invoices');

// Once an order is completed or cancelled its status can no longer change.
const FINAL_STATUSES = ['complete', 'cancelled'];
// Kitchen staff only move orders between these (start, ready, recall).
const KITCHEN_STATUSES = ['pending', 'process', 'ready'];

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

// Newest first, capped (default 500). Items are snapshots, so no populate is needed.
exports.listForOwner = asyncHandler(async (req, res) => {
  const { from, to, status, openSince, limit } = req.query;
  const filter = { restaurantId: req.user.userId };
  if (status) filter.status = status;
  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = from;
    if (to) filter.createdAt.$lte = to;
  }
  if (openSince) filter.$or = [{ createdAt: { $gte: openSince } }, { status: { $nin: FINAL_STATUSES } }];
  res.json(await Order.find(filter).sort({ createdAt: -1 }).limit(limit));
});

// Customer view of one order; needs the tracking token returned when the order was placed.
exports.getStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).select('+trackingToken');
  if (!order || !order.trackingToken || !safeEqual(order.trackingToken, req.query.token)) {
    throw AppError.notFound('Order not found');
  }
  res.json(order);
});

// The guest rates their meal once it has been served; the tracking token proves it is their order.
exports.feedback = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id).select('+trackingToken');
  if (!order || !order.trackingToken || !safeEqual(order.trackingToken, req.body.token)) throw AppError.notFound('Order not found');
  if (!['served', 'billed', 'complete'].includes(order.status)) throw AppError.conflict('You can rate your meal once it has been served', 'NOT_SERVED');
  if (order.feedback?.rating) throw AppError.conflict('Thanks, you have already rated this meal', 'FEEDBACK_EXISTS');
  const { rating, tags, comment } = req.body;
  order.feedback = { rating, tags: [...new Set(tags || [])], comment: comment || undefined, createdAt: new Date() };
  await order.save();
  broadcastOrder(order);
  res.status(201).json(order);
});

async function findOwnOrder(req) {
  const order = await Order.findById(req.params.id);
  if (!order) throw AppError.notFound('Order not found');
  if (order.restaurantId?.toString() !== req.user.userId) throw AppError.forbidden('Not authorized to update this order');
  if (order.status === 'cancelled') throw AppError.conflict('This order was cancelled', 'ORDER_CANCELLED');
  return order;
}

async function ensureInvoiceNumber(order) {
  if (order.invoiceNumber) return;
  order.invoiceNumber = await nextInvoiceNumber(order.restaurantId);
  order.invoicedAt = new Date();
}

function broadcastOrder(order) {
  emit.toRestaurant(order.restaurantId, 'orderUpdated', order);
  emit.toOrder(order._id, 'orderUpdated', order);
}

// Served (or billed) orders close once they are paid; an order paid in advance keeps cooking.
const SETTLE_FROM = ['served', 'billed'];

// Makes the bill: assigns the invoice number once (calling again returns the same one). A served
// order moves to billed, or straight to complete if it was paid in advance.
exports.invoice = asyncHandler(async (req, res) => {
  const order = await findOwnOrder(req);
  await ensureInvoiceNumber(order);
  if (order.status === 'served') order.status = order.payment?.paidAt ? 'complete' : 'billed';
  await order.save();
  broadcastOrder(order);
  res.json(order);
});

// Settles the bill (cash, UPI or card); closes the order if it has been served.
exports.pay = asyncHandler(async (req, res) => {
  const order = await findOwnOrder(req);
  if (order.payment?.paidAt) throw AppError.conflict('This bill is already paid', 'ALREADY_PAID');
  await ensureInvoiceNumber(order);
  order.payment = { method: req.body.method, reference: req.body.reference, paidAt: new Date() };
  if (SETTLE_FROM.includes(order.status)) order.status = 'complete';
  await order.save();
  broadcastOrder(order);
  res.json(order);
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw AppError.notFound('Order not found');
  if (order.restaurantId?.toString() !== req.user.userId) {
    throw AppError.forbidden('Not authorized to update this order');
  }
  if (req.user.role === 'kitchen' && !(KITCHEN_STATUSES.includes(order.status) && KITCHEN_STATUSES.includes(req.body.status))) {
    throw AppError.forbidden('The kitchen can only move orders between New, Preparing and Ready', 'ROLE_FORBIDDEN');
  }
  if (FINAL_STATUSES.includes(order.status) && order.status !== req.body.status) {
    throw AppError.conflict(`This order is already ${order.status === 'complete' ? 'completed' : 'cancelled'}`, 'ORDER_CLOSED');
  }

  order.status = req.body.status;
  await order.save();

  emit.toRestaurant(order.restaurantId, 'orderUpdated', order);
  emit.toOrder(order._id, 'orderUpdated', order);
  res.json(order);
});
