// services/waafipay.js
const axios = require('axios');
const { formatPhone252 } = require('../utils/phone');

/* =================== ENV VALIDATION =================== */
const requiredEnv = ['PAYMENT_API_URL', 'MERCHANT_UID', 'API_USER_ID', 'API_KEY'];
for (const key of requiredEnv) {
  const val = process.env[key];
  if (!val || typeof val !== 'string' || !val.trim()) {
    throw new Error(`❌ Missing required environment variable: ${key}`);
  }
}

const WAAFI_URL = process.env.PAYMENT_API_URL.trim();
if (!/^https?:\/\/.+/i.test(WAAFI_URL)) {
  throw new Error(`❌ PAYMENT_API_URL is not a valid URL: ${WAAFI_URL}`);
}

/* =================== PAYLOAD BUILDER =================== */
const buildPayload = ({ phone, amount, invoiceId, description, currency = 'USD' }) => {
  const amt = Number.parseFloat(amount);
  if (!Number.isFinite(amt) || amt <= 0) throw new Error('Amount must be greater than 0');

  return {
    schemaVersion: '1.0',
    requestId: Date.now().toString(),
    timestamp: new Date().toISOString(),
    channelName: 'WEB',
    serviceName: 'API_PURCHASE',
    serviceParams: {
      merchantUid: process.env.MERCHANT_UID.trim(),
      apiUserId: process.env.API_USER_ID.trim(),
      apiKey: process.env.API_KEY.trim(),
      paymentMethod: 'MWALLET_ACCOUNT',
      payerInfo: { accountNo: formatPhone252(phone) },
      transactionInfo: {
        referenceId: `ref-${Date.now()}`,
        invoiceId,
        amount: Number(amt.toFixed(2)),
        currency,
        description
      }
    }
  };
};

/* =================== RESPONSE MAPPER =================== */
/**
 * Normalizes WaafiPay response into a uniform object we can rely on:
 *  - status: 'success' | 'pending' | 'failed'
 *  - providerRef: gateway reference id if present
 *  - message: a human-friendly provider message
 *  - extra codes for debugging (responseCode, statusCode, responseMsg, txStatus)
 */
const mapWaafi = (raw = {}) => {
  const resp = raw || {};
  const responseCode = String(resp.responseCode ?? resp.code ?? '').trim();
  const statusCode   = String(resp.statusCode ?? '').trim();
  const responseMsg  = String(resp.responseMsg ?? resp.responseMessage ?? '').trim().toUpperCase();
  const txStatus     = String(resp.transactionInfo?.status ?? '').trim().toUpperCase();
  const providerRef  = resp.transactionInfo?.referenceId || resp.referenceId || null;

  const isSuccess =
    responseCode === '0' ||
    statusCode === '2001' ||
    txStatus === 'SUCCESS' ||
    responseMsg === 'RCS_SUCCESS';

  const isPending =
    txStatus === 'PENDING' ||
    responseMsg.includes('PENDING') ||
    statusCode === '2000';

  const status = isSuccess ? 'success' : isPending ? 'pending' : 'failed';

  const message =
    resp.responseMessage ||
    resp.responseMsg ||
    resp.message ||
    (isSuccess ? 'SUCCESS' : isPending ? 'PENDING' : 'FAILED');

  return { status, providerRef, responseCode, statusCode, responseMsg, txStatus, message };
};

/* =================== MAIN CALL =================== */
const payByWaafiPay = async ({ phone, amount, invoiceId, description, currency = 'USD' }) => {
  const payload = buildPayload({ phone, amount, invoiceId, description, currency });

  // helpful debug (remove or lower in prod)
  console.log('📡 WaafiPay URL:', WAAFI_URL);
  console.log('📦 WaafiPay Payload:', JSON.stringify(payload, null, 2));

  try {
    const { data } = await axios.post(WAAFI_URL, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000
    });

    console.log('🔍 WaafiPay Response:', JSON.stringify(data, null, 2));

    const mapped = mapWaafi(data);
    return { payload, raw: data, mapped };
  } catch (err) {
    // surface provider error details clearly
    const providerErr = err.response?.data;
    console.error('❌ WaafiPay error:', providerErr || err.message);
    const mapped = providerErr ? mapWaafi(providerErr) : { status: 'failed', message: err.message };
    // Throw a structured error the controller can forward to the client
    const e = new Error(mapped.message || 'Payment request failed');
    e.mapped = mapped;
    e.provider = providerErr;
    throw e;
  }
};

module.exports = { payByWaafiPay, mapWaafi };
