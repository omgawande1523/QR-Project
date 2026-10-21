const express = require('express');
const users = require('../controllers/userController');
const { verifyToken } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const validate = require('../middleware/validate');
const schemas = require('../validators/users');

const router = express.Router();

router.post('/register', authLimiter, validate(schemas.register), users.register);
router.post('/login', authLimiter, validate(schemas.login), users.login);
router.post('/forgot-password', authLimiter, validate(schemas.forgotPassword), users.forgotPassword);
router.post('/reset-password', authLimiter, validate(schemas.resetPassword), users.resetPassword);

// Public routes (no token) must come before the generic /:id routes
router.get('/:id/public', validate(schemas.restaurantParam), users.getPublicProfile);
router.post('/:id/scan/:tableNumber', validate(schemas.scan), users.recordScan);

router.get('/:id', verifyToken, validate(schemas.restaurantParam), users.getProfile);
router.put('/:id', verifyToken, validate(schemas.updateProfile), users.updateProfile);
router.post('/:id/change-password', verifyToken, validate(schemas.changePassword), users.changePassword);

module.exports = router;
