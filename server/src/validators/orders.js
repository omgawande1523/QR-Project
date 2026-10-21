const { z, objectId, tableNumber, phoneNumber } = require('./common');

// Board order: New (pending) -> Preparing (process) -> Ready -> Served -> Billed -> closed (complete).
const ORDER_STATUSES = ['pending', 'process', 'ready', 'served', 'billed', 'complete', 'cancelled'];
const MAX_QUANTITY = 50;

exports.ORDER_STATUSES = ORDER_STATUSES;

// Only ids, quantities and notes are accepted; prices and totals are always computed by the server.
const orderLine = z.object({
  menuItem: objectId,
  quantity: z.number({ invalid_type_error: 'Quantity must be a number' })
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be at least 1')
    .max(MAX_QUANTITY, `Quantity cannot exceed ${MAX_QUANTITY}`),
  variantId: objectId.optional(),
  addOnIds: z.array(objectId).max(20).optional(),
  notes: z.string().trim().max(200, 'Notes must be at most 200 characters').optional()
});

exports.create = {
  body: z.object({
    restaurantId: objectId,
    tableNumber,
    customerName: z.string().trim().max(60, 'Name must be at most 60 characters').optional(),
    customerPhone: phoneNumber.optional().or(z.literal('').transform(() => undefined)),
    items: z.array(orderLine).min(1, 'Your cart is empty').max(50, 'Too many different items in one order')
  })
};

exports.listForOwner = {
  query: z.object({
    from: z.coerce.date({ invalid_type_error: 'from must be a date' }).optional(),
    to: z.coerce.date({ invalid_type_error: 'to must be a date' }).optional(),
    status: z.enum(ORDER_STATUSES).optional(),
    limit: z.coerce.number().int().min(1).max(1000).default(500)
  })
};

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
