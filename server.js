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
const paymentRoutes = require('./routes/paymentRoutes');
const app = express();
app.set('trust proxy', 1);

/* ---------------- Security & body parsing ---------------- */
app.use(
  helmet({
    crossOriginResourcePolicy: false, // allow serving images to other origins
  })
);
// Optional: relax CSP if you embed images/backgrounds from uploads/data/blob
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

// JSON limit is for JSON bodies only; file uploads go via /api/upload (multer/busboy)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

/* ---------------- CORS (must be before routes & static) ---------------- */
const allowAll = (origin, cb) => cb(null, true);
const corsConfig = {
  origin: allowAll, // change to your admin/public URLs in production if needed
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
   Kept AFTER CORS so images get proper CORS headers */
const uploadsDir = path.join(__dirname, 'uploads');
app.use(
  '/uploads',
  express.static(uploadsDir, {
    maxAge: '1d',
    setHeaders: (res) => {
      // Make sure browsers can use them as backgrounds <img> etc. from any origin (dev)
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
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
app.use('/api/payments', paymentRoutes);
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
