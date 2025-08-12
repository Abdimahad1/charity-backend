// models/Volunteer.js
const mongoose = require('mongoose');

const volunteerSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  city: String,
  district: String,
  availability: String,
  role: String,
  skills: String,
  message: String,
  interests: [String],
  cvFile: String, // store filename/path
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending"
  }
}, { timestamps: true });

module.exports = mongoose.model('Volunteer', volunteerSchema);
