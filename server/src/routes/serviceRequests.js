const express = require('express');
const serviceRequests = require('../controllers/serviceRequestController');
const validate = require('../middleware/validate');
const schemas = require('../validators/serviceRequests');

const router = express.Router();

router.get('/:restaurantId', validate(schemas.listPending), serviceRequests.listPending);
router.delete('/:id', validate(schemas.remove), serviceRequests.remove);

module.exports = router;
