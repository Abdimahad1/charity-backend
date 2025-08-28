const mongoose = require('mongoose');
const { normalizeImage } = require('../utils/normalizeImage');

const SlideSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, trim: true },
    alt: { type: String, default: 'Homepage slide', trim: true },
    // Allow data:, http(s), or /uploads/...
    src: {
      type: String,
      required: true,
      set: v => normalizeImage(v),
      validate: {
        validator: v =>
          typeof v === 'string' &&
          ( /^data:/i.test(v) || /^\/uploads\//.test(v) || /^https?:\/\//i.test(v) ),
        message: 'src must be data:, http(s), or a /uploads/... path'
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
