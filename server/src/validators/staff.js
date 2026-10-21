const { z, objectId, email, password } = require('./common');
const Staff = require('../models/Staff');

const role = z.enum(Staff.ROLES, { errorMap: () => ({ message: 'Role must be manager, waiter or kitchen' }) });
const name = z.string().trim().min(1, 'Enter a name').max(60, 'Name must be at most 60 characters');

exports.create = {
  body: z.object({ name, email, role, password })
};

exports.update = {
  params: z.object({ id: objectId }),
  body: z.object({ name: name.optional(), role: role.optional(), active: z.boolean().optional() })
    .refine((b) => Object.keys(b).length > 0, 'Nothing to change')
};

exports.resetPassword = {
  params: z.object({ id: objectId }),
  body: z.object({ password })
};

exports.idParam = {
  params: z.object({ id: objectId })
};

exports.changeOwnPassword = {
  body: z.object({ currentPassword: z.string().min(1, 'Current password is required').max(128), newPassword: password })
};
