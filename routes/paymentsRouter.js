const router = require('express').Router();
const ctrl = require('../controllers/paymentsController');
const { protect, requireAdmin } = require('../middleware/authMiddleware');

// Public routes
router.post('/mobile/initiate', ctrl.initiate);
router.get('/status/:id', ctrl.getStatus);
router.post('/webhook', ctrl.webhook);

// Protected admin routes
router.get('/admin', protect, ctrl.adminGetPayments);
router.get('/stats', protect, ctrl.getPaymentStats);
router.get('/test', ctrl.testDB);
router.post('/manual-update/:paymentId', protect, ctrl.manualUpdateCharity);
router.get('/debug/:paymentId', protect, ctrl.debugPayment);
router.post('/fix/:paymentId', protect, ctrl.fixCharityUpdate);
router.post('/manual-charity-update/:paymentId', ctrl.manualCharityUpdate);


module.exports = router;