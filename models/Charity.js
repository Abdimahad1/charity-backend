const mongoose = require('mongoose');

const CharitySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    excerpt: { type: String, default: '', trim: true },
    category: { type: String, default: 'Education' },
    location: { type: String, default: '' },
    goal: { type: Number, required: true, min: 0 },
    raised: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['Draft', 'Published'], default: 'Draft' },
    cover: { type: String, default: '' },
    donationLink: { type: String, default: '' },
    featured: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Add index for better performance
CharitySchema.index({ status: 1 });
CharitySchema.index({ category: 1 });
CharitySchema.index({ featured: 1 });

module.exports = mongoose.model('Charity', CharitySchema);