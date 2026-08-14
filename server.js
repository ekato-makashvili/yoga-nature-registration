require("dotenv").config();

const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const flitt = require("./services/flittPayment");

const app = express();
const PORT = process.env.PORT || 3000;
const PUBLIC_BASE_URL = (
  process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`
).replace(/\/$/, "");
const DATA_FILE = path.join(__dirname, "data", "registrations.json");

app.use(express.json());

// Flitt ხანდახან POST მეთოდით აბრუნებს მომხმარებელს response_url-ზე
// (ჩვეულებრივი GET გადამისამართების ნაცვლად). ეს route POST-ს იჭერს და
// იმავე ბმულზე ჩვეულებრივ (GET) გადამისამართებას აკეთებს, რომ static
// ფაილი ჩვეულებრივად ჩაიტვირთოს.
//
// Flitt sometimes returns the user to response_url via POST (instead of
// a normal GET redirect). This route catches that POST and redirects to
// the same URL as a normal GET, so the static file loads correctly.
app.post("/return.html", (req, res) => {
  res.redirect(302, req.originalUrl);
});

app.use(express.static(path.join(__dirname, "public"), { dotfiles: "allow" }));
const PACKAGES = {
  ptest: { class: 1, price: 1, label: "Test payment - 1 GEL" },
  p1: { classs: 1, price: 25, label: "Yoga in Nature - 1 class" },
  p4: { classs: 4, price: 70, label: "Yoga in Nature - 4 classs" },
  p8: { classs: 8, price: 120, label: "Yoga in Nature - 8 classs" },
  p12: { classs: 12, price: 150, label: "Yoga in Nature - 12 classs" },
};

function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, "[]", "utf-8");
  }
}

function readDb() {
  try {
    ensureDataFile();
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch (err) {
    return [];
  }
}

function writeDb(list) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), "utf-8");
}

app.post("/api/register", async (req, res) => {
  try {
    const { fullName, email, packageId, timeSlot, language } = req.body || {};
    if (!fullName || !fullName.trim()) {
      return res.status(400).json({
        error: "სახელი და გვარი სავალდებულოა. / Full name is required.",
      });
    }
    if (!email || !email.trim()) {
      return res
        .status(400)
        .json({ error: "ელ-ფოსტა სავალდებულოა. / Email address is required." });
    }
    const pkg = PACKAGES[packageId];
    if (!pkg) {
      return res
        .status(400)
        .json({ error: "გთხოვთ აირჩიოთ პაკეტი. / Please choose a package." });
    }

    const TIME_SLOTS = {
      morning: "08:30 - 09:30",
      evening: "19:30 - 20:30",
    };
    const timeSlotLabel = TIME_SLOTS[timeSlot];
    if (!timeSlotLabel) {
      return res.status(400).json({
        error:
          "გთხოვთ აირჩიოთ სასურველი დრო. / Please choose a preferred time.",
      });
    }

    const lang = language === "en" ? "EN" : "KA";
    const regId =
      "reg_" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex");

    const registration = {
      id: regId,
      fullName: fullName.trim(),
      email: email.trim(),
      packageId,
      timeSlot,
      timeSlotLabel,
      classes: pkg.classes,
      price: pkg.price,
      language: lang,
      status: "pending_payment",
      createdAt: new Date().toISOString(),
    };

    const db = readDb();
    db.push(registration);
    writeDb(db);

    let checkout;
    try {
      checkout = await flitt.createCheckout({
        orderId: regId,
        amountMinorUnits: pkg.price * 100, // Flitt-ს ჭირდება წვრილი ერთეულები (თეტრი) / Flitt needs minor units (tetri)
        currency: "GEL",
        orderDesc: pkg.label,
        responseUrl: `${PUBLIC_BASE_URL}/return.html?reg=${regId}`,
        serverCallbackUrl: `${PUBLIC_BASE_URL}/api/flitt/callback`,
      });
    } catch (paymentErr) {
      console.error("Flitt checkout creation failed:", paymentErr.message);
      return res.status(502).json({
        error:
          "გადახდის სერვისთან დაკავშირება ვერ მოხერხდა. შეამოწმეთ Flitt-ის მონაცემები .env ფაილში. / " +
          "Could not reach the payment service. Check your Flitt credentials in .env.",
      });
    }

    res
      .status(201)
      .json({ ok: true, regId, redirectUrl: checkout.checkout_url });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error:
        "დაფიქსირდა შეცდომა. სცადეთ თავიდან. / Something went wrong. Please try again.",
    });
  }
});

// Flitt-ის callback: მოდის, როცა გადახდის სტატუსი იცვლება.
app.post("/api/flitt/callback", (req, res) => {
  try {
    const params = req.body || {};

    if (!flitt.verifySignature(process.env.FLITT_SECRET_KEY, params)) {
      console.error("Flitt callback: invalid signature");
      return res.sendStatus(400);
    }

    const db = readDb();
    const reg = db.find((r) => r.id === params.order_id);
    if (reg) {
      reg.status = params.order_status;
      writeDb(db);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error("Flitt callback error:", err.message);
    res.sendStatus(200);
  }
});

app.get("/api/payment-status/:regId", async (req, res) => {
  try {
    const db = readDb();
    const reg = db.find((r) => r.id === req.params.regId);
    if (!reg) {
      return res
        .status(404)
        .json({ error: "რეგისტრაცია ვერ მოიძებნა. / Registration not found." });
    }

    if (reg.status === "pending_payment") {
      try {
        const details = await flitt.getOrderStatus(reg.id);
        reg.status = details.order_status;
        writeDb(db);
      } catch (err) {
        console.error("Status check failed:", err.message);
      }
    }

    res.json({
      status: reg.status,
      fullName: reg.fullName,
      classs: reg.classs,
      price: reg.price,
      language: reg.language,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "სტატუსის შემოწმება ვერ მოხერხდა. / Could not check status.",
    });
  }
});

app.get("/api/registrations", (req, res) => {
  res.json(readDb());
});

app.listen(PORT, () => {
  console.log(`სერვერი გაშვებულია / Server running: http://localhost:${PORT}`);
  console.log(`PUBLIC_BASE_URL: ${PUBLIC_BASE_URL}`);
});
