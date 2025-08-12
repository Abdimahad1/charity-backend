const mongoose = require('mongoose');

const SlideSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  subtitle: { type: String, trim: true },
  alt: { type: String, default: 'Homepage slide' },
  src: { type: String, required: true },                   // uploaded image URL
  align: { type: String, enum: ['left','center','right'], default: 'left' },
  overlay: { type: Number, min: 0, max: 100, default: 40 },
  published: { type: Boolean, default: true },
  position: { type: Number, default: () => Date.now() },   // for ordering
}, { timestamps: true });

module.exports = mongoose.model('Slide', SlideSchema);
