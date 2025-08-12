const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    date: { type: Date, default: Date.now },
    location: { type: String, trim: true },
    coverImage: { type: String, trim: true }, // full URL or /uploads/...
    tags: [{ type: String, trim: true }],
    featured: { type: Boolean, default: false },
    published: { type: Boolean, default: true },
    position: { type: Number, default: 0 },
    slug: { type: String, trim: true, unique: false }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Event', eventSchema);
