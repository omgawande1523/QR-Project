const { z, objectId, tableNumber } = require('./common');
const ServiceRequest = require('../models/ServiceRequest');

exports.create = {
  body: z.object({
    restaurantId: objectId,
    tableNumber,
    type: z.enum(ServiceRequest.TYPES, { errorMap: () => ({ message: 'Unknown request type' }) }),
    customerName: z.string().trim().max(60).optional()
  })
};

exports.handle = {
  params: z.object({ id: objectId })
};
