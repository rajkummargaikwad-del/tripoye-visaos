# TripOye VisaOS

**The world's most human visa platform.** AI-powered, WhatsApp-native, refund-backed visa application SaaS built with Node.js + Express + MySQL + EJS — designed to drop straight onto Hostinger Node.js hosting.

---

## What's inside

- **Full public site** — homepage, 12 seeded countries, country detail pages, eligibility checker, pricing, about, contact, multi-step application form with live OCR auto-fill, payment via Razorpay, application tracking by reference code, user dashboard
- **Noor AI assistant** — floating chat widget on every page, OpenAI-backed when keys are set, deterministic stubs otherwise
- **Admin panel** — dashboard, countries & visa-types CRUD, applications listing + detail with status workflow, users management, leads CRM, conversations log, settings, password change
- **Integrations (all toggleable)** — OpenAI, WhatsApp Cloud API, Google Document AI OCR, Razorpay, SMTP transactional email
- **12 countries seeded** — UAE, Singapore, Thailand, Japan, USA, UK, Schengen, Vietnam, Saudi Arabia, Australia, Canada, Malaysia, each with multiple visa types pre-priced for the Indian market

---

## Quick start (local development)

```bash
# 1. Install dependencies
npm install

# 2. Copy environment file
cp .env.example .env

# 3. Edit .env with your DB credentials (minimum: DB_NAME, DB_USER, DB_PASS, SESSION_SECRET)

# 4. Create the database (in MySQL):
#    CREATE DATABASE tripoye CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 5. Run installer to create tables + seed data
npm run install:db

# 6. Start the server
npm start

# Open http://localhost:3000
```

**Default admin login:**
- Email: `admin@tripoye.com`
- Password: `ChangeMe@2026`
- ⚠ Change it immediately in /admin → Settings

---

## Deploying to Hostinger

Hostinger's Node.js hosting (Premium / Business / Cloud plans) is the target.

### Step 1 — Create the MySQL database
1. Log into Hostinger hPanel
2. Databases → MySQL Databases → Create
3. Note your DB name, username, password, host (usually `localhost`)

### Step 2 — Upload the code
1. Hostinger hPanel → File Manager → navigate to `public_html` (or a subdomain folder)
2. Upload this entire `tripoye/` folder (or use FTP / git clone)
3. Do **not** upload `node_modules` — Hostinger will install them

### Step 3 — Configure environment
1. In File Manager, copy `.env.example` to `.env`
2. Edit `.env` and fill in at minimum:
   ```
   NODE_ENV=production
   APP_URL=https://yourdomain.com
   SESSION_SECRET=<generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))">
   DB_HOST=localhost
   DB_NAME=u123456_tripoye
   DB_USER=u123456_tripoye
   DB_PASS=<your password>
   ```

### Step 4 — Set up the Node.js app
1. hPanel → Advanced → Node.js
2. Click "Create Application"
3. **Node.js version:** 18.x or 20.x
4. **Application root:** the folder you uploaded to (e.g. `public_html/tripoye`)
5. **Application URL:** your domain
6. **Application startup file:** `server.js`
7. Click "Create"

### Step 5 — Install dependencies & set up DB
In the Hostinger Node.js panel, open the terminal for your app:

```bash
npm install --production
npm run install:db
```

### Step 6 — Restart and verify
1. Click "Restart" in the Node.js panel
2. Visit your domain — homepage should load
3. Visit `/admin` and log in with the default credentials
4. **Change the admin password immediately**

---

## Plugging in integrations

Every integration runs in **stub mode** by default — the site is fully functional without any API keys. When you're ready to go live with a feature, set the corresponding `.env` values and the matching `FEATURE_*` flag to `true`, then restart Node.

### OpenAI (Noor AI chat + eligibility scoring)
```env
OPENAI_API_KEY=sk-…
FEATURE_AI_CHAT=true
```
Get a key at [platform.openai.com](https://platform.openai.com). `gpt-4o-mini` is the default — costs roughly ₹0.10 per chat reply.

### WhatsApp Cloud API (Meta)
1. Create a Meta Business app at [developers.facebook.com](https://developers.facebook.com)
2. Add the WhatsApp product
3. Get your Phone Number ID and a permanent System User Access Token
4. Set `.env`:
   ```env
   WA_PHONE_NUMBER_ID=…
   WA_BUSINESS_TOKEN=…
   WA_VERIFY_TOKEN=tripoye_verify_xyz   (any random string)
   FEATURE_WHATSAPP=true
   ```
5. Configure the webhook in Meta:
   - URL: `https://yourdomain.com/api/whatsapp/webhook`
   - Verify token: the same `WA_VERIFY_TOKEN` value
   - Subscribe to: `messages`

### Google Document AI (passport OCR)
1. Create a GCP project
2. Enable the Document AI API
3. Create a Passport Parser processor (us location)
4. Create a service account, download the JSON key
5. Upload the key to `config/gcp-key.json`
6. Set `.env`:
   ```env
   GCP_PROJECT_ID=…
   GCP_PROCESSOR_ID=…
   GCP_KEY_JSON_PATH=./config/gcp-key.json
   FEATURE_LIVE_OCR=true
   ```
7. Run `npm install @google-cloud/documentai`

### Razorpay (Indian payments)
1. Sign up at [razorpay.com](https://razorpay.com)
2. Dashboard → Settings → API Keys → generate live keys
3. Set `.env`:
   ```env
   RAZORPAY_KEY_ID=rzp_live_…
   RAZORPAY_KEY_SECRET=…
   RAZORPAY_WEBHOOK_SECRET=…
   FEATURE_RAZORPAY=true
   ```
4. Configure webhook in Razorpay dashboard:
   - URL: `https://yourdomain.com/api/payment/razorpay/webhook`
   - Events: `payment.captured`, `payment.failed`, `order.paid`
   - Set the webhook secret to match `RAZORPAY_WEBHOOK_SECRET`

### SMTP (transactional email via Hostinger or any provider)
```env
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=…
SMTP_FROM_EMAIL=noreply@yourdomain.com
SMTP_FROM_NAME=TripOye VisaOS
```
Hostinger gives you free SMTP for email addresses created on your domain.

---

## File / directory map

```
tripoye/
├── server.js                    Main Express entry point
├── package.json
├── .env.example                 Template for environment config
│
├── config/index.js              Reads .env, exposes typed config
├── db/
│   ├── index.js                 MySQL pool + query helpers
│   ├── schema.sql               Tables + seed data
│   └── install.js               One-shot installer (npm run install:db)
│
├── middleware/
│   ├── auth.js                  Session-based auth (loadUser, requireLogin, requireAdmin)
│   └── helpers.js               View helpers (flag emoji, money, dates, status badges)
│
├── routes/
│   ├── pages.js                 Public pages (home, country, eligibility, pricing, etc.)
│   ├── auth.js                  Signup / login / logout
│   ├── api.js                   JSON APIs (chat, eligibility, application, upload, payment, WA webhook)
│   └── admin.js                 Admin panel routes (CRUD on master data, applications, users, settings)
│
├── services/
│   ├── openai.js                Noor AI chat + eligibility scoring
│   ├── whatsapp.js              Meta WhatsApp Cloud API client
│   ├── ocr.js                   Google Document AI passport parser
│   ├── razorpay.js              Razorpay order/verify helpers
│   └── email.js                 Nodemailer transactional email
│
├── views/                       EJS templates
│   ├── partials/                head, nav, footer, chat-widget
│   ├── home.ejs                 Premium landing page
│   ├── countries.ejs / country.ejs   Listing + detail
│   ├── eligibility.ejs          AI checker
│   ├── apply.ejs                Multi-step application form (4 steps)
│   ├── dashboard.ejs            User dashboard
│   ├── track-search.ejs         Track by reference code
│   ├── login.ejs / signup.ejs
│   ├── pricing.ejs / about.ejs / contact.ejs / whatsapp.ejs
│   ├── error.ejs                404 / 500
│   └── admin/                   Admin panel (10 views)
│
└── public/                      Static files served at /assets/
    ├── css/app.css              Design system
    ├── js/main.js               Client-side JS (chat widget logic, etc.)
    └── uploads/                 User file uploads (created on first run)
```

---

## Database tables

10 tables, all with foreign keys and indexes:

| Table | Purpose |
|---|---|
| `users` | Auth + roles (user, agent, admin, super_admin) |
| `countries` | Master country data with hero color, description, embassy notes |
| `visa_types` | Visa products per country with fees, processing, approval rate |
| `applications` | Every application — draft → submitted → approved/rejected |
| `documents` | Uploaded passport scans, photos, bank statements + OCR data |
| `payments` | Razorpay/Stripe payment records |
| `conversations` | AI chat sessions (web + WhatsApp) |
| `messages` | Individual chat messages |
| `leads` | CRM — contact form submissions |
| `settings` | Site-level key/value config |
| `audit_log` | Audit trail (admin actions) |

Plus an `express_sessions` table auto-created by `express-mysql-session`.

---

## Common operations

### Add a new country
- Admin → Countries → "+ New country" → fill form
- Then add visa types from the country edit page

### Bulk-add countries
Edit `db/schema.sql`, add INSERT statements, and re-run `npm run install:db` (⚠ wipes data) — or run the INSERTs manually in phpMyAdmin.

### Reset admin password
Re-run `npm run install:db` (will reset to `ChangeMe@2026`) or change it inside the app at /admin → Settings.

### View error logs
```bash
# In Hostinger Node.js panel
tail -f logs/error.log
```

### Update the site
1. Upload the new files via File Manager / FTP
2. From the Node.js panel terminal: `npm install --production`
3. Click "Restart"

---

## Security checklist for production

- [ ] Generate a strong `SESSION_SECRET` (≥64 hex chars)
- [ ] Change the default admin password (`admin@tripoye.com`)
- [ ] Set `NODE_ENV=production`
- [ ] Set `APP_URL` to your real HTTPS URL
- [ ] Enable HTTPS (Hostinger free SSL)
- [ ] Restrict file upload size if needed (default 10 MB in `routes/api.js`)
- [ ] Set up daily DB backups in Hostinger
- [ ] Add a real WhatsApp number (not the support stub)
- [ ] Configure SMTP so users actually receive emails
- [ ] Set `FEATURE_RAZORPAY=true` only after webhooks are verified working

---

## Support

- WhatsApp: configured in `.env` as `SUPPORT_WHATSAPP`
- Email: configured in `.env` as `SUPPORT_EMAIL`
- Issues: open one on your code repository

---

**Built for travellers tired of visa queues.**
