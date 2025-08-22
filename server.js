// server.js
// Load env before anything else
require('dotenv').config({
  path: process.env.NODE_ENV === 'production' ? '.env.production' : '.env'
});

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
    crossOriginResourcePolicy: false,
  })
);

app.use(compression());
app.use(cookieParser());

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

/* ---------------- CORS Configuration ---------------- */
const allowedOrigins = [
  'https://charity-foundation-web.onrender.com',
  'https://charity-admin-dashboard.onrender.com',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:5000'
];

// Custom CORS middleware - simpler and more reliable
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Check if origin is allowed
  if (origin && (allowedOrigins.includes(origin) || 
                 origin.includes('localhost') || 
                 origin.includes('127.0.0.1') ||
                 origin.endsWith('.render.com'))) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Max-Age', '86400');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Also use the cors package with safe configuration
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || 
        origin.includes('localhost') || 
        origin.includes('127.0.0.1') ||
        origin.endsWith('.render.com')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

/* ---------------- Static: uploaded files ---------------- */
const uploadsRoot = process.env.UPLOAD_ROOT || path.join(__dirname, 'uploads');

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
    maxAge: '365d',
    setHeaders: (res) => {
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
app.use('/api/payments', paymentsRouter);
app.use('/api/reports', reportRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/users', userRoutes);

/* ---------------- Healthcheck ---------------- */
app.get('/health', (_req, res) => res.json({ 
  ok: true, 
  message: 'Server is running',
  timestamp: new Date().toISOString()
}));

// Add CORS test endpoint
app.get('/api/test-cors', (req, res) => {
  res.json({ 
    success: true,
    message: 'CORS test successful',
    timestamp: new Date().toISOString(),
    allowedOrigins: allowedOrigins,
    currentOrigin: req.headers.origin,
    yourIP: req.ip
  });
});

// Simple test endpoint for basic functionality
app.get('/api/test', (req, res) => {
  res.json({ 
    success: true,
    message: 'API is working!',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

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
      console.log(`🌐 Allowed CORS origins:`);
      allowedOrigins.forEach(origin => console.log(`   - ${origin}`));
      console.log(`   - *.render.com (all subdomains)`);
      console.log(`   - localhost & 127.0.0.1`);
      console.log(`📧 SMTP configured for: ${process.env.SMTP_USER || 'Not set'}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
})();