const express = require('express');
const serviceRequests = require('../controllers/serviceRequestController');
const { verifyToken } = require('../middleware/auth');
const { serviceRequestLimiter } = require('../middleware/rateLimit');
const validate = require('../middleware/validate');
const schemas = require('../validators/serviceRequests');

const router = express.Router();

router.post('/', serviceRequestLimiter, validate(schemas.create), serviceRequests.create);
router.get('/', verifyToken, serviceRequests.listPending);
router.delete('/:id', verifyToken, validate(schemas.handle), serviceRequests.markHandled);

module.exports = router;
