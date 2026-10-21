const { z, objectId, imageRef } = require('./common');
const MenuItem = require('../models/MenuItem');
const { categoryName } = require('./users');

const price = z.coerce.number({ invalid_type_error: 'Price must be a number' })
  .min(0, 'Price cannot be negative')
  .max(100000, 'Price is too large');

const option = z.object({
  _id: objectId.optional(), // keep the id when editing so carts that reference it stay valid
  name: z.string().trim().min(1, 'Option name is required').max(40, 'Option name must be at most 40 characters'),
  price
});

const uniqueNames = (list) => new Set(list.map((o) => o.name.toLowerCase())).size === list.length;

const itemFields = {
  name: z.string().trim().min(1, 'Item name is required').max(100, 'Item name must be at most 100 characters'),
  description: z.string().trim().max(500, 'Description must be at most 500 characters').optional(),
  price,
  category: z.string().trim().max(50, 'Category must be at most 50 characters').optional(),
  image: imageRef.optional(),
  available: z.boolean().optional(),
  isVeg: z.boolean().optional(),
  tags: z.array(z.enum(MenuItem.TAGS, { errorMap: () => ({ message: 'Unknown badge' }) }))
    .max(3).transform((list) => [...new Set(list)]).optional(),
  spiceLevel: z.coerce.number().int().min(0).max(3).optional(),
  calories: z.coerce.number().int().min(0).max(5000).nullable().optional(),
  variants: z.array(option).max(10, 'At most 10 sizes').refine(uniqueNames, 'Size names must be unique').optional(),
  addOns: z.array(option).max(20, 'At most 20 add-ons').refine(uniqueNames, 'Add-on names must be unique').optional()
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

exports.renameCategory = {
  body: z.object({ from: categoryName, to: categoryName })
};

exports.setAvailability = {
  body: z.object({
    ids: z.array(objectId).min(1, 'Choose at least one item').max(500),
    available: z.boolean({ required_error: 'available is required' })
  })
};

exports.remove = {
  params: z.object({ id: objectId })
};
