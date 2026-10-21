const { z, objectId, email, password, phoneNumber, tableNumber, tables, hexColor, imageRef } = require('./common');

const restaurantName = z.string().trim()
  .min(1, 'Restaurant name is required')
  .max(100, 'Restaurant name must be at most 100 characters');

exports.register = {
  body: z.object({
    email,
    password,
    phoneNumber: phoneNumber.optional().or(z.literal('').transform(() => undefined)),
    restaurantName,
    tables: tables.optional()
  })
};

exports.login = {
  body: z.object({
    identifier: z.string().trim().min(1, 'Email or phone number is required').max(254),
    password: z.string().min(1, 'Password is required').max(128)
  })
};

exports.forgotPassword = {
  body: z.object({ email })
};

exports.resetPassword = {
  body: z.object({
    email,
    token: z.string().trim().min(1, 'Reset code is required').max(64),
    newPassword: password
  })
};

exports.restaurantParam = {
  params: z.object({ id: objectId })
};

exports.scan = {
  params: z.object({ id: objectId, tableNumber })
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
// 15-character Indian GST number, e.g. 27ABCDE1234F1Z5
const GSTIN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const openingHours = z.array(z.object({
  day: z.number().int().min(0).max(6),
  open: z.string().regex(TIME, 'Use 24-hour HH:MM times'),
  close: z.string().regex(TIME, 'Use 24-hour HH:MM times'),
  closed: z.boolean().default(false)
})).max(7).refine((days) => new Set(days.map((d) => d.day)).size === days.length, 'Each day can appear only once');

const categoryName = z.string().trim().min(1, 'Category name is required').max(50, 'Category name must be at most 50 characters');
const categories = z.array(categoryName).max(50, 'At most 50 categories')
  .refine((list) => new Set(list.map((c) => c.toLowerCase())).size === list.length, 'Category names must be unique');

exports.categoryName = categoryName;

exports.updateProfile = {
  params: z.object({ id: objectId }),
  body: z.object({
    restaurantName: restaurantName.optional(),
    tagline: z.string().trim().max(120, 'Tagline must be at most 120 characters').optional(),
    address: z.string().trim().max(200, 'Address must be at most 200 characters').optional(),
    gstin: z.string().trim().toUpperCase()
      .refine((v) => v === '' || GSTIN.test(v), 'GSTIN must be 15 characters, e.g. 27ABCDE1234F1Z5').optional(),
    upiId: z.string().trim().toLowerCase().max(60)
      .refine((v) => v === '' || /^[a-z0-9._-]{2,49}@[a-z][a-z0-9.-]{1,30}$/.test(v), 'UPI ID looks like name@bank').optional(),
    openingHours: openingHours.optional(),
    categories: categories.optional(),
    tables: tables.optional(),
    profilePicture: imageRef.optional(),
    bannerImage: imageRef.optional(),
    qrColor: hexColor.optional(),
    qrLogo: imageRef.optional(),
    taxPercent: z.coerce.number().min(0).max(28, 'GST cannot exceed 28%').optional(),
    serviceChargePercent: z.coerce.number().min(0).max(20, 'Service charge cannot exceed 20%').optional(),
    acceptingOrders: z.boolean().optional()
  })
};

exports.changePassword = {
  params: z.object({ id: objectId }),
  body: z.object({
    currentPassword: z.string().min(1, 'Current password is required').max(128),
    newPassword: password
  })
};
