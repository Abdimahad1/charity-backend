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
const sharp = require('sharp');

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
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  })
);

app.use(compression({
  level: 6,
  threshold: 0,
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));
app.use(cookieParser());

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

/* ---------------- CORS Configuration ---------------- */
const allowedOrigins = [
  'https://www.al-haqwelfarefoundation.org',
  'https://charity-admin-dashboard.onrender.com',
  'https://charity-backend-c05j.onrender.com',
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
                 origin.endsWith('.render.com') ||
                 origin.endsWith('.al-haqwelfarefoundation.org'))) {
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
    // Allow requests with no origin (like mobile apps, curl, postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin) || 
        origin.includes('localhost') || 
        origin.includes('127.0.0.1') ||
        origin.endsWith('.render.com') ||
        origin.endsWith('.al-haqwelfarefoundation.org')) {
      callback(null, true);
    } else {
      console.log('CORS blocked for origin:', origin);
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
    immutable: true,
    setHeaders: (res, filePath) => {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      
      // Add aggressive caching for images
      if (filePath.endsWith('.webp') || filePath.endsWith('.jpg') || 
          filePath.endsWith('.jpeg') || filePath.endsWith('.png')) {
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      }
      
      // Enable Brotli compression for supported clients
      if (req.headers['accept-encoding'] && req.headers['accept-encoding'].includes('br')) {
        res.setHeader('Content-Encoding', 'br');
      }
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

// Image optimization test endpoint
app.get('/api/image-test', async (req, res) => {
  try {
    const testImagePath = path.join(__dirname, 'test-image.jpg');
    
    // Check if test image exists
    if (!fs.existsSync(testImagePath)) {
      // Create a simple test image if it doesn't exist
      const svgBuffer = Buffer.from(
        `<svg width="800" height="400" xmlns="http://www.w3.org/2000/svg">
          <rect width="100%" height="100%" fill="#4F46E5"/>
          <text x="50%" y="50%" font-family="Arial" font-size="40" fill="white" text-anchor="middle" dy=".3em">Test Image</text>
        </svg>`
      );
      
      const optimized = await sharp(svgBuffer)
        .resize(800)
        .jpeg({ quality: 75 })
        .toBuffer();
      
      res.set('Content-Type', 'image/jpeg');
      return res.send(optimized);
    }
    
    // Generate optimized versions from existing test image
    const optimized = await sharp(testImagePath)
      .resize(800)
      .webp({ quality: 75, effort: 4 })
      .toBuffer();
    
    res.set('Content-Type', 'image/webp');
    res.send(optimized);
  } catch (error) {
    console.error('Image test error:', error);
    res.status(500).json({ error: 'Image processing test failed' });
  }
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
      console.log(`   - *.al-haqwelfarefoundation.org (all subdomains)`);
      console.log(`   - localhost & 127.0.0.1`);
      console.log(`📧 SMTP configured for: ${process.env.SMTP_USER || 'Not set'}`);
      console.log(`🖼️ Image optimization enabled`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
})();