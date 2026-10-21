const express = require('express');
const menu = require('../controllers/menuController');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', menu.listAll);
router.get('/:userId', menu.listByRestaurant);
router.post('/', verifyToken, menu.create);
router.put('/:id', verifyToken, menu.update);
router.delete('/:id', verifyToken, menu.remove);

module.exports = router;
