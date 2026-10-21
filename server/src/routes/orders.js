const express = require('express');
const orders = require('../controllers/orderController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.post('/', orders.create);
router.get('/', verifyToken, orders.listForOwner);
router.get('/status/:id', orders.getStatus);
router.put('/:id', verifyToken, orders.updateStatus);

module.exports = router;
