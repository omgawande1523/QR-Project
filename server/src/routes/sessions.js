const express = require('express');
const { z } = require('zod');
const sessions = require('../controllers/sessionController');
const { verifyToken } = require('../middleware/auth');
const validate = require('../middleware/validate');
const { objectId } = require('../validators/common');
const Session = require('../models/Session');

const router = express.Router();

const schemas = {
  idParam: { params: z.object({ id: objectId }) },
  push: {
    body: z.object({
      // FCM registration tokens are ~150-200 characters
      token: z.string().trim().min(20).max(4096).optional(),
      platform: z.enum(['android', 'ios']).optional(),
      prefs: z.object(Object.fromEntries(Session.PUSH_TYPES.map((t) => [t, z.boolean().optional()]))).strict().optional()
    }).refine((b) => !b.token || b.platform, { message: 'platform is required with a token', path: ['platform'] })
  }
};

// Every route acts on the signed-in login's own devices.
router.use(verifyToken);

router.get('/', sessions.list);
router.post('/sign-out-everywhere', sessions.signOutEverywhere);
router.post('/refresh', sessions.refresh);
router.delete('/current', sessions.removeCurrent);
router.put('/current/push', validate(schemas.push), sessions.setPush);
router.delete('/current/push', sessions.removePush);
router.delete('/:id', validate(schemas.idParam), sessions.remove);

module.exports = router;
