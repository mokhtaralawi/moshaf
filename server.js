/**
 * Production Web & Cloud Database Server for "زاد الأنصاري" (مشورة إب)
 * يدعم استضافة الويب + توفير API سحابي لمزامنة جميع أجهزة الفريق لحظياً
 */

const express = require('express');
const compression = require('compression');
const path = require('path');
const fs = require('fs');
const cloudDb = require('./server/database');

const app = express();
const PORT = process.env.PORT || 3000;
const DIST_DIR = path.join(__dirname, 'dist');

// Enable Gzip / Deflate compression
app.use(compression());

// Parse JSON bodies
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS & Security Headers
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// ==========================================
// 🌐 Cloud Database & Sync API Endpoints
// ==========================================

// Health & Status check
app.get('/health', (req, res) => {
  const state = cloudDb.getState();
  res.status(200).json({
    status: 'ok',
    app: 'زاد الأنصاري - مشورة إب',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: {
      lastModified: state.lastModified,
      readersCount: state.readers ? state.readers.length : 0,
      tasksCount: state.tasks ? state.tasks.length : 0,
    },
  });
});

// 1. Get latest cloud database state
app.get('/api/sync', (req, res) => {
  try {
    const state = cloudDb.getState();
    res.status(200).json({
      success: true,
      lastModified: state.lastModified,
      data: state,
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Submit actions queue for atomic sync
app.post('/api/sync', (req, res) => {
  try {
    const { actions = [], partialState = null } = req.body;

    if (actions && Array.isArray(actions) && actions.length > 0) {
      const result = cloudDb.applyActions(actions);
      return res.status(200).json(result);
    }

    if (partialState) {
      const updatedState = cloudDb.mergeState(partialState);
      return res.status(200).json({
        success: true,
        lastModified: updatedState.lastModified,
        state: updatedState,
      });
    }

    // إذا لم تكن هناك عمليات جديدة، إرجاع الحالة الحالية
    const state = cloudDb.getState();
    res.status(200).json({
      success: true,
      modified: false,
      lastModified: state.lastModified,
      state,
    });
  } catch (err) {
    console.error('API Sync Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Export complete database backup
app.get('/api/export', (req, res) => {
  try {
    const state = cloudDb.getState();
    res.setHeader('Content-Disposition', 'attachment; filename=zad_database_backup.json');
    res.setHeader('Content-Type', 'application/json');
    res.send(JSON.stringify(state, null, 2));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Restore database backup
app.post('/api/restore', (req, res) => {
  try {
    const backupData = req.body;
    if (!backupData || !backupData.readers) {
      return res.status(400).json({ success: false, message: 'ملف النسخة الاحتياطية غير صالح' });
    }
    const state = cloudDb.mergeState(backupData);
    res.status(200).json({ success: true, message: 'تمت استعادة البيانات بنجاح', lastModified: state.lastModified });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==========================================
// 📱 Web Frontend Static Serving
// ==========================================

// Verify dist folder exists
if (!fs.existsSync(DIST_DIR)) {
  console.warn('\x1b[33m%s\x1b[0m', '⚠️  تحذير: مجلد dist غير موجود! يرجى تشغيل npm run build:web أولاً إذا كنت تريد استضافة الويب.');
}

// Serve static assets with aggressive caching for hashed assets
app.use(
  express.static(DIST_DIR, {
    maxAge: '1y',
    immutable: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('index.html') || filePath.endsWith('metadata.json')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  })
);

// SPA Fallback: Universal handler for all unmatched requests
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
        <p style="color: #666;">خادم الـ API وقاعدة البيانات يعمل بنجاح 🟢</p>
        <p>لم يتم العثور على ملفات واجهة الويب (dist). لتشغيل واجهة الويب قم بتنفيذ:</p>
        <code style="background: #eee; padding: 8px 16px; border-radius: 4px; display: inline-block;">npm run build:web</code>
      </div>
    `);
  }
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('\x1b[32m%s\x1b[0m', '==================================================');
  console.log('\x1b[32m%s\x1b[0m', ` 🚀 تطبيق وقاعدة بيانات "زاد الأنصاري" تعمل بنجاح`);
  console.log('\x1b[36m%s\x1b[0m', ` 🌐 المنفذ (Port): http://localhost:${PORT}`);
  console.log('\x1b[36m%s\x1b[0m', ` 🩺 فحص الحالة (Health): http://localhost:${PORT}/health`);
  console.log('\x1b[36m%s\x1b[0m', ` 🔄 مسار المزامنة (Sync API): http://localhost:${PORT}/api/sync`);
  console.log('\x1b[32m%s\x1b[0m', '==================================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  server.close(() => process.exit(0));
});
