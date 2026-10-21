const MenuItem = require('../models/MenuItem');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

async function findOwnedItem(req, action) {
  const item = await MenuItem.findById(req.params.id);
  if (!item) throw AppError.notFound('Item not found');
  if (item.owner?.toString() !== req.user.userId) throw AppError.forbidden(`Not authorized to ${action} this item`);
  return item;
}

exports.listAll = asyncHandler(async (req, res) => {
  res.json(await MenuItem.find());
});

exports.listByRestaurant = asyncHandler(async (req, res) => {
  res.json(await MenuItem.find({ owner: req.params.userId }));
});

exports.create = asyncHandler(async (req, res) => {
  const item = await MenuItem.create({ ...req.body, owner: req.user.userId });
  res.json(item);
});

exports.update = asyncHandler(async (req, res) => {
  const item = await findOwnedItem(req, 'update');
  item.set(req.body);
  res.json(await item.save());
});

exports.remove = asyncHandler(async (req, res) => {
  const item = await findOwnedItem(req, 'delete');
  await item.deleteOne();
  res.json({ message: 'Deleted' });
});
