const { z, objectId } = require('./common');

const ORDER_STATUSES = ['pending', 'process', 'ready', 'billed', 'complete', 'cancelled'];

exports.ORDER_STATUSES = ORDER_STATUSES;

exports.getStatus = {
  params: z.object({ id: objectId }),
  query: z.object({ token: z.string().trim().min(1, 'Tracking token is required').max(128) })
};

exports.updateStatus = {
  params: z.object({ id: objectId }),
  body: z.object({
    status: z.enum(ORDER_STATUSES, { errorMap: () => ({ message: 'Invalid status' }) })
  })
};
