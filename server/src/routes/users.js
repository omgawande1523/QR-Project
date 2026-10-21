const express = require('express');
const users = require('../controllers/userController');
const { verifyToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');

const router = express.Router();

router.post('/register', authLimiter, users.register);
router.post('/login', authLimiter, users.login);
router.post('/forgot-password', authLimiter, users.forgotPassword);
router.post('/reset-password', authLimiter, users.resetPassword);

// Public routes (no token) must come before the generic /:id routes
router.get('/:id/public', users.getPublicProfile);
router.post('/:id/scan/:tableNumber', users.recordScan);

router.get('/:id', verifyToken, users.getProfile);
router.put('/:id', verifyToken, users.updateProfile);
router.post('/:id/change-password', verifyToken, users.changePassword);

module.exports = router;
