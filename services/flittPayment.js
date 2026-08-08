// Flitt (ყოფილი Fondy) გადახდის API ინტეგრაცია.
// Flitt (formerly Fondy) payment API integration.
// დოკუმენტაცია / Docs: https://docs.flitt.com/api/introduction/

const crypto = require('crypto');

const FLITT_BASE_URL = process.env.FLITT_BASE_URL || 'https://pay.flitt.com';
const FLITT_MERCHANT_ID = process.env.FLITT_MERCHANT_ID;
const FLITT_SECRET_KEY = process.env.FLITT_SECRET_KEY;

function assertConfigured() {
  if (!FLITT_MERCHANT_ID || !FLITT_SECRET_KEY) {
    throw new Error(
      'Flitt არ არის კონფიგურირებული. შეავსეთ FLITT_MERCHANT_ID და FLITT_SECRET_KEY .env ფაილში. / ' +
      'Flitt is not configured. Fill in FLITT_MERCHANT_ID and FLITT_SECRET_KEY in your .env file.'
    );
  }
}

// ხელმოწერის აგება: პარამეტრები ალფაბეტურად, ცარიელების გამოკლებით,
// გასაღების დამატებით და SHA1-ით.
// Builds the signature: params sorted alphabetically, empty values dropped,
// secret key prepended, hashed with SHA1.
function buildSignature(secretKey, params) {
  const keys = Object.keys(params)
    .filter((key) => key !== 'signature' && params[key] !== undefined && params[key] !== null && params[key] !== '')
    .sort();

  const parts = [secretKey, ...keys.map((key) => String(params[key]))];
  return crypto.createHash('sha1').update(parts.join('|')).digest('hex');
}

// ამოწმებს callback-ის ხელმოწერას. / Verifies a callback's signature.
function verifySignature(secretKey, params) {
  if (!params.signature) return false;
  return buildSignature(secretKey, params) === params.signature;
}

// ქმნის checkout ბმულს. / Creates a checkout link.
async function createCheckout({ orderId, amountMinorUnits, currency, orderDesc, responseUrl, serverCallbackUrl }) {
  assertConfigured();

  const params = {
    order_id: orderId,
    merchant_id: Number(FLITT_MERCHANT_ID),
    order_desc: orderDesc,
    amount: amountMinorUnits,
    currency,
    response_url: responseUrl,
    server_callback_url: serverCallbackUrl
  };

  const signature = buildSignature(FLITT_SECRET_KEY, params);

  const response = await fetch(`${FLITT_BASE_URL}/api/checkout/url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request: { ...params, signature } })
  });

  const data = await response.json().catch(() => ({}));
  const result = data.response || {};

  if (!response.ok || result.response_status !== 'success') {
    throw new Error(`Flitt checkout შეცდომა: ${result.error_message || result.response_status || response.status}`);
  }

  return result; // { checkout_url, payment_id, ... }
}

// შეამოწმებს შეკვეთის სტატუსს. / Checks an order's status.
async function getOrderStatus(orderId) {
  assertConfigured();

  const params = {
    order_id: orderId,
    version: '1.0.1',
    merchant_id: String(FLITT_MERCHANT_ID)
  };

  const signature = buildSignature(FLITT_SECRET_KEY, params);

  const response = await fetch(`${FLITT_BASE_URL}/api/status/order_id`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request: { ...params, signature } })
  });

  const data = await response.json().catch(() => ({}));
  const result = data.response || {};

  if (!response.ok || result.response_status !== 'success') {
    throw new Error(`Flitt status შეცდომა: ${result.error_message || result.response_status || response.status}`);
  }

  return result; // order_status: approved / declined / expired / processing / reversed ...
}

module.exports = { buildSignature, verifySignature, createCheckout, getOrderStatus };