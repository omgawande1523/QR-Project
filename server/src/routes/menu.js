const express = require('express');
const menu = require('../controllers/menuController');
const { verifyToken } = require('../middleware/auth');
const validate = require('../middleware/validate');
const schemas = require('../validators/menu');

const router = express.Router();

router.get('/', menu.listAll);
router.get('/:userId', validate(schemas.listByRestaurant), menu.listByRestaurant);
router.post('/', verifyToken, validate(schemas.create), menu.create);
router.put('/:id', verifyToken, validate(schemas.update), menu.update);
router.delete('/:id', verifyToken, validate(schemas.remove), menu.remove);

module.exports = router;
