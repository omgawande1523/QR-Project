const express = require('express');
const serviceRequests = require('../controllers/serviceRequestController');

const router = express.Router();

router.get('/:restaurantId', serviceRequests.listPending);
router.delete('/:id', serviceRequests.remove);

module.exports = router;
