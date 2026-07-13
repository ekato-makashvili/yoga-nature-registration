require('dotenv').config();

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const tbc = require('./services/tbcPayment');

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`).replace(/\/$/, '');
const DATA_FILE = path.join(__dirname, 'data', 'registrations.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// პაკეტები (30 დღიანი მოქმედების ვადით) / Packages (valid for 30 days)
const PACKAGES = {
  p1: { sessions: 1, price: 20, labelKa: 'Yoga bunebashi - 1 varjishi', labelEn: 'Yoga in Nature - 1 session' },
  p4: { sessions: 4, price: 60, labelKa: 'Yoga bunebashi - 4 varjishi', labelEn: 'Yoga in Nature - 4 sessions' },
  p8: { sessions: 8, price: 100, labelKa: 'Yoga bunebashi - 8 varjishi', labelEn: 'Yoga in Nature - 8 sessions' },
  p12: { sessions: 12, price: 140, labelKa: 'Yoga bunebashi - 12 varjishi', labelEn: 'Yoga in Nature - 12 sessions' }
};

function readDb() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch (err) {
    return [];
  }
}

function writeDb(list) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), 'utf-8');
}

// ფორმის გაგზავნა: ინახავს რეგისტრაციას და იწყებს TBC გადახდას.
// Form submission: saves the registration and starts a TBC payment.
app.post('/api/register', async (req, res) => {
  try {
    const { fullName, phone, packageId, language } = req.body || {};

    if (!fullName || !fullName.trim()) {
      return res.status(400).json({ error: 'სახელი და გვარი სავალდებულოა. / Full name is required.' });
    }
    if (!phone || !phone.trim()) {
      return res.status(400).json({ error: 'ტელეფონის ნომერი სავალდებულოა. / Phone number is required.' });
    }
    const pkg = PACKAGES[packageId];
    if (!pkg) {
      return res.status(400).json({ error: 'გთხოვთ აირჩიოთ პაკეტი. / Please choose a package.' });
    }

    const lang = language === 'en' ? 'EN' : 'KA';
    const regId = 'reg_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex');

    const registration = {
      id: regId,
      fullName: fullName.trim(),
      phone: phone.trim(),
      packageId,
      sessions: pkg.sessions,
      price: pkg.price,
      language: lang,
      status: 'pending_payment',
      payId: null,
      createdAt: new Date().toISOString()
    };

    const db = readDb();
    db.push(registration);
    writeDb(db);

    let payment;
    try {
      payment = await tbc.createPayment({
        amount: pkg.price,
        description: lang === 'EN' ? pkg.labelEn : pkg.labelKa,
        returnurl: `${PUBLIC_BASE_URL}/return.html?reg=${regId}`,
        callbackUrl: `${PUBLIC_BASE_URL}/api/tbc/callback`,
        merchantPaymentId: regId,
        language: lang
      });
    } catch (paymentErr) {
      console.error('TBC payment creation failed:', paymentErr.message);
      return res.status(502).json({
        error: 'გადახდის სერვისთან დაკავშირება ვერ მოხერხდა. შეამოწმეთ TBC-ის მონაცემები .env ფაილში. / ' +
          'Could not reach the payment service. Check your TBC credentials in .env.'
      });
    }

    const approvalLink = (payment.links || []).find((l) => l.rel === 'approval_url');
    if (!approvalLink) {
      console.error('TBC response missing approval_url link:', payment);
      return res.status(502).json({ error: 'გადახდის ბმული ვერ მოიძებნა. / Payment link not found.' });
    }

    registration.payId = payment.payId;
    writeDb(readDb().map((r) => (r.id === regId ? registration : r)));

    res.status(201).json({ ok: true, regId, redirectUrl: approvalLink.uri });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'დაფიქსირდა შეცდომა. სცადეთ თავიდან. / Something went wrong. Please try again.' });
  }
});

// TBC-ის callback: მოდის, როცა გადახდის სტატუსი იცვლება (server-to-server).
// TBC's callback: fires when the payment status changes (server-to-server).
app.post('/api/tbc/callback', async (req, res) => {
  try {
    const { PaymentId } = req.body || {};
    if (!PaymentId) return res.sendStatus(400);

    const db = readDb();
    const reg = db.find((r) => r.payId === PaymentId);

    if (reg) {
      const details = await tbc.getPaymentDetails(PaymentId);
      reg.status = details.status;
      writeDb(db);
    }

    // TBC-სთვის აუცილებელია 200 პასუხი, წინააღმდეგ შემთხვევაში სცდის თავიდან.
    // TBC needs a 200 response, otherwise it will retry.
    res.sendStatus(200);
  } catch (err) {
    console.error('TBC callback error:', err.message);
    res.sendStatus(200);
  }
});

// მომხმარებლის დაბრუნების გვერდი ამოწმებს სტატუსს ამ endpoint-ის საშუალებით.
// The user's return page checks status through this endpoint.
app.get('/api/payment-status/:regId', async (req, res) => {
  try {
    const db = readDb();
    const reg = db.find((r) => r.id === req.params.regId);
    if (!reg) {
      return res.status(404).json({ error: 'რეგისტრაცია ვერ მოიძებნა. / Registration not found.' });
    }

    if (reg.payId && reg.status === 'pending_payment') {
      try {
        const details = await tbc.getPaymentDetails(reg.payId);
        reg.status = details.status;
        writeDb(db);
      } catch (err) {
        console.error('Status check failed:', err.message);
      }
    }

    res.json({
      status: reg.status,
      fullName: reg.fullName,
      sessions: reg.sessions,
      price: reg.price,
      language: reg.language
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'სტატუსის შემოწმება ვერ მოხერხდა. / Could not check status.' });
  }
});

// მარტივი ადმინ-ხედი ყველა რეგისტრაციაზე / simple admin view of all registrations
app.get('/api/registrations', (req, res) => {
  res.json(readDb());
});

app.listen(PORT, () => {
  console.log(`სერვერი გაშვებულია / Server running: http://localhost:${PORT}`);
  console.log(`PUBLIC_BASE_URL: ${PUBLIC_BASE_URL}`);
});
