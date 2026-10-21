const express = require('express');
const menu = require('../controllers/menuController');
const { verifyToken, requireRole, MANAGERS, EVERYONE } = require('../middleware/auth');
const validate = require('../middleware/validate');
const schemas = require('../validators/menu');

const router = express.Router();

router.get('/:userId', validate(schemas.listByRestaurant), menu.listByRestaurant);
router.post('/', verifyToken, requireRole(...MANAGERS), validate(schemas.create), menu.create);
router.post('/categories/rename', verifyToken, requireRole(...MANAGERS), validate(schemas.renameCategory), menu.renameCategory);
// Anyone on the team can mark a dish sold out (the kitchen usually knows first).
router.patch('/availability', verifyToken, requireRole(...EVERYONE), validate(schemas.setAvailability), menu.setAvailability);
router.put('/:id', verifyToken, requireRole(...MANAGERS), validate(schemas.update), menu.update);
router.delete('/:id', verifyToken, requireRole(...MANAGERS), validate(schemas.remove), menu.remove);

module.exports = router;
