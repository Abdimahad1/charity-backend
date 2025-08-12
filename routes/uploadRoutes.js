const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');

const router = express.Router();

// Ensure upload subfolders exist
const uploadsDir = path.join(__dirname, '..', 'uploads');
const imagesDir = path.join(uploadsDir, 'images');
const cvDir = path.join(uploadsDir, 'cv');

[uploadsDir, imagesDir, cvDir].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Multer storage
const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    if (file.fieldname === 'cv') {
      cb(null, cvDir);
    } else {
      cb(null, imagesDir);
    }
  },
  filename: (_req, file, cb) => {
    const safe = file.originalname.replace(/\s+/g, '-').toLowerCase();
    cb(null, `${Date.now()}-${safe}`);
  },
});

// Multer file filter
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isImage = ['.jpg', '.jpeg', '.png', '.gif'].includes(ext);
  const isDoc = ['.pdf', '.doc', '.docx'].includes(ext);

  if (file.fieldname === 'cv' && !isDoc) {
    return cb(new Error('Only PDF, DOC, DOCX allowed for CV'), false);
  }
  if (file.fieldname !== 'cv' && !isImage) {
    return cb(new Error('Only image files allowed for images'), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

/**
 * POST /api/upload/image — field: file
 */
router.post('/image', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const url = `${req.protocol}://${req.get('host')}/uploads/images/${req.file.filename}`;
  res.status(201).json({ url });
});

/**
 * POST /api/upload/cv — field: cv
 */
router.post('/cv', upload.single('cv'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No CV uploaded' });
  const url = `${req.protocol}://${req.get('host')}/uploads/cv/${req.file.filename}`;
  res.status(201).json({ url });
});

module.exports = router;
