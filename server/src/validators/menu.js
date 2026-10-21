const { z, objectId, imageRef } = require('./common');

const price = z.coerce.number({ invalid_type_error: 'Price must be a number' })
  .min(0, 'Price cannot be negative')
  .max(100000, 'Price is too large');

const itemFields = {
  name: z.string().trim().min(1, 'Item name is required').max(100, 'Item name must be at most 100 characters'),
  description: z.string().trim().max(500, 'Description must be at most 500 characters').optional(),
  price,
  category: z.string().trim().max(50, 'Category must be at most 50 characters').optional(),
  image: imageRef.optional(),
  available: z.boolean().optional()
};

exports.listByRestaurant = {
  params: z.object({ userId: objectId })
};

exports.create = {
  body: z.object(itemFields)
};

exports.update = {
  params: z.object({ id: objectId }),
  body: z.object(itemFields).partial()
};

exports.remove = {
  params: z.object({ id: objectId })
};
