# იოგა ბუნებაში — ეკატოსთან ერთად
### Yoga in Nature — with Ekato

ორენოვანი (ქართული/ინგლისური) რეგისტრაციისა და გადახდის ფორმა ღია ცის ქვეშ იოგას გაკვეთილებისთვის, TBC E-Commerce-ის ინტეგრაციით (ბარათები + Apple Pay).

A bilingual (Georgian/English) registration + payment form for outdoor yoga classes, integrated with TBC E-Commerce (cards + Apple Pay).

---

## რას შეიცავს / What's inside

- ორენოვანი გვერდი პაკეტების არჩევით (1 / 4 / 8 / 12 ვარჯიში, 30-დღიანი ვადით)
- Node.js/Express სერვერი, რომელიც ინახავს რეგისტრაციებს და ქმნის გადახდას TBC-ის API-ის მეშვეობით
- გადამისამართება TBC-ის დაცულ checkout გვერდზე (მიიღება Visa, Mastercard, Amex, Apple Pay — ნებისმიერი ბანკის ბარათი, BOG-ის ჩათვლით)
- დაბრუნების გვერდი, რომელიც აჩვენებს გადახდის სტატუსს

- A bilingual page with package selection (1 / 4 / 8 / 12 sessions, valid 30 days)
- A Node.js/Express server that saves registrations and creates a payment via TBC's API
- Redirect to TBC's secure checkout page (accepts Visa, Mastercard, Amex, Apple Pay — any bank's card, including BOG)
- A return page that shows the payment status

---

## 1. წინაპირობა / Prerequisites

- [Node.js](https://nodejs.org) 18 ან უფრო ახალი (საჭიროა ჩაშენებული `fetch`-ისთვის) / Node.js 18+ (needed for built-in `fetch`)
- VS Code (ან ნებისმიერი რედაქტორი) / VS Code (or any editor)
- TBC E-Commerce მერჩანტის ანგარიში — იხ. ნაბიჯი 3 / A TBC E-Commerce merchant account — see step 3

---

## 2. გაშვება ლოკალურად / Running it locally

```bash
cd yoga-nature-registration
npm install
cp .env.example .env
npm start
```

გახსენით `http://localhost:3000`.
Open `http://localhost:3000`.

ფორმა ჩაიტვირთება, მაგრამ გადახდის ღილაკზე დაჭერისას შეცდომას მიიღებთ, სანამ `.env`-ში არ ჩასვამთ თქვენს რეალურ TBC მონაცემებს (იხ. ნაბიჯი 3-4).

The form will load, but clicking pay will show an error until you fill in your real TBC credentials in `.env` (see steps 3–4).

---

## 3. TBC E-Commerce მერჩანტის რეგისტრაცია / Registering as a TBC E-Commerce merchant

1. დაარეგისტრირეთ თქვენი ბიზნესი TBC E-Commerce მერჩანტად: **https://ecom.tbcpayments.ge**
   Register your business as a TBC E-Commerce merchant at **https://ecom.tbcpayments.ge**
2. დამტკიცების შემდეგ, შედით მერჩანტის დაშბორდზე და აიღეთ `client_id` და `client_secret`.
   After approval, log into the merchant dashboard and get your `client_id` and `client_secret`.
3. ცალკე შექმენით დეველოპერული ანგარიში **https://developers.tbcbank.ge**-ზე და გამოიმუშავეთ თქვენი `apikey` (ეს განსხვავებულია client_id/secret-გან).
   Separately, create a developer account at **https://developers.tbcbank.ge** and generate your `apikey` (this is different from the client_id/secret above).
4. მერჩანტის დაშბორდზე დაამატეთ თქვენი callback URL (`https://<თქვენი-დომენი>/api/tbc/callback`) — დეტალები: https://developers.tbcbank.ge/docs/checkout-callback-url
   In the merchant dashboard, add your callback URL (`https://<your-domain>/api/tbc/callback`) — details: https://developers.tbcbank.ge/docs/checkout-callback-url

სრული დოკუმენტაცია / Full documentation: https://developers.tbcbank.ge/docs/checkout-overview

---

## 4. `.env`-ის შევსება / Filling in `.env`

```env
PORT=3000
PUBLIC_BASE_URL=https://your-real-domain.ge
TBC_API_KEY=...
TBC_CLIENT_ID=...
TBC_CLIENT_SECRET=...
```

**მნიშვნელოვანია / Important:** `PUBLIC_BASE_URL` უნდა იყოს ინტერნეტიდან ხელმისაწვდომი მისამართი — TBC-მ უნდა შეძლოს callback-ის გაგზავნა და მომხმარებლის დაბრუნება ამ მისამართზე. `localhost` არ იმუშავებს production-ში.

`PUBLIC_BASE_URL` must be an address reachable from the internet — TBC needs to send its callback and return the user to this address. `localhost` will not work for real payments.

ლოკალურ ტესტირებისთვის გამოიყენეთ tunneling ხელსაწყო, მაგალითად [ngrok](https://ngrok.com):

For local testing, use a tunneling tool like [ngrok](https://ngrok.com):

```bash
ngrok http 3000
```

და გამოიყენეთ ngrok-ის მოცემული `https://...ngrok-free.app` მისამართი `PUBLIC_BASE_URL`-ად და TBC-ის callback URL-ად.

Then use the `https://...ngrok-free.app` address ngrok gives you as both `PUBLIC_BASE_URL` and the TBC callback URL.

---

## 5. როგორ მუშაობს გადახდა / How the payment flow works

1. მომხმარებელი ავსებს ფორმას → `POST /api/register` ინახავს რეგისტრაციას სტატუსით `pending_payment`.
2. სერვერი ითხოვს TBC-სგან access token-ს, შემდეგ ქმნის გადახდას (`POST /v1/tpay/payments`) და იღებს checkout ბმულს.
3. მომხმარებელი მიემართება TBC-ის დაცულ checkout გვერდზე, სადაც ირჩევს ბარათს/Apple Pay-ს და ასრულებს გადახდას.
4. TBC აბრუნებს მომხმარებელს `return.html`-ზე და **ასევე** უგზავნის სერვერს callback-ს (`/api/tbc/callback`) გადახდის საბოლოო სტატუსით — ეს არის სანდო წყარო, არა მხოლოდ მომხმარებლის ბრაუზერის დაბრუნება.
5. `return.html` ამოწმებს სტატუსს და აჩვენებს შედეგს.

---

1. The user fills out the form → `POST /api/register` saves the registration with status `pending_payment`.
2. The server requests an access token from TBC, then creates a payment (`POST /v1/tpay/payments`) and receives a checkout link.
3. The user is sent to TBC's secure checkout page, where they choose a card or Apple Pay and complete payment.
4. TBC returns the user to `return.html` and **also** sends the server a callback (`/api/tbc/callback`) with the final payment status — this is the reliable source of truth, not just the user's browser returning.
5. `return.html` checks the status and displays the result.

---

## 6. მონაცემები / Data

რეგისტრაციები ინახება ლოკალურ ფაილში `data/registrations.json`. მცირე მასშტაბისთვის საკმარისია; დიდი მოცულობისთვის რეკომენდებულია რეალური მონაცემთა ბაზა (მაგ. PostgreSQL, SQLite).

Registrations are stored in the local file `data/registrations.json`. Fine for small scale; for higher volume, switch to a real database (e.g. PostgreSQL, SQLite).

ყველა რეგისტრაციის სანახავად (მარტივი ადმინ-ხედი): `GET /api/registrations`
To see all registrations (a simple admin view): `GET /api/registrations`

---

## 7. სტრუქტურა / Project structure

```
yoga-nature-registration/
├── server.js                 # Express server, API routes
├── services/
│   └── tbcPayment.js          # TBC E-Commerce API client
├── public/
│   ├── index.html              # Registration page
│   ├── return.html             # Payment return/status page
│   ├── style.css               # Design system
│   ├── i18n.js                  # GE/EN text dictionary
│   └── script.js                 # Form + language toggle logic
├── data/
│   └── registrations.json      # Local registration store
├── .env.example
└── package.json
```
"# yoga-nature-registration" 
