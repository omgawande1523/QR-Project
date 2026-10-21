const express = require('express');
const orders = require('../controllers/orderController');
const { verifyToken, requireRole, EVERYONE } = require('../middleware/auth');
const { orderLimiter } = require('../middleware/rateLimit');
const validate = require('../middleware/validate');
const schemas = require('../validators/orders');

const router = express.Router();

router.post('/', orderLimiter, validate(schemas.create), orders.create);
router.get('/', verifyToken, requireRole(...EVERYONE), validate(schemas.listForOwner), orders.listForOwner);
router.get('/status/:id', validate(schemas.getStatus), orders.getStatus);
// Kitchen staff are further limited to New / Preparing / Ready in the controller.
router.put('/:id', verifyToken, requireRole(...EVERYONE), validate(schemas.updateStatus), orders.updateStatus);

module.exports = router;
