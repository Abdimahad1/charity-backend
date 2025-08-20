// server.js
// Load env before anything else
require('dotenv').config({
  path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env'
});

// Optional: quick sanity check in logs (won't print secrets)
console.log(
  `🔧 Env loaded: ${process.env.NODE_ENV === 'production' ? '.env.production' : '.env'} | NODE_ENV=${process.env.NODE_ENV || 'development'}`
);

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');

const connectDB = require('./config/db');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');

// Routes
const authRoutes = require('./routes/authRoutes');
const charityRoutes = require('./routes/charityRoutes');
const slideRoutes = require('./routes/slideRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const eventRoutes = require('./routes/eventRoutes');
const volunteerRoutes = require('./routes/volunteerRoutes');
const contactRoutes = require('./routes/contactRoutes');
const paymentsRouter = require('./routes/paymentsRouter');
const reportRoutes = require('./routes/reportRoutes');
const activityRoutes = require('./routes/activityRoutes');
const userRoutes = require('./routes/userRoutes');


const app = express();

// Trust proxy so req.protocol respects x-forwarded-proto (Render/NGINX/etc.)
app.set('trust proxy', 1);

/* ---------------- Security & body parsing ---------------- */
app.use(
  helmet({
    crossOriginResourcePolicy: false, // allow serving images to other origins
  })
);
// Optional CSP example if you want to restrict sources for <img>/media
// app.use(
//   helmet.contentSecurityPolicy({
//     useDefaults: true,
//     directives: {
//       "img-src": ["'self'", "data:", "blob:", "*"],
//       "media-src": ["'self'", "data:", "blob:", "*"],
//     },
//   })
// );

app.use(compression());
app.use(cookieParser());

// JSON limit is for JSON bodies only; file uploads go via /api/upload (multer)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

/* ---------------- CORS (must be before routes & static) ---------------- */
const allowAll = (origin, cb) => cb(null, true);
const corsConfig = {
  origin: allowAll, // tighten to specific frontends in production if desired
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsConfig));
// Explicit preflight (optional; cors() already handles it)
app.options(/.*/, cors(corsConfig));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

/* ---------------- Static: uploaded files ----------------
   Use the SAME root as uploadRoutes.js so writing & serving match.
   Supports Render persistent disk via UPLOAD_ROOT env.
---------------------------------------------------------------- */
const uploadsRoot = process.env.UPLOAD_ROOT || path.join(__dirname, 'uploads');

// Ensure folders exist (root + images + cv)
['', 'images', 'cv'].forEach((sub) => {
  const dir = sub ? path.join(uploadsRoot, sub) : uploadsRoot;
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (e) {
    console.error('⚠️ Failed to create uploads dir:', dir, e.message);
  }
});

console.log('📁 uploadsRoot (server.js):', uploadsRoot);

app.use(
  '/uploads',
  express.static(uploadsRoot, {
    maxAge: '1d',
    setHeaders: (res) => {
      // Make sure browsers can use them as backgrounds <img> etc. from any origin
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      // Optional: stronger caching
      // res.setHeader('Cache-Control', 'public, max-age=86400, immutable');
    },
  })
);

/* ---------------- Routes ---------------- */
app.use('/api/auth', authRoutes);
app.use('/api/charities', charityRoutes);
app.use('/api/slides', slideRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/volunteers', volunteerRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/payments', paymentsRouter);
app.use('/api/reports', reportRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/users', userRoutes);
/* ---------------- Healthcheck ---------------- */
app.get('/health', (_req, res) => res.json({ ok: true }));

/* ---------------- Errors ---------------- */
app.use(notFound);
app.use(errorHandler);

/* ---------------- Start ---------------- */
(async () => {
  try {
    await connectDB();
    const port = Number(process.env.PORT || 5000);
    app.listen(port, () => {
      console.log(`🚀 API listening on http://localhost:${port}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
})();
