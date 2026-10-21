const { z } = require('zod');

const objectId = z.string().trim().regex(/^[a-f\d]{24}$/i, 'Invalid id');

const email = z.string().trim().toLowerCase().max(254).email('Please enter a valid email address');

const password = z.string()
  .min(8, 'Password must be at least 8 characters long')
  .max(128, 'Password must be at most 128 characters long');

// Indian and international numbers: optional +, 10-15 digits; spaces and dashes are ignored.
const phoneNumber = z.string().trim()
  .transform((value) => value.replace(/[\s-]/g, ''))
  .refine((value) => /^\+?\d{10,15}$/.test(value), 'Please enter a valid phone number');

const tableNumber = z.coerce.number({ invalid_type_error: 'Table number must be a number' })
  .int('Table number must be a whole number')
  .min(1, 'Table number must be at least 1')
  .max(9999, 'Table number is too large');

const tables = z.array(tableNumber).max(500, 'Too many tables')
  .transform((list) => [...new Set(list)].sort((a, b) => a - b));

const hexColor = z.string().trim().regex(/^#[0-9a-f]{6}$/i, 'Colour must be a hex value like #4d5a1f');

// Image references: an uploaded file URL or a pasted http(s) URL. Empty string clears the image.
const imageRef = z.string().trim().max(10_000_000);

const idParam = z.object({ id: objectId });

module.exports = { z, objectId, email, password, phoneNumber, tableNumber, tables, hexColor, imageRef, idParam };
