const { z, email, phoneNumber } = require('./common');

exports.contact = {
  body: z.object({
    name: z.string().trim().min(1, 'Please tell us your name').max(80),
    email,
    phone: phoneNumber.optional().or(z.literal('').transform(() => undefined)),
    restaurantName: z.string().trim().max(100).optional(),
    message: z.string().trim().min(5, 'Please write a short message').max(2000, 'Message is too long')
  })
};
