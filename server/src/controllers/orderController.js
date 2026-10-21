const Order = require('../models/Order');
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

exports.create = async (req, res) => {
  try {
    const raw = req.body;
    const items = (raw.items || []).map(i => ({
      menuItem: i.menuItem || null,
      menuItemName: i.menuItemName || i.name || 'Unknown Item',
      price: i.price !== undefined ? i.price : 0,
      quantity: i.quantity || 1,
      notes: i.notes || ''
    }));

    const order = new Order({
      items,
      tableNumber: raw.tableNumber,
      customerName: raw.customerName || '',
      totalAmount: raw.totalAmount || 0,
      restaurantId: raw.restaurantId || null
    });

    const savedOrder = await order.save();
    emitToRestaurant(raw.restaurantId, 'newOrder', savedOrder);

    res.status(201).json(savedOrder);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.listForOwner = async (req, res) => {
  try {
    const orders = await Order.find({ restaurantId: req.user.userId })
      .populate('items.menuItem')
      .sort({ createdAt: -1 });

    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getStatus = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'process', 'ready', 'billed', 'complete', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });

    if (order.restaurantId?.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to update this order' });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('items.menuItem');

    emitToRestaurant(updatedOrder.restaurantId, 'orderUpdated', updatedOrder);

    res.json(updatedOrder);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
