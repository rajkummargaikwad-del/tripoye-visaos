/**
 * TripOye VisaOS — main server (hardened for cloud deploys).
 * - Survives DB connection failures (falls back to memory sessions)
 * - Exposes /_health and /_diagnostic regardless of DB state
 * - Logs every startup step so deploy logs are actually useful
 */
const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const helpers = require('./middleware/helpers');

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🚀 TripOye VisaOS — booting');
console.log('   NODE_ENV:', config.env);
console.log('   PORT:    ', config.port);
console.log('   DB_HOST: ', config.db.host);
console.log('   DB_NAME: ', config.db.database);
console.log('   DB_USER: ', config.db.user);
console.log('   DB_PASS: ', config.db.password ? '(set)' : '(MISSING)');
console.log('   SECRET:  ', process.env.SESSION_SECRET ? '(set)' : '(using default — INSECURE)');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const app = express();
app.set('trust proxy', 1);

// ---------- View engine ----------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ---------- Healthcheck FIRST (before anything that can fail) ----------
const bootState = { db: 'pending', sessionStore: 'pending', startedAt: new Date().toISOString() };

app.get('/_health', (req, res) => {
  res.json({
    ok: true,
    state: bootState,
    env: config.env,
    port: config.port,
    node: process.version,
  });
});

app.get('/_diagnostic', (req, res) => {
  res.type('html').send(`<!doctype html><html><head><title>TripOye Diagnostic</title>
<style>body{font-family:system-ui;padding:40px;max-width:720px;margin:0 auto;line-height:1.6}
code{background:#f4f4f4;padding:2px 6px;border-radius:4px}
.ok{color:#0a7c2f}.bad{color:#c00}.warn{color:#b86b00}
h2{margin-top:32px;border-bottom:1px solid #ddd;padding-bottom:8px}
table{width:100%;border-collapse:collapse}td{padding:8px;border-bottom:1px solid #eee}
td:first-child{font-weight:600;width:200px}</style>
</head><body>
<h1>🔧 TripOye Diagnostic</h1>
<p>Node ${process.version} • Env: <code>${config.env}</code> • Port: <code>${config.port}</code></p>

<h2>Startup state</h2>
<table>
  <tr><td>Database</td><td class="${bootState.db==='connected'?'ok':bootState.db==='failed'?'bad':'warn'}">${bootState.db}${bootState.dbError?' — '+bootState.dbError:''}</td></tr>
  <tr><td>Session store</td><td class="${bootState.sessionStore==='mysql'?'ok':bootState.sessionStore==='memory'?'warn':'bad'}">${bootState.sessionStore}</td></tr>
  <tr><td>Started at</td><td>${bootState.startedAt}</td></tr>
</table>

<h2>Environment variables</h2>
<table>
  <tr><td>DB_HOST</td><td>${config.db.host || '<span class="bad">missing</span>'}</td></tr>
  <tr><td>DB_NAME</td><td>${config.db.database || '<span class="bad">missing</span>'}</td></tr>
  <tr><td>DB_USER</td><td>${config.db.user || '<span class="bad">missing</span>'}</td></tr>
  <tr><td>DB_PASS</td><td>${config.db.password ? '<span class="ok">set ('+config.db.password.length+' chars)</span>' : '<span class="bad">MISSING</span>'}</td></tr>
  <tr><td>DB_PORT</td><td>${config.db.port}</td></tr>
  <tr><td>SESSION_SECRET</td><td>${process.env.SESSION_SECRET ? '<span class="ok">set</span>' : '<span class="warn">default (insecure)</span>'}</td></tr>
  <tr><td>APP_URL</td><td>${config.appUrl}</td></tr>
</table>

<h2>What to do next</h2>
${bootState.db !== 'connected' ? `
<p class="bad">❌ Database is not connected. Likely causes:</p>
<ul>
  <li>Wrong <code>DB_HOST</code> — on Hostinger Node.js Apps, the host is sometimes <code>localhost</code>, sometimes <code>127.0.0.1</code>, sometimes the MySQL server hostname shown in hPanel → Databases. Try each.</li>
  <li>Wrong <code>DB_USER</code> / <code>DB_PASS</code> — must match exactly what you set when creating the DB.</li>
  <li>Database not <strong>Assigned</strong> to this website — go to hPanel → Databases → Management, find your DB, click "+ Assign" if it's there.</li>
  <li>Error message above: <code>${bootState.dbError || 'unknown'}</code></li>
</ul>
` : `
<p class="ok">✅ Database connected. If main site still doesn't work, you probably need to run the installer:</p>
<p>Open hPanel terminal/SSH and run: <code>npm run install:db</code></p>
`}
</body></html>`);
});

// ---------- Security & perf ----------
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(compression());
app.use(cookieParser());

// Raw body for Razorpay webhook
app.use('/api/payment/razorpay/webhook', express.raw({ type: 'application/json' }));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// ---------- Static (works even without DB) ----------
app.use('/assets',  express.static(path.join(__dirname, 'public'), { maxAge: '7d' }));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads'), { maxAge: '30d' }));

// ---------- Try to set up DB-backed session store, fall back to memory ----------
let sessionStore;
try {
  const MySQLStore = require('express-mysql-session')(session);
  sessionStore = new MySQLStore({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    database: config.db.database,
    clearExpired: true,
    checkExpirationInterval: 15 * 60 * 1000,
    expiration: config.session.maxAge,
    createDatabaseTable: true,
    connectionLimit: 5,
  });

  sessionStore.onReady().then(() => {
    bootState.db = 'connected';
    bootState.sessionStore = 'mysql';
    console.log('✅ MySQL session store ready');
  }).catch((err) => {
    bootState.db = 'failed';
    bootState.dbError = err.code || err.message;
    bootState.sessionStore = 'memory';
    console.error('⚠  MySQL session store FAILED:', err.message);
    console.error('   → Falling back to in-memory sessions');
    sessionStore = new session.MemoryStore();
  });

  sessionStore.on?.('error', (err) => {
    console.error('MySQL session store error:', err.message);
    bootState.dbError = err.code || err.message;
  });
} catch (err) {
  console.error('⚠  Failed to init MySQL session store:', err.message);
  bootState.db = 'failed';
  bootState.dbError = err.message;
  bootState.sessionStore = 'memory';
  sessionStore = new session.MemoryStore();
}

// ---------- Session middleware ----------
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

// ---------- Global locals ----------
app.use((req, res, next) => {
  res.locals.config = config;
  res.locals.h      = helpers;
  res.locals.req    = req;
  res.locals.flash  = req.session?.flash || null;
  if (req.session) delete req.session.flash;
  next();
});

// ---------- Routes — wrap in try/catch so a missing module doesn't kill the server ----------
function safeMount(prefix, modulePath) {
  try {
    app.use(prefix, require(modulePath));
    console.log(`✓ Mounted ${prefix} → ${modulePath}`);
  } catch (err) {
    console.error(`✗ Failed to mount ${prefix}:`, err.message);
    app.use(prefix, (req, res) => res.status(500).send(`Route ${prefix} failed to load: ${err.message}<br><a href="/_diagnostic">Diagnostic</a>`));
  }
}

// Auth middleware needs DB; load it but guard
let loadUser = (req, res, next) => next();
try {
  loadUser = require('./middleware/auth').loadUser;
} catch (e) { console.error('auth middleware load failed:', e.message); }
app.use(loadUser);

safeMount('/',      './routes/pages');
safeMount('/',      './routes/auth');
safeMount('/api',   './routes/api');
safeMount('/admin', './routes/admin');

// ---------- Rate limit ----------
app.use('/api/chat',        rateLimit({ windowMs: 60_000, max: 30 }));
app.use('/api/eligibility', rateLimit({ windowMs: 60_000, max: 10 }));

// ---------- 404 ----------
app.use((req, res) => {
  try {
    res.status(404).render('error', { title: 'Page not found', code: 404, msg: 'That page doesn\'t exist (yet).' });
  } catch {
    res.status(404).send('404 Not Found. <a href="/_diagnostic">Diagnostic</a>');
  }
});

// ---------- Error handler ----------
app.use((err, req, res, next) => {
  console.error('💥', err);
  if (req.path.startsWith('/api/')) {
    return res.status(500).json({ ok: false, error: 'Server error', detail: config.env==='production' ? undefined : err.message });
  }
  try {
    res.status(500).render('error', { title: 'Something broke', code: 500, msg: config.env === 'production' ? 'Please try again in a moment.' : err.message });
  } catch {
    res.status(500).send(`Server error: ${err.message}<br><a href="/_diagnostic">Diagnostic</a>`);
  }
});

// ---------- Start ----------
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const server = app.listen(config.port, '0.0.0.0', () => {
  console.log(`\n🌍 TripOye VisaOS listening on 0.0.0.0:${config.port}`);
  console.log(`   Diagnostic: ${config.appUrl}/_diagnostic`);
  console.log(`   Health:     ${config.appUrl}/_health\n`);
});

// Never crash on unhandled errors — log and keep serving
process.on('uncaughtException', (err) => {
  console.error('🔥 uncaughtException:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('🔥 unhandledRejection:', reason);
});
