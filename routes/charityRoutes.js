const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/charityController');

// Public
router.get('/', ctrl.listCharitiesPublic);
router.get('/:id', ctrl.getCharity);

// Admin (plug auth when ready: protect, admin)
router.get('/admin/list', /*protect, admin,*/ ctrl.listCharitiesAdmin);
router.get('/admin/:id', /*protect, admin,*/ ctrl.getCharityAdmin);
router.post('/', /*protect, admin,*/ ctrl.createCharity);
router.put('/:id', /*protect, admin,*/ ctrl.updateCharity);
router.delete('/:id', /*protect, admin,*/ ctrl.deleteCharity);

module.exports = router;
