// routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const { generateReport, getReports } = require('../controllers/reportController');
const { protect, requireAdmin } = require('../middleware/authMiddleware');

// Protected admin routes
router.post('/generate', protect, requireAdmin, generateReport);
router.get('/', protect, requireAdmin, getReports);

module.exports = router;