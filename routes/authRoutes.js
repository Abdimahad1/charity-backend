const express = require('express');
const router = express.Router();
const { adminLogin, me, changePassword } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Public routes
router.post('/admin-login', adminLogin);

// Protected routes
router.get('/me', protect, me);
router.post('/change-password', protect, changePassword);

module.exports = router;