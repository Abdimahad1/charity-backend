const express = require('express');
const router = express.Router();
const { adminLogin, me } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/admin-login', adminLogin);
router.get('/me', protect, me);

module.exports = router;
