const { z, objectId } = require('./common');

exports.listPending = {
  params: z.object({ restaurantId: objectId })
};

exports.remove = {
  params: z.object({ id: objectId })
};
