// routes/uploadRoutes.js
const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');

const router = express.Router();

/* ---------- Folders (local + Render) ---------- */
const uploadsRoot =
  process.env.UPLOAD_ROOT ||
  path.join(__dirname, '..', 'uploads'); // server.js serves /uploads from this root

const imagesDir = path.join(uploadsRoot, 'images');
const cvDir = path.join(uploadsRoot, 'cv');

[uploadsRoot, imagesDir, cvDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

/* ---------- Multer config ---------- */
const storage = multer.diskStorage({
  destination: (_req, file, cb) => {
    if (file.fieldname === 'cv') return cb(null, cvDir);
    return cb(null, imagesDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext);
    const safeBase = base.replace(/\s+/g, '-').replace(/[^a-z0-9._-]/gi, '').toLowerCase();
    cb(null, `${Date.now()}-${safeBase}${ext}`);
  },
});

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
  const isDoc = ['.pdf', '.doc', '.docx'].includes(ext);

  if (file.fieldname === 'cv') {
    if (!isDoc) return cb(new Error('Only PDF, DOC, DOCX allowed for CV'));
  } else {
    if (!isImage) return cb(new Error('Only image files allowed'));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

/* ---------- Helpers ---------- */
const makeUrl = (req, subpath) => {
  // trust proxy is enabled in server.js, but be extra robust here
  const proto = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('x-forwarded-host') || req.get('host');
  const clean = subpath.replace(/^\/+/, '');
  return `${proto}://${host}/uploads/${clean}`;
};

const makeRelative = (subpath) => `/uploads/${subpath.replace(/^\/+/, '')}`;

/* ---------- Routes ---------- */

// quick probe
router.get('/ping', (_req, res) => res.json({ ok: true }));

/**
 * POST /api/upload           (default image)
 * field: file
 */
router.post('/', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const rel = makeRelative(`images/${req.file.filename}`);
  const url = makeUrl(req, `images/${req.file.filename}`);
  return res.status(201).json({ url, path: rel, filename: req.file.filename, kind: 'image' });
});

/**
 * POST /api/upload/image     (explicit image)
 * field: file
 */
router.post('/image', upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const rel = makeRelative(`images/${req.file.filename}`);
  const url = makeUrl(req, `images/${req.file.filename}`);
  return res.status(201).json({ url, path: rel, filename: req.file.filename, kind: 'image' });
});

/**
 * POST /api/upload/cv        (explicit CV)
 * field: cv
 */
router.post('/cv', upload.single('cv'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No CV uploaded' });
  const rel = makeRelative(`cv/${req.file.filename}`);
  const url = makeUrl(req, `cv/${req.file.filename}`);
  return res.status(201).json({ url, path: rel, filename: req.file.filename, kind: 'cv' });
});

/* ---------- Multer error handler (nice messages) ---------- */
router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    const map = {
      LIMIT_FILE_SIZE: 'File too large',
      LIMIT_FILE_COUNT: 'Too many files',
      LIMIT_UNEXPECTED_FILE: 'Unexpected field',
    };
    return res.status(400).json({ message: map[err.code] || err.message });
  }
  if (err) return res.status(400).json({ message: err.message || 'Upload error' });
  res.status(500).json({ message: 'Unknown upload error' });
});

module.exports = router;
