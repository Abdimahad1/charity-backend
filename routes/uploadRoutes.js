const path = require('path');
const fs = require('fs').promises;
const express = require('express');
const multer = require('multer');
const sharp = require('sharp');

const router = express.Router();

/* ---------- Folders ---------- */
const uploadsRoot = process.env.UPLOAD_ROOT || path.join(__dirname, '..', 'uploads');
const imagesDir = path.join(uploadsRoot, 'images');
const cvDir = path.join(uploadsRoot, 'cv');

// Create directories if they don't exist
[uploadsRoot, imagesDir, cvDir].forEach(async (dir) => {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (err) {
    console.error(`Failed to create directory ${dir}:`, err);
  }
});

/* ---------- Multer Config ---------- */
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

// Add more extensions if needed
const IMAGE_EXTS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.jfif', '.svg',
  '.bmp', '.tiff', '.tif', '.ico', '.heif', '.heic', '.raw', '.cr2',
  '.nef', '.orf', '.sr2', '.psd', '.ai', '.eps'
]);
const DOC_MIMES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  if (file.fieldname === 'cv') {
    if (!DOC_MIMES.has(mime)) {
      return cb(new Error('Only PDF, DOC, DOCX allowed for CV'));
    }
    return cb(null, true);
  }

  const isImageMime = mime.startsWith('image/');
  const isAllowedExt = IMAGE_EXTS.has(ext) || (ext === '' && isImageMime);
  if (!isImageMime || !isAllowedExt) {
    return cb(new Error('Only image files allowed (jpg, jpeg, png, gif, webp, avif, jfif)'));
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

/* ---------- Image Processing ---------- */
// Cache for variant generation to avoid processing the same image multiple times
const processingCache = new Map();

async function createImageVariants(filePath, filename) {
  // Validate inputs
  if (!filePath || !filename) {
    throw new Error('Invalid file path or filename');
  }

  const extLower = path.extname(filename).toLowerCase();   // e.g. .jpg / .gif / .webp
  const baseName = filename.replace(extLower, '');         // filename without extension

  // Check if we're already processing this file
  const cacheKey = `${filePath}-${filename}`;
  if (processingCache.has(cacheKey)) {
    return processingCache.get(cacheKey);
  }

  // IMPORTANT: if GIF, keep original GIF as "original";
  // otherwise, "original" is the .webp we create (or the existing .webp file).
  const variants = {
    original: extLower === '.gif'
      ? path.join(imagesDir, filename)                    // keep the GIF as-is
      : path.join(imagesDir, `${baseName}.webp`),         // convert other types to .webp (or pass through if already .webp)
    hd: path.join(imagesDir, `hd_${baseName}.webp`),
    medium: path.join(imagesDir, `medium_${baseName}.webp`),
    thumb: path.join(imagesDir, `thumb_${baseName}.webp`),
  };

  processingCache.set(cacheKey, new Promise((resolve, reject) => {
    processImageVariants(filePath, variants, baseName, extLower)
      .then(result => resolve(result))
      .catch(err => reject(err))
      .finally(() => processingCache.delete(cacheKey));
  }));

  return processingCache.get(cacheKey);
}

async function processImageVariants(filePath, variants, baseName, extLower) {
  try {
    // Validate the image
    const metadata = await sharp(filePath).metadata();
    if (!metadata || !metadata.width || !metadata.height) {
      throw new Error('Invalid image file');
    }

    // Create variants in parallel
    await Promise.all([
      // HD (1920)
      sharp(filePath)
        .resize({ width: 1920, withoutEnlargement: true, fit: 'inside' })
        .webp({ quality: 70, alphaQuality: 70, effort: 4, lossless: false })
        .toFile(variants.hd),

      // Medium (960)
      sharp(filePath)
        .resize({ width: 960, withoutEnlargement: true, fit: 'inside' })
        .webp({ quality: 65, alphaQuality: 65, effort: 4 })
        .toFile(variants.medium),

      // Thumb (480x320 cover)
      sharp(filePath)
        .resize({ width: 480, height: 320, withoutEnlargement: true, fit: 'cover', position: 'center' })
        .webp({ quality: 60, alphaQuality: 60, effort: 4 })
        .toFile(variants.thumb),

      // Convert "original" for non-webp, non-gif types only
      (extLower !== '.webp' && extLower !== '.gif')
        ? sharp(filePath)
            .webp({ quality: 75, alphaQuality: 75, effort: 4 })
            .toFile(variants.original)
        : Promise.resolve()
    ]);

    // Clean up the original file if we converted (i.e., for non-webp and non-gif)
    if (extLower !== '.webp' && extLower !== '.gif') {
      await fs.unlink(filePath).catch(err => {
        console.warn('Could not delete original file:', err);
      });
    }

    return {
      hd: `hd_${baseName}.webp`,
      medium: `medium_${baseName}.webp`,
      thumb: `thumb_${baseName}.webp`,
      // If GIF, "original" is the original GIF filename; else it's baseName.webp
      original: extLower === '.gif' ? path.basename(filePath) : `${baseName}.webp`,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: metadata.size
      }
    };

  } catch (err) {
    console.error('Error processing image:', err);

    // Clean up any partially created files (ignore the uploaded original)
    await Promise.allSettled(
      Object.values(variants)
        .filter(v => v !== filePath)
        .map(v => fs.unlink(v).catch(() => {}))
    );

    throw new Error(`Failed to process image: ${err.message}`);
  }
}

// Lazy variant generation - only generate when requested
async function ensureVariantExists(variantPath, originalPath, options) {
  try {
    await fs.access(variantPath);
    return variantPath; // Variant already exists
  } catch {
    await sharp(originalPath)
      .resize(options.resize)
      .webp(options.webp)
      .toFile(variantPath);
    return variantPath;
  }
}

/* ---------- Helpers ---------- */
const makeUrl = (req, subpath) => {
  // Use CDN in production if configured
  if (process.env.NODE_ENV === 'production' && process.env.CDN_URL) {
    return `${process.env.CDN_URL}/uploads/${subpath.replace(/^\/+/, '')}`;
  }

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
 * GET /api/upload/variant/:filename - Get specific image variant
 * Example: /api/upload/variant/abc.webp?width=960
 */
router.get('/variant/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const { width } = req.query;

    const filePath = path.join(imagesDir, filename);

    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ message: 'File not found' });
    }

    // If specific width requested, generate on-the-fly
    if (width && !isNaN(parseInt(width))) {
      const widthInt = parseInt(width);
      const variantFilename = `w${widthInt}_${filename}`;
      const variantPath = path.join(imagesDir, variantFilename);

      await ensureVariantExists(variantPath, filePath, {
        resize: { width: widthInt, withoutEnlargement: true, fit: 'inside' },
        webp: { quality: 70, effort: 4 }
      });

      res.set('Cache-Control', 'public, max-age=31536000, immutable');
      res.set('Access-Control-Allow-Origin', '*');
      return res.sendFile(variantPath);
    }

    // Serve original file (as stored)
    res.set('Cache-Control', 'public, max-age=31536000, immutable');
    res.set('Access-Control-Allow-Origin', '*');
    return res.sendFile(filePath);
  } catch (err) {
    console.error('Error serving variant:', err);
    return res.status(500).json({ message: 'Error serving image' });
  }
});

/**
 * POST /api/upload           (default image)
 * field: file
 */
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    // Process image variants if it's an image (not for CV)
    let variants = {};
    if (req.file.fieldname !== 'cv') {
      variants = await createImageVariants(
        path.join(imagesDir, req.file.filename),
        req.file.filename
      );
    }

    const rel = makeRelative(`images/${variants.original || req.file.filename}`);
    const url = makeUrl(req, `images/${variants.original || req.file.filename}`);

    return res.status(201).json({
      url,
      path: rel,
      filename: variants.original || req.file.filename,
      kind: 'image',
      variants: variants.original ? {
        hd: makeUrl(req, `images/${variants.hd}`),
        medium: makeUrl(req, `images/${variants.medium}`),
        thumb: makeUrl(req, `images/${variants.thumb}`),
      } : undefined
    });
  } catch (err) {
    console.error('Error processing file:', err);
    return res.status(500).json({ message: 'Error processing file' });
  }
});

/**
 * POST /api/upload/image     (explicit image)
 * field: file
 */
router.post('/image', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const variants = await createImageVariants(
      path.join(imagesDir, req.file.filename),
      req.file.filename
    );

    const rel = makeRelative(`images/${variants.original}`);
    const url = makeUrl(req, `images/${variants.original}`);

    return res.status(201).json({
      url,
      path: rel,
      filename: variants.original,
      kind: 'image',
      variants: {
        hd: makeUrl(req, `images/${variants.hd}`),
        medium: makeUrl(req, `images/${variants.medium}`),
        thumb: makeUrl(req, `images/${variants.thumb}`),
      }
    });
  } catch (err) {
    console.error('Error processing image:', err);
    return res.status(500).json({ message: 'Error processing image' });
  }
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
    // Map codes and send 413 for size limit so UI can say "image is too large"
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        message: 'File too large (max 10MB)',
        code: 'LIMIT_FILE_SIZE'
      });
    }
    const map = {
      LIMIT_FILE_COUNT: 'Too many files',
      LIMIT_UNEXPECTED_FILE: 'Unexpected field',
    };
    return res.status(400).json({
      message: map[err.code] || err.message,
      code: err.code
    });
  }
  if (err) {
    return res.status(400).json({
      message: err.message || 'Upload error',
      code: err.code || 'UPLOAD_ERROR',
      details: err.stack
    });
  }
  res.status(500).json({ message: 'Unknown upload error' });
});

module.exports = router;
