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
  console.log('Upload attempt:', { originalname: file.originalname, ext, mime }); // Add this

  if (file.fieldname === 'cv') {
    if (!DOC_MIMES.has(mime)) {
      console.log('Rejected CV: invalid MIME type', mime); // Add this
      return cb(new Error('Only PDF, DOC, DOCX allowed for CV'));
    }
    return cb(null, true);
  }

  const isImageMime = mime.startsWith('image/');
  const isAllowedExt = IMAGE_EXTS.has(ext) || (ext === '' && isImageMime);
  if (!isImageMime || !isAllowedExt) {
    console.log('Rejected image:', { isImageMime, isAllowedExt }); // Add this
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
async function createImageVariants(filePath, filename) {
  // Validate inputs
  if (!filePath || !filename) {
    throw new Error('Invalid file path or filename');
  }

  // Create variant paths with WebP extension
  const baseName = filename.replace(path.extname(filename), '');
  const variants = {
    original: path.join(imagesDir, `${baseName}.webp`),
    hd: path.join(imagesDir, `hd_${baseName}.webp`),
    medium: path.join(imagesDir, `medium_${baseName}.webp`),
    thumb: path.join(imagesDir, `thumb_${baseName}.webp`),
  };

  try {
    // First validate the image
    const metadata = await sharp(filePath).metadata();
    if (!metadata || !metadata.width || !metadata.height) {
      throw new Error('Invalid image file');
    }

    // Create variants in parallel for better performance
    await Promise.all([
      // HD variant (1920px width)
      sharp(filePath)
        .resize({ 
          width: 1920, 
          withoutEnlargement: true,
          fit: 'inside'
        })
        .webp({ 
          quality: 80,
          alphaQuality: 80,
          lossless: false
        })
        .toFile(variants.hd),

      // Medium variant (960px width)
      sharp(filePath)
        .resize({
          width: 960,
          withoutEnlargement: true,
          fit: 'inside'
        })
        .webp({
          quality: 75,
          alphaQuality: 75
        })
        .toFile(variants.medium),

      // Thumbnail variant (480px width)
      sharp(filePath)
        .resize({
          width: 480,
          height: 320,
          withoutEnlargement: true,
          fit: 'cover',
          position: 'center'
        })
        .webp({
          quality: 70,
          alphaQuality: 70
        })
        .toFile(variants.thumb),

      // Convert original to WebP (if not already WebP or GIF)
      !['.webp', '.gif'].includes(path.extname(filePath).toLowerCase())
        ? sharp(filePath)
            .webp({
              quality: 85,
              alphaQuality: 85
            })
            .toFile(variants.original)
        : Promise.resolve()
    ]);

    // Clean up the original file if we converted it to WebP
    if (!['.webp', '.gif'].includes(path.extname(filePath).toLowerCase())) {
      await fs.unlink(filePath).catch(err => {
        console.warn('Could not delete original file:', err);
      });
    }

    return {
      hd: `hd_${baseName}.webp`,
      medium: `medium_${baseName}.webp`,
      thumb: `thumb_${baseName}.webp`,
      original: `${baseName}.webp`,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format,
        size: metadata.size
      }
    };

  } catch (err) {
    console.error('Error processing image:', err);
    
    // Clean up any partially created files
    await Promise.allSettled(
      Object.values(variants)
        .filter(v => v !== filePath) // Don't delete the original input file
        .map(v => fs.unlink(v).catch(() => {}))
    );

    throw new Error(`Failed to process image: ${err.message}`);
  }
}

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
    const map = {
      LIMIT_FILE_SIZE: 'File too large (max 10MB)',
      LIMIT_FILE_COUNT: 'Too many files',
      LIMIT_UNEXPECTED_FILE: 'Unexpected field',
    };
    return res.status(400).json({ 
      message: map[err.code] || err.message,
      code: err.code 
    });
  }
  if (err) return res.status(400).json({ 
    message: err.message || 'Upload error',
    details: err.stack 
  });
  res.status(500).json({ message: 'Unknown upload error' });
});

module.exports = router;