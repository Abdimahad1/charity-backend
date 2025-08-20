// models/Report.js
const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: ['donations', 'volunteers', 'charities', 'finance', 'collections']
  },
  period: {
    type: String,
    required: true,
    enum: ['day', 'week', 'month', 'year', 'all']
  },
  startDate: Date,
  endDate: Date,
  filters: mongoose.Schema.Types.Mixed,
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  data: mongoose.Schema.Types.Mixed
}, {
  timestamps: true
});

module.exports = mongoose.model('Report', reportSchema);