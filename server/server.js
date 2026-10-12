/**
 * server.js — ProjectHub Express Server
 *
 * Kiến trúc bảo mật:
 * - Chỉ serve public/ (không expose server/, supabase/, .env, package.json)
 * - Tất cả API routes dưới /api/
 * - Helmet bảo vệ HTTP headers
 * - Rate limiting cho API
 * - CORS chỉ cho phép origin đã cấu hình
 */

'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const path    = require('path');
const cors    = require('cors');
const helmet  = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

const app = express();

// Enable gzip/deflate compression for all HTTP responses >= 1KB
app.use(compression({ threshold: 1024 }));

// ──────────────────────────────────────────────
// 1. Security Middleware
// ──────────────────────────────────────────────

// HTTP security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        "'unsafe-inline'",                      // Bootstrap inline scripts
        "https://cdn.jsdelivr.net",
        "https://fonts.googleapis.com",
        "https://www.googletagmanager.com",
        "https://www.google-analytics.com",
      ],
      styleSrc: [
        "'self'",
        "'unsafe-inline'",
        "https://cdn.jsdelivr.net",
        "https://fonts.googleapis.com",
        "https://fonts.gstatic.com",
      ],
      fontSrc: [
        "'self'",
        "https://fonts.gstatic.com",
        "https://cdn.jsdelivr.net",
      ],
      imgSrc: [
        "'self'",
        "data:",
        "blob:",
        "https://*.supabase.co",
        "https://res.cloudinary.com",
        "https://images.unsplash.com",
        "https://ui-avatars.com",
        "https://avatars.githubusercontent.com",
        "https://www.google-analytics.com",
        "https://www.googletagmanager.com",
      ],
      connectSrc: [
        "'self'",
        "https://*.supabase.co",
        "wss://*.supabase.co",                  // Supabase Realtime
        "https://www.google-analytics.com",
        "https://analytics.google.com",
        "https://*.google-analytics.com",
      ],
    },
  },
  // Cho phép dùng Bootstrap CDN
  crossOriginEmbedderPolicy: false,
}));

// CORS — chỉ cho phép frontend của chính mình
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.FRONTEND_URL].filter(Boolean)
  : ['http://localhost:3000', 'http://127.0.0.1:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Cho phép request không có origin (Postman, server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// ──────────────────────────────────────────────
// 2. Rate Limiting
// ──────────────────────────────────────────────

// General API rate limit
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Quá nhiều request, vui lòng thử lại sau.' },
});

// Strict limit cho AI endpoint (tốn token)
const aiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 phút
  max: 10,
  message: { error: 'Giới hạn 10 yêu cầu AI mỗi phút.' },
});

// ──────────────────────────────────────────────
// 3. Body Parsing
// ──────────────────────────────────────────────

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ──────────────────────────────────────────────
// 4. Bảo vệ file nội bộ — KHÔNG để lộ
// ──────────────────────────────────────────────

// Block bất kỳ request nào cố truy cập file backend/config
app.use((req, res, next) => {
  const blockedPrefixes = ['/server', '/supabase', '/.env', '/package.json', '/package-lock.json', '/node_modules'];
  const lowerPath = req.path.toLowerCase();
  if (blockedPrefixes.some(prefix => lowerPath === prefix || lowerPath.startsWith(prefix + '/'))) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
});

// ──────────────────────────────────────────────
// 5. Serve Static Files (public/ ONLY)
// ──────────────────────────────────────────────

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
app.use(express.static(PUBLIC_DIR, {
  // Không serve index tự động cho thư mục con
  index: 'index.html',
  // Cache tĩnh 1 giờ
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
  setHeaders: (res, filePath) => {
    if (process.env.NODE_ENV !== 'production' || filePath.endsWith('.js') || filePath.endsWith('.css')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  },
}));

// ──────────────────────────────────────────────
// 6. API Routes
// ──────────────────────────────────────────────

app.use('/api', apiLimiter);
app.use('/api/ai/chat', aiLimiter);

// Public frontend config (CHỈ chứa public anon key và URL — TUYỆT ĐỐI KHÔNG chứa service role key)
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString(),
  });
});

// SEO Crawlers & Sitemaps
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.sendFile(path.join(PUBLIC_DIR, 'robots.txt'));
});

app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml');
  res.sendFile(path.join(PUBLIC_DIR, 'sitemap.xml'));
});

app.use('/api/ai',       require('./routes/ai'));
app.use('/api/github',   require('./routes/github'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/upload',   require('./routes/upload'));
app.use('/api/admin',    require('./routes/admin'));

// ──────────────────────────────────────────────
// 7. Clean URL Routing — ánh xạ route tên sạch sang file HTML
// ──────────────────────────────────────────────

// Bản đồ route sạch → tệp HTML tương ứng trong public/
const CLEAN_URL_MAP = {
  '/':                  'index.html',
  '/home':              'index.html',
  '/dashboard':         'dashboard.html',
  '/projects':          'projects.html',
  '/workspace':         'workspace.html',
  '/profile':           'profile.html',
  '/login':             'login.html',
  '/register':          'register.html',
  '/create-project':    'create-project.html',
  '/edit-project':      'edit-project.html',
  '/project-detail':    'project-detail.html',
  '/matching':          'matching.html',
  '/notifications':     'notifications.html',
  '/portfolio':         'portfolio.html',
  '/admin':             'admin.html',
  '/guide':             'guide.html',
  '/faq':               'faq.html',
  '/contact':           'contact.html',
  '/privacy':           'privacy.html',
  '/terms':             'terms.html',
};

app.use((req, res, next) => {
  if (req.method !== 'GET') return next();

  // Nếu là API request không khớp → 404 JSON
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }

  // Route không có extension: chỉ phục vụ nếu có trong bản đồ đã định nghĩa
  if (!req.path.includes('.')) {
    // Chuẩn hóa path: bỏ trailing slash (trừ root)
    const normalizedPath = req.path.length > 1 ? req.path.replace(/\/$/, '') : req.path;
    const htmlFile = CLEAN_URL_MAP[normalizedPath];
    if (htmlFile) {
      return res.sendFile(path.join(PUBLIC_DIR, htmlFile));
    }
    // Path sạch không rõ → 404 thay vì phục vụ sai trang
    return res.status(404).sendFile(path.join(PUBLIC_DIR, 'index.html'));
  }

  next();
});

// ──────────────────────────────────────────────
// 8. Global Error Handler
// ──────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const isDev = process.env.NODE_ENV !== 'production';

  console.error(`[${new Date().toISOString()}] ${err.message}`);

  res.status(statusCode).json({
    error: err.message || 'Internal Server Error',
    // Chỉ trả stack trace khi development
    ...(isDev && { stack: err.stack }),
  });
});

// ──────────────────────────────────────────────
// 9. Start
// ──────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 ProjectHub server running at http://localhost:${PORT}`);
  console.log(`📁 Serving static files from: ${PUBLIC_DIR}`);
  console.log(`🔒 Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
