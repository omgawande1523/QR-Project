const ServiceRequest = require('../models/ServiceRequest');
const asyncHandler = require('../utils/asyncHandler');

exports.listPending = asyncHandler(async (req, res) => {
  const requests = await ServiceRequest.find({
    restaurantId: req.params.restaurantId,
    status: 'pending'
  }).sort({ timestamp: -1 });
  res.json(requests);
});

exports.remove = asyncHandler(async (req, res) => {
  await ServiceRequest.findByIdAndDelete(req.params.id);
  res.json({ message: 'Request removed' });
});
