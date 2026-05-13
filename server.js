/**
 * TripOye VisaOS — main server.
 */
const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const cookieParser = require('cookie-parser');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const db = require('./db');
const { loadUser } = require('./middleware/auth');
const helpers = require('./middleware/helpers');

const app = express();
app.set('trust proxy', 1);

// ---------- View engine ----------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ---------- Security & perf ----------
app.use(helmet({
  contentSecurityPolicy: false,   // we use Tailwind CDN + Google Fonts
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(cookieParser());

// Raw body for Razorpay webhook signature verification
app.use('/api/payment/razorpay/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ---------- Session (MySQL-backed for multi-process safety) ----------
const sessionStore = new MySQLStore({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  clearExpired: true,
  checkExpirationInterval: 15 * 60 * 1000,
  expiration: config.session.maxAge,
  createDatabaseTable: true,
});

app.use(session({
  name: 'tripoye_sid',
  secret: config.session.secret,
  store: sessionStore,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: config.env === 'production',
    sameSite: 'lax',
    maxAge: config.session.maxAge,
  }
}));

// ---------- Static ----------
app.use('/assets',  express.static(path.join(__dirname, 'public'), { maxAge: '7d' }));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads'), { maxAge: '30d' }));

// ---------- Global locals ----------
app.use((req, res, next) => {
  res.locals.config   = config;
  res.locals.h        = helpers;
  res.locals.req      = req;
  res.locals.flash    = req.session.flash || null;
  delete req.session.flash;
  next();
});

// ---------- Auth loader ----------
app.use(loadUser);

// ---------- Routes ----------
app.use('/',         require('./routes/pages'));
app.use('/',         require('./routes/auth'));
app.use('/api',      require('./routes/api'));
app.use('/admin',    require('./routes/admin'));

// ---------- Rate limit on sensitive APIs ----------
app.use('/api/chat',         rateLimit({ windowMs: 60_000, max: 30 }));
app.use('/api/eligibility',  rateLimit({ windowMs: 60_000, max: 10 }));

// ---------- 404 ----------
app.use((req, res) => {
  res.status(404).render('error', { title: 'Page not found', code: 404, msg: 'That page doesn\'t exist (yet).' });
});

// ---------- Error handler ----------
app.use((err, req, res, next) => {
  console.error('💥', err);
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ ok: false, error: 'Server error' });
  }
  res.status(500).render('error', { title: 'Something broke', code: 500, msg: config.env === 'production' ? 'Please try again in a moment.' : err.message });
});

// ---------- Start ----------
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

app.listen(config.port, () => {
  console.log(`\n🌍  TripOye VisaOS — ${config.env}`);
  console.log(`    ${config.appUrl}`);
  console.log(`    Listening on port ${config.port}\n`);
});
