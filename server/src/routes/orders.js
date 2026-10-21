const express = require('express');
const orders = require('../controllers/orderController');
const { verifyToken, requireRole, EVERYONE, FLOOR } = require('../middleware/auth');
const { orderLimiter, feedbackLimiter } = require('../middleware/rateLimit');
const validate = require('../middleware/validate');
const schemas = require('../validators/orders');

const router = express.Router();

router.post('/', orderLimiter, validate(schemas.create), orders.create);
router.get('/', verifyToken, requireRole(...EVERYONE), validate(schemas.listForOwner), orders.listForOwner);
router.get('/status/:id', validate(schemas.getStatus), orders.getStatus);
router.post('/:id/feedback', feedbackLimiter, validate(schemas.feedback), orders.feedback);
// Kitchen staff are further limited to New / Preparing / Ready in the controller.
router.put('/:id', verifyToken, requireRole(...EVERYONE), validate(schemas.updateStatus), orders.updateStatus);
// Billing is for the floor team (not the kitchen).
router.post('/:id/invoice', verifyToken, requireRole(...FLOOR), validate(schemas.invoice), orders.invoice);
router.post('/:id/pay', verifyToken, requireRole(...FLOOR), validate(schemas.pay), orders.pay);

module.exports = router;
