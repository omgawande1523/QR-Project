const express = require('express');
const staff = require('../controllers/staffController');
const { verifyToken, requireRole, OWNER, EVERYONE } = require('../middleware/auth');
const validate = require('../middleware/validate');
const schemas = require('../validators/staff');

const router = express.Router();

router.use(verifyToken);

// Any staff member: change their own password.
router.post('/me/password', requireRole(...EVERYONE), validate(schemas.changeOwnPassword), staff.changeOwnPassword);

// Owner only: manage the team.
router.get('/', requireRole(...OWNER), staff.list);
router.post('/', requireRole(...OWNER), validate(schemas.create), staff.create);
router.patch('/:id', requireRole(...OWNER), validate(schemas.update), staff.update);
router.post('/:id/password', requireRole(...OWNER), validate(schemas.resetPassword), staff.resetPassword);
router.delete('/:id', requireRole(...OWNER), validate(schemas.idParam), staff.remove);

module.exports = router;
