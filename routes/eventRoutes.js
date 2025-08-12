const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/eventController');

// Public list for homepage
router.get('/public', ctrl.getPublicEvents);

// Admin list/detail/CRUD
router.get('/', ctrl.listEvents);
router.get('/:id', ctrl.getEvent);
router.post('/', ctrl.createEvent);
router.put('/:id', ctrl.updateEvent);
router.delete('/:id', ctrl.deleteEvent);
router.patch('/:id/publish', ctrl.togglePublish);

module.exports = router;
