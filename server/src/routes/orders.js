const express = require('express');
const orders = require('../controllers/orderController');
const { verifyToken } = require('../middleware/auth');
const { publicWriteLimiter } = require('../middleware/rateLimit');
const validate = require('../middleware/validate');
const schemas = require('../validators/orders');

const router = express.Router();

router.post('/', publicWriteLimiter, validate(schemas.create), orders.create);
router.get('/', verifyToken, orders.listForOwner);
router.get('/status/:id', validate(schemas.getStatus), orders.getStatus);
router.put('/:id', verifyToken, validate(schemas.updateStatus), orders.updateStatus);

module.exports = router;
