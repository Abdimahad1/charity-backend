const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/charityController');

// Public
router.get('/', ctrl.listCharitiesPublic);
router.get('/:id', ctrl.getCharity);

// Admin
router.get('/admin/list', ctrl.listCharitiesAdmin);
router.get('/admin/:id', ctrl.getCharityAdmin);
router.post('/', ctrl.createCharity);
router.put('/:id', ctrl.updateCharity);
router.delete('/:id', ctrl.deleteCharity);

module.exports = router;