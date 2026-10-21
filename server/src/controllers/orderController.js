const Order = require('../models/Order');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { getIo } = require('../sockets/io');

function emitToRestaurant(restaurantId, event, payload) {
  const io = getIo();
  if (!io) return;
  try {
    if (restaurantId) {
      io.to(restaurantId.toString()).emit(event, payload);
    } else {
      io.emit(event, payload);
    }
  } catch (emitErr) {
    console.error('Socket emit error:', emitErr);
  }
}

exports.create = asyncHandler(async (req, res) => {
  const raw = req.body;
  const items = (raw.items || []).map(i => ({
    menuItem: i.menuItem || null,
    menuItemName: i.menuItemName || i.name || 'Unknown Item',
    price: i.price !== undefined ? i.price : 0,
    quantity: i.quantity || 1,
    notes: i.notes || ''
  }));

  const savedOrder = await Order.create({
    items,
    tableNumber: raw.tableNumber,
    customerName: raw.customerName || '',
    totalAmount: raw.totalAmount || 0,
    restaurantId: raw.restaurantId || null
  });
  emitToRestaurant(raw.restaurantId, 'newOrder', savedOrder);

  res.status(201).json(savedOrder);
});

exports.listForOwner = asyncHandler(async (req, res) => {
  const orders = await Order.find({ restaurantId: req.user.userId })
    .populate('items.menuItem')
    .sort({ createdAt: -1 });
  res.json(orders);
});

exports.getStatus = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) throw AppError.notFound('Order not found');
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

  emitToRestaurant(updatedOrder.restaurantId, 'orderUpdated', updatedOrder);
  res.json(updatedOrder);
});
