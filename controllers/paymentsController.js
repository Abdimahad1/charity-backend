const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const Charity = require('../models/Charity');
const { formatPhone252 } = require('../utils/phone');
const { payByWaafiPay } = require('../services/waafipay');
const { payByEDahab } = require('../services/edahab');

/** Update charity raised amount with transaction safety */
/** Update charity raised amount (non-transactional but safe) */
const updateCharityRaisedAmount = async (payment) => {
  try {
    console.log('🔄 Attempting to update charity for payment:', {
      paymentId: payment._id,
      projectId: payment.projectId,
      amount: payment.amount,
      status: payment.status
    });
    
    if (!payment.projectId) {
      console.log('ℹ️ Payment has no project ID, skipping charity update');
      return null;
    }
    
    // Convert projectId to ObjectId if needed
    let projectId = payment.projectId;
    if (typeof projectId === 'string' && mongoose.Types.ObjectId.isValid(projectId)) {
      projectId = new mongoose.Types.ObjectId(projectId);
    } else if (typeof projectId !== 'object' || !(projectId instanceof mongoose.Types.ObjectId)) {
      throw new Error(`Invalid projectId format: ${projectId}`);
    }
    
    // Verify charity exists and get current raised amount
    const charity = await Charity.findById(projectId);
    if (!charity) {
      throw new Error(`Charity not found with ID: ${projectId}`);
    }
    
    console.log(`📋 Found charity: "${charity.title}" - Current raised: ${charity.raised}`);
    
    // Update charity raised amount
    const updatedCharity = await Charity.findByIdAndUpdate(
      projectId,
      { $inc: { raised: payment.amount } },
      { new: true, runValidators: true }
    );
    
    console.log(`✅ Success: Updated charity "${updatedCharity.title}" raised amount by ${payment.amount}. New total: ${updatedCharity.raised}`);
    return updatedCharity;
    
  } catch (error) {
    console.error('❌ Failed to update charity raised amount:', error.message);
    throw error;
  }
};

/** POST /api/payments/mobile/initiate */
exports.initiate = async (req, res, next) => {
  try {
    const { method = 'EVC', amount, currency = 'USD', name, phone, email, note, projectId } = req.body;

    // Basic validation
    if (!amount || !phone) {
      return res.status(400).json({ message: 'amount and phone are required' });
    }
    
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ message: 'amount must be a positive number' });
    }

    // Validate projectId if provided
    if (projectId && !mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: 'Invalid project ID format' });
    }

    // Create reference/invoice
    const reference = `app-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
    const invoiceId = reference;

    // Persist initial record with projectId
    const payment = await Payment.create({
      method,
      amount: amt,
      currency,
      name,
      phone,
      phoneFormatted: formatPhone252(phone),
      email,
      note,
      projectId: projectId ? new mongoose.Types.ObjectId(projectId) : null,
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
    if (result?.raw) payment.providerResponse = result.raw;

    const mapped = result?.mapped || { status: 'failed', message: 'Unknown provider response' };
    payment.providerReference = mapped.providerRef || payment.providerReference || null;
    payment.status = mapped.status || payment.status;

    await payment.save();

    // If payment is successful immediately, update charity
    if (payment.status === 'success' && payment.projectId) {
      try {
        await updateCharityRaisedAmount(payment);
      } catch (updateError) {
        console.error('❌ Failed to update charity raised amount:', updateError.message);
        // Don't fail the payment, just log the error
      }
    }

    return res.status(mapped.status === 'failed' ? 400 : 200).json({
      id: payment._id,
      reference: payment.reference,
      status: payment.status,
      message: mapped.message || undefined
    });

  } catch (err) {
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

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    const upper = JSON.stringify(payload).toUpperCase();
    let mapped = 'pending';
    if (upper.includes('SUCCESS') || upper.includes('APPROVED') || upper.includes('"CODE":0')) mapped = 'success';
    else if (upper.includes('FAILED') || upper.includes('DECLINED') || upper.includes('CANCELLED')) mapped = 'failed';

    const oldStatus = payment.status;
    payment.status = mapped;
    payment.providerWebhook = payload;
    await payment.save();

    // Update charity raised amount if status changed to success
    if (oldStatus !== 'success' && mapped === 'success' && payment.projectId) {
      try {
        await updateCharityRaisedAmount(payment);
      } catch (updateError) {
        console.error('❌ Failed to update charity raised amount from webhook:', updateError.message);
      }
    }

    return res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

/** GET /api/payments/admin - Admin payment listing */
exports.adminGetPayments = async (req, res, next) => {
  try {
    const { 
      status, 
      method, 
      currency, 
      q,
      page = 1,
      limit = 50
    } = req.query;

    const query = {};
    
    if (status && status !== 'all') query.status = status;
    if (method && method !== 'all') query.method = method;
    if (currency && currency !== 'all') query.currency = currency;
    
    if (q) {
      query.$or = [
        { name: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
        { reference: { $regex: q, $options: 'i' } },
        { projectId: { $regex: q, $options: 'i' } }
      ];
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Get total count
    const total = await Payment.countDocuments(query);
    
    // Get paginated results with charity details
    const items = await Payment.find(query)
      .populate('charity', 'title category location')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    res.json({
      items,
      total,
      totalPages: Math.ceil(total / limitNum),
      page: pageNum,
      limit: limitNum
    });
  } catch (err) {
    console.error('Error fetching payments:', err);
    res.status(500).json({ message: 'Failed to fetch payments', error: err.message });
  }
};

/** GET /api/payments/stats - Payment statistics */
exports.getPaymentStats = async (req, res, next) => {
  try {
    const { period = 'month' } = req.query;
    
    const now = new Date();
    let startDate;
    
    switch (period) {
      case 'day':
        startDate = new Date(now.setDate(now.getDate() - 1));
        break;
      case 'week':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'month':
        startDate = new Date(now.setMonth(now.getMonth() - 1));
        break;
      case 'year':
        startDate = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
      default:
        startDate = new Date(now.setMonth(now.getMonth() - 1));
    }
    
    const successful = await Payment.aggregate([
      {
        $match: {
          status: 'success',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: null,
          totalAmount: { $sum: '$amount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amount' }
        }
      }
    ]);
    
    const byMethod = await Payment.aggregate([
      {
        $match: {
          status: 'success',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$method',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    const byCurrency = await Payment.aggregate([
      {
        $match: {
          status: 'success',
          createdAt: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: '$currency',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);
    
    res.json({
      period,
      startDate,
      endDate: new Date(),
      totalAmount: successful[0]?.totalAmount || 0,
      count: successful[0]?.count || 0,
      avgAmount: successful[0]?.avgAmount || 0,
      byMethod,
      byCurrency
    });
  } catch (err) {
    console.error('Error fetching payment stats:', err);
    res.status(500).json({ message: 'Failed to fetch payment statistics' });
  }
};

/** GET /api/payments/test - Test endpoint */
exports.testDB = async (req, res) => {
  try {
    const count = await Payment.countDocuments();
    const sample = await Payment.findOne().populate('charity', 'title raised');
    
    res.json({
      connected: true,
      totalPayments: count,
      samplePayment: sample
    });
  } catch (err) {
    res.status(500).json({
      connected: false,
      error: err.message
    });
  }
};

/** Manual update endpoint for testing */
exports.manualUpdateCharity = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const payment = await Payment.findById(paymentId);
    
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    
    if (payment.status !== 'success') {
      return res.status(400).json({ message: 'Payment is not successful' });
    }
    
    if (!payment.projectId) {
      return res.status(400).json({ message: 'Payment has no project ID' });
    }
    
    const result = await updateCharityRaisedAmount(payment);
    
    if (result) {
      res.json({ 
        message: 'Charity updated successfully',
        paymentId: payment._id,
        charityId: result._id,
        charityTitle: result.title,
        amountAdded: payment.amount,
        newTotal: result.raised
      });
    } else {
      res.status(404).json({ message: 'Charity not found or update failed' });
    }
  } catch (error) {
    console.error('Error in manual update:', error);
    res.status(500).json({ message: 'Failed to update charity', error: error.message });
  }
};

/** DEBUG: Check payment and charity status */
exports.debugPayment = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const payment = await Payment.findById(paymentId);
    
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    
    let charity = null;
    if (payment.projectId) {
      charity = await Charity.findById(payment.projectId);
    }
    
    res.json({
      payment: {
        _id: payment._id,
        status: payment.status,
        amount: payment.amount,
        projectId: payment.projectId,
        projectIdType: typeof payment.projectId,
        projectIdValid: mongoose.Types.ObjectId.isValid(payment.projectId)
      },
      charity: charity ? {
        _id: charity._id,
        title: charity.title,
        raised: charity.raised,
        goal: charity.goal
      } : null,
      shouldUpdate: payment.status === 'success' && payment.projectId !== null
    });
  } catch (error) {
    console.error('Error in debug:', error);
    res.status(500).json({ message: 'Debug failed', error: error.message });
  }
};

/** Fix specific payment charity update */
exports.fixCharityUpdate = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const payment = await Payment.findById(paymentId);
    
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    
    if (payment.status !== 'success') {
      return res.status(400).json({ message: 'Payment is not successful' });
    }
    
    if (!payment.projectId) {
      return res.status(400).json({ message: 'Payment has no project ID' });
    }
    
    const result = await updateCharityRaisedAmount(payment);
    
    if (result) {
      res.json({
        message: 'Charity updated successfully',
        paymentId: payment._id,
        charityId: result._id,
        charityTitle: result.title,
        amountAdded: payment.amount,
        newTotal: result.raised
      });
    } else {
      res.status(404).json({ message: 'Charity not found' });
    }
  } catch (error) {
    console.error('Error in fix:', error);
    res.status(500).json({ message: 'Fix failed', error: error.message });
  }
};

/** MANUAL: Update charity for existing successful payment */
exports.manualCharityUpdate = async (req, res) => {
  try {
    const { paymentId } = req.params;
    
    console.log(`🔄 Manual charity update requested for payment: ${paymentId}`);
    
    // Find the payment
    const payment = await Payment.findById(paymentId);
    
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found' });
    }
    
    // Check if payment is successful
    if (payment.status !== 'success') {
      return res.status(400).json({ 
        message: 'Payment is not successful. Status must be "success" to update charity.',
        currentStatus: payment.status
      });
    }
    
    // Check if payment has a project ID
    if (!payment.projectId) {
      return res.status(400).json({ 
        message: 'Payment has no project ID associated with it.' 
      });
    }
    
    // Update the charity
    const result = await updateCharityRaisedAmount(payment);
    
    if (result) {
      res.json({ 
        success: true,
        message: 'Charity updated successfully',
        payment: {
          id: payment._id,
          amount: payment.amount,
          status: payment.status
        },
        charity: {
          id: result._id,
          title: result.title,
          previousRaised: result.raised - payment.amount,
          newRaised: result.raised,
          goal: result.goal
        }
      });
    } else {
      res.status(404).json({ 
        success: false,
        message: 'Charity not found or update failed' 
      });
    }
  } catch (error) {
    console.error('❌ Error in manual charity update:', error);
    res.status(500).json({ 
      success: false,
      message: 'Failed to update charity', 
      error: error.message 
    });
  }
};