const express = require('express');
const publicApi = require('../controllers/publicController');
const { contactLimiter } = require('../middleware/rateLimit');
const validate = require('../middleware/validate');
const schemas = require('../validators/public');

const router = express.Router();

router.get('/demo', publicApi.getDemo);
router.post('/contact', contactLimiter, validate(schemas.contact), publicApi.contact);

module.exports = router;
