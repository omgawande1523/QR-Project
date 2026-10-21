const MenuItem = require('../models/MenuItem');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const emit = require('../sockets/io');

async function findOwnedItem(req, action) {
  const item = await MenuItem.findById(req.params.id);
  if (!item) throw AppError.notFound('Item not found');
  if (item.owner?.toString() !== req.user.userId) throw AppError.forbidden(`Not authorized to ${action} this item`);
  return item;
}

// Customer menus and the owner's other open dashboards update live after every change.
function broadcast(ownerId, event, payload) {
  emit.toMenu(ownerId, event, payload);
  emit.toRestaurant(ownerId, event, payload);
}

exports.listByRestaurant = asyncHandler(async (req, res) => {
  res.json(await MenuItem.find({ owner: req.params.userId }));
});

exports.create = asyncHandler(async (req, res) => {
  const item = await MenuItem.create({ ...req.body, owner: req.user.userId });
  broadcast(req.user.userId, 'menuUpdated', item);
  res.json(item);
});

exports.update = asyncHandler(async (req, res) => {
  const item = await findOwnedItem(req, 'update');
  item.set(req.body);
  await item.save();
  broadcast(req.user.userId, 'menuUpdated', item);
  res.json(item);
});

exports.remove = asyncHandler(async (req, res) => {
  const item = await findOwnedItem(req, 'delete');
  await item.deleteOne();
  broadcast(req.user.userId, 'menuItemDeleted', { _id: item._id });
  res.json({ message: 'Deleted' });
});
