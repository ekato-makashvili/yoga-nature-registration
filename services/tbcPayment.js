// TBC E-Commerce ("TPay") ინტეგრაცია.
// TBC E-Commerce ("TPay") integration.
//
// დოკუმენტაცია / Docs: https://developers.tbcbank.ge/docs/checkout-overview
//
// სამი ცალკეული endpoint გამოიყენება:
// Three endpoints are used:
//   1. POST /v1/tpay/access-token   - access token-ის მიღება
//   2. POST /v1/tpay/payments       - გადახდის შექმნა (აბრუნებს checkout ბმულს)
//   3. GET  /v1/tpay/payments/:id   - გადახდის სტატუსის შემოწმება

const TBC_BASE_URL = process.env.TBC_BASE_URL || 'https://api.tbcbank.ge';
const TBC_API_KEY = process.env.TBC_API_KEY;
const TBC_CLIENT_ID = process.env.TBC_CLIENT_ID;
const TBC_CLIENT_SECRET = process.env.TBC_CLIENT_SECRET;

let cachedToken = null;
let tokenExpiresAt = 0;

function assertConfigured() {
  if (!TBC_API_KEY || !TBC_CLIENT_ID || !TBC_CLIENT_SECRET) {
    throw new Error(
      'TBC E-Commerce არ არის კონფიგურირებული. შეავსეთ TBC_API_KEY, TBC_CLIENT_ID ' +
      'და TBC_CLIENT_SECRET .env ფაილში (იხ. .env.example). / ' +
      'TBC E-Commerce is not configured. Fill in TBC_API_KEY, TBC_CLIENT_ID and ' +
      'TBC_CLIENT_SECRET in your .env file (see .env.example).'
    );
  }
}

// იღებს access token-ს და ინახავს ქეშში მისი მოქმედების ვადამდე.
// Fetches an access token and caches it until it expires.
async function getAccessToken() {
  assertConfigured();

  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - 5000) {
    return cachedToken;
  }

  const body = new URLSearchParams();
  body.set('client_id', TBC_CLIENT_ID);
  body.set('client_secret', TBC_CLIENT_SECRET);

  const response = await fetch(`${TBC_BASE_URL}/v1/tpay/access-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      apikey: TBC_API_KEY
    },
    body
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `TBC access-token შეცდომა (${response.status}): ${data.detail || 'უცნობი შეცდომა'}`
    );
  }

  cachedToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in || 0) * 1000;
  return cachedToken;
}

// ქმნის გადახდას და აბრუნებს TBC-ის პასუხს (მათ შორის checkout ბმულს).
// Creates a payment and returns TBC's response (including the checkout link).
async function createPayment({ amount, description, returnurl, callbackUrl, merchantPaymentId, language }) {
  const token = await getAccessToken();

  const response = await fetch(`${TBC_BASE_URL}/v1/tpay/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: TBC_API_KEY,
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      amount: {
        currency: 'GEL',
        total: amount
      },
      returnurl,
      callbackUrl,
      merchantPaymentId,
      description,
      preAuth: false,
      language
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `TBC create-payment შეცდომა (${response.status}): ${data.detail || 'უცნობი შეცდომა'}`
    );
  }

  return data;
}

// შეამოწმებს გადახდის სტატუსს payId-ის მიხედვით.
// Checks the payment status for a given payId.
async function getPaymentDetails(payId) {
  const token = await getAccessToken();

  const response = await fetch(`${TBC_BASE_URL}/v1/tpay/payments/${payId}`, {
    method: 'GET',
    headers: {
      apikey: TBC_API_KEY,
      Authorization: `Bearer ${token}`
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `TBC get-payment შეცდომა (${response.status}): ${data.detail || 'უცნობი შეცდომა'}`
    );
  }

  return data;
}

module.exports = { getAccessToken, createPayment, getPaymentDetails };
