const { Schema, model } = require('mongoose');

const PaymentSchema = new Schema({
  method: { type: String, enum: ['EVC', 'EDAHAB'], required: true },
  currency: { type: String, default: 'USD' },
  amount: { type: Number, required: true },
  fee: { type: Number, default: 0 },

  name: String,
  phone: String,             // user input
  phoneFormatted: String,    // 252-prefixed stored
  email: String,
  note: String,

  // app reference used for polling (maps to invoice/reference)
  reference: { type: String, index: true }, // our own reference/id we return to FE
  invoiceId: String,                         // if you use invoice concept
  providerReference: String,                 // provider ref if different

  status: {
    type: String,
    enum: ['pending', 'success', 'failed'],
    default: 'pending',
    index: true
  },

  // raw provider payloads for debugging/audit
  providerRequest: Schema.Types.Mixed,
  providerResponse: Schema.Types.Mixed,
  providerWebhook: Schema.Types.Mixed
}, { timestamps: true });

module.exports = model('Payment', PaymentSchema);
