/**
 * Production Web Server for "زاد الأنصاري" (مشورة إب)
 * Optimized for Linux hosting (Ubuntu/Debian/CentOS/Docker)
 * Compatible with Express 4.x and Express 5.x
 */

const express = require('express');
const compression = require('compression');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(__dirname, 'dist');

// Enable Gzip / Deflate compression
app.use(compression());

// Security & Optimization Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Health check endpoint for uptime monitoring & load balancers
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    app: 'زاد الأنصاري - مشورة إب',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Verify dist folder exists
if (!fs.existsSync(DIST_DIR)) {
  console.warn('\x1b[33m%s\x1b[0m', '⚠️  تحذير: مجلد dist غير موجود! يرجى تشغيل npm run build:web أولاً.');
}

// Serve static assets with aggressive caching for hashed assets
app.use(
  express.static(DIST_DIR, {
    maxAge: '1y',
    immutable: true,
    setHeaders: (res, filePath) => {
      // index.html should not be aggressively cached to ensure immediate updates
      if (filePath.endsWith('index.html') || filePath.endsWith('metadata.json')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    }
  })
);

// SPA Fallback: Universal handler for all unmatched requests (Express 4 & 5 safe)
app.use((req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed');
  }
  const indexPath = path.join(DIST_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send(`
      <div style="font-family: sans-serif; text-align: center; padding: 50px; direction: rtl;">
        <h2>زاد الأنصاري - مشورة إب</h2>
        <p style="color: #666;">لم يتم العثور على ملفات البناء (Build Files).</p>
        <p>يرجى تشغيل أمر البناء في الخادم:</p>
        <code style="background: #eee; padding: 8px 16px; border-radius: 4px; display: inline-block;">npm run build:web</code>
      </div>
    `);
  }
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('\x1b[32m%s\x1b[0m', '==================================================');
  console.log('\x1b[32m%s\x1b[0m', ` 🚀 تطبيق "زاد الأنصاري" يعمل بنجاح على خادم لينكس`);
  console.log('\x1b[36m%s\x1b[0m', ` 🌐 المنفذ (Port): http://localhost:${PORT}`);
  console.log('\x1b[36m%s\x1b[0m', ` 🩺 فحص الحالة (Health): http://localhost:${PORT}/health`);
  console.log('\x1b[32m%s\x1b[0m', '==================================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('إشارة SIGTERM مستلمة. إغلاق السيرفر بلطف...');
  server.close(() => {
    console.log('تم إيقاف السيرفر.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('إشارة SIGINT مستلمة. إغلاق السيرفر بلطف...');
  server.close(() => {
    console.log('تم إيقاف السيرفر.');
    process.exit(0);
  });
});
