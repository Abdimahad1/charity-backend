const express = require('express');
const router = express.Router();
const { 
  applyVolunteer, 
  getVolunteers, 
  updateVolunteerStatus,
  sendCustomEmail 
} = require('../controllers/volunteerController');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure CV folder exists
const cvDir = path.join(__dirname, '../uploads/cv');
if (!fs.existsSync(cvDir)) {
  fs.mkdirSync(cvDir, { recursive: true });
}

// CV upload storage
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, cvDir);
  },
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, '-').toLowerCase();
    cb(null, Date.now() + '-' + safeName);
  }
});

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // limit 5MB

// === Routes ===
router.post('/apply', upload.single('cv'), applyVolunteer);
router.get('/', getVolunteers);
router.patch('/:id/status', updateVolunteerStatus);
router.post('/send-email', sendCustomEmail); // Add custom email endpoint

module.exports = router;