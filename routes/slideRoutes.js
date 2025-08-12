const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/slideController');

// Optional auth middleware
// const { protect, admin } = require('../middleware/authMiddleware');

router.get('/', ctrl.listSlides);
router.get('/:id', ctrl.getSlide);
router.post('/', /*protect, admin,*/ ctrl.createSlide);
router.put('/:id', /*protect, admin,*/ ctrl.updateSlide);
router.delete('/:id', /*protect, admin,*/ ctrl.deleteSlide);
router.patch('/:id/move', /*protect, admin,*/ ctrl.moveSlide);

module.exports = router;
