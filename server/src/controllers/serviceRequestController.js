const ServiceRequest = require('../models/ServiceRequest');

exports.listPending = async (req, res) => {
  try {
    const requests = await ServiceRequest.find({
      restaurantId: req.params.restaurantId,
      status: 'pending'
    }).sort({ timestamp: -1 });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.remove = async (req, res) => {
  try {
    await ServiceRequest.findByIdAndDelete(req.params.id);
    res.json({ message: 'Request removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
