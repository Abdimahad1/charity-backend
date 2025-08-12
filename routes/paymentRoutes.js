const router = require('express').Router();
const ctrl = require('../controllers/paymentsController');

router.post('/mobile/initiate', ctrl.initiate);
router.get('/status/:id', ctrl.getStatus);
router.post('/webhook', ctrl.webhook);

module.exports = router;
