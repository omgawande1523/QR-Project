const express = require('express');
const analytics = require('../controllers/analyticsController');
const { verifyToken, requireRole, MANAGERS } = require('../middleware/auth');
const validate = require('../middleware/validate');
const schemas = require('../validators/analytics');

const router = express.Router();

// Sales figures are for the owner and managers.
router.get('/', verifyToken, requireRole(...MANAGERS), validate(schemas.sales), analytics.sales);

module.exports = router;
