const express = require('express');
const multer = require('multer');
const sharp = require('sharp');

const router = express.Router();

/* ---------- Multer: keep files in memory ---------- */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (_req, file, cb) => {
    // Allow images on / and /image; allow docs on /cv
    const isImage = /^image\//i.test(file.mimetype);
    const isDoc = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ].includes(file.mimetype);

    // Let the specific route decide; here just block obviously wrong things.
    if (!isImage && !isDoc) {
      return cb(new Error('Only image files (jpg/png/webp/gif/avif) or CV documents (pdf/doc/docx) are allowed'));
    }
    cb(null, true);
  }
});

/* ---------- Helpers ---------- */
const toDataUrl = (mime, buf) => `data:${mime};base64,${buf.toString('base64')}`;

async function buildImageSetFromBuffer(inputBuffer, mimetype) {
  const isGif = /gif$/i.test(mimetype);

  if (isGif) {
    // Keep the GIF as-is; skip variants to preserve animation
    return {
      original: { mime: 'image/gif', buffer: inputBuffer },
      variants: null,
    };
  }

  // Convert to WEBP once, then derive sizes from that to keep quality predictable
  const originalWebp = await sharp(inputBuffer).webp({ quality: 75, effort: 4 }).toBuffer();

  const hd = await sharp(originalWebp)
    .resize({ width: 1920, withoutEnlargement: true, fit: 'inside' })
    .toBuffer();

  const medium = await sharp(originalWebp)
    .resize({ width: 960, withoutEnlargement: true, fit: 'inside' })
    .toBuffer();

  const thumb = await sharp(originalWebp)
    .resize({ width: 480, height: 320, fit: 'cover', position: 'center' })
    .toBuffer();

  return {
    original: { mime: 'image/webp', buffer: originalWebp },
    variants: {
      hd: { mime: 'image/webp', buffer: hd },
      medium: { mime: 'image/webp', buffer: medium },
      thumb: { mime: 'image/webp', buffer: thumb },
    },
  };
}

/* ---------- Routes ---------- */

// quick probe
router.get('/ping', (_req, res) => res.json({ ok: true }));

/**
 * OLD: GET /api/upload/variant/:filename
 * We no longer serve from disk; return 410 so the UI knows this path is gone.
 */
router.get('/variant/:filename', (_req, res) => {
  return res.status(410).json({
    message: 'On-the-fly variants by filename are disabled. Images are embedded as data URLs now.'
  });
});

/**
 * POST /api/upload           (default image)
 * field: file
 */
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    if (!/^image\//i.test(req.file.mimetype)) {
      return res.status(400).json({ message: 'Only image files are allowed on this endpoint' });
    }

    const set = await buildImageSetFromBuffer(req.file.buffer, req.file.mimetype);

    const payload = {
      url: toDataUrl(set.original.mime, set.original.buffer),
      path: toDataUrl(set.original.mime, set.original.buffer), // keep same shape as before
      filename: `${Date.now()}-original.${set.original.mime.endsWith('gif') ? 'gif' : 'webp'}`,
      kind: 'image',
    };

    if (set.variants) {
      payload.variants = {
        hd: toDataUrl(set.variants.hd.mime, set.variants.hd.buffer),
        medium: toDataUrl(set.variants.medium.mime, set.variants.medium.buffer),
        thumb: toDataUrl(set.variants.thumb.mime, set.variants.thumb.buffer),
      };
    }

    return res.status(201).json(payload);
  } catch (err) {
    console.error('Error processing image:', err);
    return res.status(500).json({ message: 'Error processing image' });
  }
});

/**
 * POST /api/upload/image     (explicit image)
 * field: file
 * Same behavior as "/"
 */
router.post('/image', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    if (!/^image\//i.test(req.file.mimetype)) {
      return res.status(400).json({ message: 'Only image files are allowed on this endpoint' });
    }

    const set = await buildImageSetFromBuffer(req.file.buffer, req.file.mimetype);

    const payload = {
      url: toDataUrl(set.original.mime, set.original.buffer),
      path: toDataUrl(set.original.mime, set.original.buffer),
      filename: `${Date.now()}-original.${set.original.mime.endsWith('gif') ? 'gif' : 'webp'}`,
      kind: 'image',
    };

    if (set.variants) {
      payload.variants = {
        hd: toDataUrl(set.variants.hd.mime, set.variants.hd.buffer),
        medium: toDataUrl(set.variants.medium.mime, set.variants.medium.buffer),
        thumb: toDataUrl(set.variants.thumb.mime, set.variants.thumb.buffer),
      };
    }

    return res.status(201).json(payload);
  } catch (err) {
    console.error('Error processing image:', err);
    return res.status(500).json({ message: 'Error processing image' });
  }
});

/**
 * POST /api/upload/cv        (explicit CV)
 * field: cv
 * Returns a data: URL as well (be mindful of size).
 */
router.post('/cv', upload.single('cv'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No CV uploaded' });

    const ok = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ].includes(req.file.mimetype);

    if (!ok) {
      return res.status(400).json({ message: 'Only PDF, DOC, DOCX allowed for CV' });
    }

    // No processing; just encode
    const url = toDataUrl(req.file.mimetype, req.file.buffer);

    return res.status(201).json({
      url,
      path: url,
      filename: `${Date.now()}-${(req.file.originalname || 'cv').replace(/\s+/g, '-')}`,
      kind: 'cv'
    });
  } catch (err) {
    console.error('CV upload error:', err);
    return res.status(500).json({ message: 'Error uploading CV' });
  }
});

/* ---------- Multer error handler (nice messages) ---------- */
router.use((err, _req, res, _next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        message: 'File too large (max 10MB)',
        code: 'LIMIT_FILE_SIZE'
      });
    }
    return res.status(400).json({ message: err.message, code: err.code });
  }
  if (err) {
    return res.status(400).json({
      message: err.message || 'Upload error',
      code: err.code || 'UPLOAD_ERROR'
    });
  }
  res.status(500).json({ message: 'Unknown upload error' });
});

module.exports = router;
