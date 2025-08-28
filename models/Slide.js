const mongoose = require('mongoose');

/** Ensure we always keep a relative /uploads/... path in DB */
function toUploadsPath(v) {
  if (!v) return v;
  const s = String(v);

  // If it's already a /uploads/... path, keep it
  const m = s.match(/\/uploads\/[^\s"'?]+/);
  if (m) return m[0];

  // Strip origin if a full URL got sent accidentally
  const noOrigin = s.replace(/^https?:\/\/[^/]+/i, '').replace(/^\/+/, '');

  // Accept "uploads/..." or "images/..." or bare filename → normalize
  if (noOrigin.startsWith('uploads/')) return `/${noOrigin}`;
  if (noOrigin.startsWith('images/')) return `/uploads/${noOrigin}`;
  return `/uploads/images/${noOrigin}`;
}

const SlideSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, trim: true },
    alt: { type: String, default: 'Homepage slide' },
    // Store RELATIVE path (e.g., /uploads/images/hero.webp), never an absolute URL
    src: {
      type: String,
      required: true,
      set: toUploadsPath,
      validate: {
        validator: (v) => typeof v === 'string' && /^\/uploads\//.test(v),
        message: 'src must be a relative /uploads/... path'
      }
    },
    align: { type: String, enum: ['left', 'center', 'right'], default: 'left' },
    overlay: { type: Number, min: 0, max: 100, default: 40 },
    published: { type: Boolean, default: true },
    position: { type: Number, default: () => Date.now() }, // newest first
  },
  { timestamps: true }
);

// Helpful indexes
SlideSchema.index({ published: 1 });
SlideSchema.index({ position: -1, createdAt: -1 });

module.exports = mongoose.model('Slide', SlideSchema);
