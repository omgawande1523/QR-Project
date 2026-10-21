const express = require('express');
const health = require('../controllers/healthController');

const router = express.Router();

router.get('/', health.root);
router.get('/health', health.health);
router.get('/api', health.apiInfo);

router.use('/api/users', require('./users'));
router.use('/api/menu', require('./menu'));
router.use('/api/orders', require('./orders'));
router.use('/api/service-requests', require('./serviceRequests'));
router.use('/api/uploads', require('./uploads'));
router.use('/api/public', require('./public'));
router.use('/api/staff', require('./staff'));

module.exports = router;
