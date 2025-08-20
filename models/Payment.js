const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  method: { type: String, enum: ['EVC', 'EDAHAB'], required: true },
  currency: { type: String, default: 'USD' },
  amount: { type: Number, required: true },
  fee: { type: Number, default: 0 },
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Charity', index: true },

  name: String,
  phone: String,
  phoneFormatted: String,
  email: String,
  note: String,

  reference: { type: String, index: true },
  invoiceId: String,
  providerReference: String,

  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending',
    index: true
  },

  providerRequest: mongoose.Schema.Types.Mixed,
  providerResponse: mongoose.Schema.Types.Mixed,
  providerWebhook: mongoose.Schema.Types.Mixed
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual populate to get charity details
PaymentSchema.virtual('charity', {
  ref: 'Charity',
  localField: 'projectId',
  foreignField: '_id',
  justOne: true
});

module.exports = mongoose.model('Payment', PaymentSchema);