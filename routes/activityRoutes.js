const express = require('express');
const router = express.Router();
const { getAdminActivity } = require('../controllers/activityController');
const { protect, requireAdmin } = require('../middleware/authMiddleware');

// Protected admin routes
router.get('/admin', protect, requireAdmin, getAdminActivity);

module.exports = router;