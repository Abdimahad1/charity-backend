// controllers/paymentsController.js
const Payment = require('../models/Payment');
const { formatPhone252 } = require('../utils/phone');
const { payByWaafiPay } = require('../services/waafipay');     // ⬅️ updated import
const { payByEDahab } = require('../services/edahab');          // must return { payload, raw, mapped } too

/** POST /api/payments/mobile/initiate */
exports.initiate = async (req, res, next) => {
  try {
    const { method = 'EVC', amount, currency = 'USD', name, phone, email, note } = req.body;

    // Basic validation
    if (!amount || !phone) {
      return res.status(400).json({ message: 'amount and phone are required' });
    }
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ message: 'amount must be a positive number' });
    }

    // Create reference/invoice
    const reference = `app-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
    const invoiceId = reference;

    // Persist initial record
    const payment = await Payment.create({
      method,
      amount: amt,
      currency,
      name,
      phone,
      phoneFormatted: formatPhone252(phone),
      email,
      note,
      reference,
      invoiceId,
      status: 'pending'
    });

    // Call provider
    let result;
    if (method === 'EVC') {
      result = await payByWaafiPay({
        phone,
        amount: amt,
        invoiceId,
        description: note || `Donation ${reference}`,
        currency
      });
    } else if (method === 'EDAHAB') {
      // Your edahab service should mirror waafipay: return { payload, raw, mapped }
      result = await payByEDahab({
        phone,
        amount: amt,
        invoiceId,
        description: note || `Donation ${reference}`,
        currency
      });
    } else {
      return res.status(400).json({ message: 'Unsupported method' });
    }

    // Save provider data + mapped status/message
    if (result?.payload) payment.providerRequest = result.payload;
    if (result?.raw)     payment.providerResponse = result.raw;

    const mapped = result?.mapped || { status: 'failed', message: 'Unknown provider response' };
    payment.providerReference = mapped.providerRef || payment.providerReference || null;
    payment.status = mapped.status || payment.status;

    await payment.save();

    return res
      .status(mapped.status === 'failed' ? 400 : 200)
      .json({
        id: payment._id,
        reference: payment.reference,
        status: payment.status,
        message: mapped.message || undefined
      });

  } catch (err) {
    // If the service threw a structured error, forward the mapped message
    const message = err?.mapped?.message || err.message || 'Payment failed';
    console.error('❌ initiate error:', err?.provider || message);
    return res.status(500).json({ message });
  }
};

/** GET /api/payments/status/:id  (id or reference) */
exports.getStatus = async (req, res, next) => {
  try {
    const idOrRef = decodeURIComponent(req.params.id);
    const payment =
      (await Payment.findOne({ reference: idOrRef })) ||
      (await Payment.findById(idOrRef));

    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    return res.json({
      id: payment._id,
      reference: payment.reference,
      status: payment.status
    });
  } catch (err) {
    next(err);
  }
};

/** POST /api/payments/webhook  (provider → us) */
exports.webhook = async (req, res, next) => {
  try {
    // Optional: verify shared secret
    const sig = req.headers['x-webhook-signature'];
    if (process.env.WEBHOOK_SECRET && sig !== process.env.WEBHOOK_SECRET) {
      return res.status(401).json({ message: 'Invalid signature' });
    }

    const payload = req.body || {};
    // Try to identify which payment this belongs to:
    const ref =
      payload?.transactionInfo?.invoiceId ||
      payload?.invoiceId ||
      payload?.reference ||
      payload?.referenceId;

    if (!ref) {
      return res.status(400).json({ message: 'Missing reference' });
    }

    const payment =
      (await Payment.findOne({ reference: ref })) ||
      (await Payment.findOne({ invoiceId: ref }));

    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    // Simple mapping (you can switch to a shared mapper if you standardize webhook payloads)
    const upper = JSON.stringify(payload).toUpperCase();
    let mapped = 'pending';
    if (upper.includes('SUCCESS') || upper.includes('APPROVED') || upper.includes('"CODE":0')) mapped = 'success';
    else if (upper.includes('FAILED') || upper.includes('DECLINED') || upper.includes('CANCELLED')) mapped = 'failed';

    payment.status = mapped;
    payment.providerWebhook = payload;
    await payment.save();

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};
