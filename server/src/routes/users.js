const express = require('express');
const users = require('../controllers/userController');
const account = require('../controllers/accountController');
const { verifyToken, requireRole, OWNER, MANAGERS, EVERYONE } = require('../middleware/auth');
const { authLimiter, scanLimiter } = require('../middleware/rateLimit');
const validate = require('../middleware/validate');
const schemas = require('../validators/users');

const router = express.Router();

router.post('/register', authLimiter, validate(schemas.register), users.register);
router.post('/login', authLimiter, validate(schemas.login), users.login);
router.post('/forgot-password', authLimiter, validate(schemas.forgotPassword), users.forgotPassword);
router.post('/reset-password', authLimiter, validate(schemas.resetPassword), users.resetPassword);

// Public routes (no token) must come before the generic /:id routes
router.get('/:id/public', validate(schemas.restaurantParam), users.getPublicProfile);
router.post('/:id/scan/:tableNumber', scanLimiter, validate(schemas.scan), users.recordScan);

router.get('/me', verifyToken, users.me);
// Deletes the signed-in account (owner: the whole restaurant); asks for the password again.
router.post('/delete-account', authLimiter, verifyToken, requireRole(...EVERYONE), validate(schemas.deleteAccount), account.deleteAccount);
router.get('/:id', verifyToken, requireRole(...EVERYONE), validate(schemas.restaurantParam), users.getProfile);
router.put('/:id', verifyToken, requireRole(...MANAGERS), validate(schemas.updateProfile), users.updateProfile);
router.post('/:id/change-password', verifyToken, requireRole(...OWNER), validate(schemas.changePassword), users.changePassword);

module.exports = router;
