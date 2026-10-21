const { z, objectId } = require('./common');

const ORDER_STATUSES = ['pending', 'process', 'ready', 'billed', 'complete', 'cancelled'];

exports.ORDER_STATUSES = ORDER_STATUSES;

exports.getStatus = {
  params: z.object({ id: objectId })
};

exports.updateStatus = {
  params: z.object({ id: objectId }),
  body: z.object({
    status: z.enum(ORDER_STATUSES, { errorMap: () => ({ message: 'Invalid status' }) })
  })
};
