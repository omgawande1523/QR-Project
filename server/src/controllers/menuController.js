const MenuItem = require('../models/MenuItem');

exports.listAll = async (req, res) => {
  try {
    const menuItems = await MenuItem.find();
    res.json(menuItems);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.listByRestaurant = async (req, res) => {
  try {
    const menuItems = await MenuItem.find({ owner: req.params.userId });
    res.json(menuItems);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.create = async (req, res) => {
  try {
    const { name, description, price, category, image } = req.body;
    const item = new MenuItem({
      name,
      description,
      price,
      category,
      image,
      owner: req.user.userId
    });
    const saved = await item.save();
    res.json(saved);
  } catch (err) {
    console.error('Create menu error:', err);
    res.status(500).json({ message: 'Failed to create menu item' });
  }
};

exports.update = async (req, res) => {
  try {
    const { name, description, price, category, image, available } = req.body;
    const updateData = { name, description, price, category, image, available };

    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    if (item.owner?.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to update this item' });
    }

    // Remove undefined fields
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    const updated = await MenuItem.findByIdAndUpdate(req.params.id, updateData, { new: true });
    res.json(updated);
  } catch (err) {
    console.error('Update menu error:', err);
    res.status(500).json({ message: 'Failed to update item' });
  }
};

exports.remove = async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.status(404).json({ message: 'Item not found' });
    if (item.owner?.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Not authorized to delete this item' });
    }

    await MenuItem.findByIdAndDelete(req.params.id);
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Delete menu error:', err);
    res.status(500).json({ message: 'Failed to delete item' });
  }
};
