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

exports.updateProfile = {
  params: z.object({ id: objectId }),
  body: z.object({
    restaurantName,
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
