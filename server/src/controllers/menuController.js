const MenuItem = require('../models/MenuItem');
const User = require('../models/User');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const emit = require('../sockets/io');
const { discardImage } = require('../services/storage');

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

// Keeps the restaurant's ordered category list in step with the categories its items use.
async function rememberCategory(ownerId, category) {
  if (category) await User.updateOne({ _id: ownerId }, { $addToSet: { categories: category } });
}

exports.listByRestaurant = asyncHandler(async (req, res) => {
  res.json(await MenuItem.find({ owner: req.params.userId }));
});

exports.create = asyncHandler(async (req, res) => {
  const item = await MenuItem.create({ ...req.body, owner: req.user.userId });
  await rememberCategory(req.user.userId, item.category);
  broadcast(req.user.userId, 'menuUpdated', item);
  res.json(item);
});

exports.update = asyncHandler(async (req, res) => {
  const item = await findOwnedItem(req, 'update');
  const previousImage = item.image;
  item.set(req.body);
  await item.save();
  if (previousImage && previousImage !== item.image) await discardImage(previousImage);
  await rememberCategory(req.user.userId, item.category);
  broadcast(req.user.userId, 'menuUpdated', item);
  res.json(item);
});

// Renames a category everywhere: the ordered list and every item that uses it.
exports.renameCategory = asyncHandler(async (req, res) => {
  const { from, to } = req.body;
  const owner = await User.findById(req.user.userId).select('categories');
  const clash = owner.categories.some((c) => c.toLowerCase() === to.toLowerCase() && c !== from);
  if (clash) throw AppError.conflict('A category with that name already exists', 'CATEGORY_EXISTS');

  owner.categories = owner.categories.map((c) => (c === from ? to : c));
  if (!owner.categories.includes(to)) owner.categories.push(to);
  await owner.save();

  const filter = { owner: req.user.userId, category: from };
  const ids = (await MenuItem.find(filter).select('_id')).map((i) => i._id);
  await MenuItem.updateMany(filter, { $set: { category: to } });
  const items = await MenuItem.find({ _id: { $in: ids } });
  items.forEach((item) => broadcast(req.user.userId, 'menuUpdated', item));
  res.json({ categories: owner.categories, updated: items.length });
});

// Bulk "mark sold out" / "mark available"; only the owner's own items are touched.
exports.setAvailability = asyncHandler(async (req, res) => {
  const { ids, available } = req.body;
  const filter = { _id: { $in: ids }, owner: req.user.userId };
  await MenuItem.updateMany(filter, { $set: { available } });
  const items = await MenuItem.find(filter);
  items.forEach((item) => broadcast(req.user.userId, 'menuUpdated', item));
  res.json({ updated: items.length, items });
});

exports.remove = asyncHandler(async (req, res) => {
  const item = await findOwnedItem(req, 'delete');
  await item.deleteOne();
  await discardImage(item.image);
  broadcast(req.user.userId, 'menuItemDeleted', { _id: item._id });
  res.json({ message: 'Deleted' });
});
