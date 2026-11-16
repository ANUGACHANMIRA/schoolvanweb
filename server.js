const express = require('express');
const session = require('express-session');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { getDb } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Ensure public upload directory exists
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'slide-' + uniqueSuffix + ext);
  }
});

// Multer file filter (validate image type) & limits (max 5MB)
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMime.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPG, PNG, and WebP are allowed.'));
    }
  }
});

// Template engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session Configuration
app.use(session({
  secret: 'safe-ride-secret-key-super-secure-2026',
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  }
}));

// Route helpers & DB loader
let db = null;
app.use(async (req, res, next) => {
  if (!db) {
    db = await getDb();
  }
  res.locals.currentPath = req.path;
  res.locals.isAdmin = !!req.session.adminId;
  next();
});

// Auth Guard for Admin routes
function requireAuth(req, res, next) {
  if (req.session && req.session.adminId) {
    return next();
  }
  if (req.xhr || req.path.startsWith('/api') || req.headers.accept?.includes('application/json')) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }
  res.redirect('/admin/login');
}

/* ==========================================================================
   PUBLIC WEBSITE ROUTES
   ========================================================================== */

// 1. Home Page (/)
app.get('/', (req, res) => {
  try {
    const slides = db.prepare(`
      SELECT * FROM slides 
      WHERE is_active = 1 
      ORDER BY sort_order ASC, id ASC
    `).all();

    const news = db.prepare(`
      SELECT * FROM news 
      ORDER BY id DESC 
      LIMIT 3
    `).all();

    res.render('index', {
      title: 'සමස්ත ලංකා පාසල් ළමුන් ප්‍රවාහන සංගමය',
      slides,
      news
    });
  } catch (err) {
    console.error('Error rendering homepage:', err);
    res.status(500).send('Server Error');
  }
});

// 2. About Us (/about)
app.get('/about', (req, res) => {
  res.render('about', {
    title: 'About Us'
  });
});

// 3. News (/news)
app.get('/news', (req, res) => {
  try {
    const news = db.prepare(`
      SELECT * FROM news 
      ORDER BY id DESC
    `).all();

    res.render('news', {
      title: 'News & Updates',
      news
    });
  } catch (err) {
    console.error('Error rendering news page:', err);
    res.status(500).send('Server Error');
  }
});

// 4. Contact Us (/contact)
app.get('/contact', (req, res) => {
  res.render('contact', {
    title: 'Contact Us'
  });
});

// Contact Form submission API
app.post('/api/contact', (req, res) => {
  try {
    const { name, phone, email, message } = req.body;
    if (!name || !email || !message) {
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(400).json({ success: false, error: 'Name, email, and message are required.' });
      }
      return res.redirect('/contact?error=Missing%20required%20fields');
    }

    db.prepare(`
      INSERT INTO messages (name, phone, email, message)
      VALUES (?, ?, ?, ?)
    `).run(name.trim(), (phone || '').trim(), email.trim(), message.trim());

    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.json({
        success: true,
        message: 'Thank you! Your message has been received. Our team will contact you shortly.'
      });
    }
    res.redirect('/contact?msg=Your%20message%20has%20been%20sent%20successfully!');
  } catch (err) {
    console.error('Error saving contact message:', err);
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(500).json({ success: false, error: 'Server error saving inquiry.' });
    }
    res.redirect('/contact?error=Server%20error');
  }
});

/* ==========================================================================
   ADMIN AUTHENTICATION ROUTES
   ========================================================================== */

// Admin Login Page
app.get('/admin/login', (req, res) => {
  if (req.session && req.session.adminId) {
    return res.redirect('/admin');
  }
  const error = req.query.error ? decodeURIComponent(req.query.error) : null;
  res.render('admin/login', { error });
});

// Admin Login POST
app.post('/admin/login', (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.redirect('/admin/login?error=Please%20provide%20both%20username%20and%20password');
    }

    const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username.trim());
    if (!admin) {
      return res.redirect('/admin/login?error=Invalid%20username%20or%20password');
    }

    const isMatch = bcrypt.compareSync(password, admin.password_hash);
    if (!isMatch) {
      return res.redirect('/admin/login?error=Invalid%20username%20or%20password');
    }

    // Set Session
    req.session.adminId = admin.id;
    req.session.username = admin.username;

    res.redirect('/admin');
  } catch (err) {
    console.error('Login error:', err);
    res.redirect('/admin/login?error=Authentication%20failed');
  }
});

// Admin Logout
app.get('/admin/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/admin/login?error=' + encodeURIComponent('You have been logged out.'));
  });
});

/* ==========================================================================
   ADMIN DASHBOARD & SLIDESHOW MANAGER ROUTES (PROTECTED)
   ========================================================================== */

function getAdminStats() {
  const totalSlides = db.prepare('SELECT COUNT(*) as c FROM slides').get().c;
  const activeSlides = db.prepare('SELECT COUNT(*) as c FROM slides WHERE is_active = 1').get().c;
  const totalMessages = db.prepare('SELECT COUNT(*) as c FROM messages').get().c;
  const unreadMessages = db.prepare('SELECT COUNT(*) as c FROM messages WHERE is_read = 0').get().c;
  const totalNews = db.prepare('SELECT COUNT(*) as c FROM news').get().c;
  return { totalSlides, activeSlides, totalMessages, unreadMessages, totalNews };
}

// 1. Admin Dashboard (Slides tab)
app.get('/admin', requireAuth, (req, res) => {
  try {
    const slides = db.prepare(`
      SELECT * FROM slides 
      ORDER BY sort_order ASC, id ASC
    `).all();

    const stats = getAdminStats();
    const successMsg = req.query.msg ? decodeURIComponent(req.query.msg) : null;
    const errorMsg = req.query.err ? decodeURIComponent(req.query.err) : null;

    res.render('admin/dashboard', {
      activeTab: 'slides',
      slides,
      stats,
      successMsg,
      errorMsg
    });
  } catch (err) {
    console.error('Admin dashboard error:', err);
    res.status(500).send('Server Error');
  }
});

// 2. Admin Messages Tab
app.get('/admin/messages', requireAuth, (req, res) => {
  try {
    const messages = db.prepare(`
      SELECT * FROM messages 
      ORDER BY id DESC
    `).all();

    const stats = getAdminStats();
    const successMsg = req.query.msg ? decodeURIComponent(req.query.msg) : null;
    const errorMsg = req.query.err ? decodeURIComponent(req.query.err) : null;

    res.render('admin/dashboard', {
      activeTab: 'messages',
      messages,
      stats,
      successMsg,
      errorMsg
    });
  } catch (err) {
    console.error('Admin messages error:', err);
    res.status(500).send('Server Error');
  }
});

// 3. Admin News Tab
app.get('/admin/news', requireAuth, (req, res) => {
  try {
    const news = db.prepare(`
      SELECT * FROM news 
      ORDER BY id DESC
    `).all();

    const stats = getAdminStats();
    const successMsg = req.query.msg ? decodeURIComponent(req.query.msg) : null;
    const errorMsg = req.query.err ? decodeURIComponent(req.query.err) : null;

    res.render('admin/dashboard', {
      activeTab: 'news',
      news,
      stats,
      successMsg,
      errorMsg
    });
  } catch (err) {
    console.error('Admin news error:', err);
    res.status(500).send('Server Error');
  }
});

// Upload Slide(s)
app.post('/admin/slides/upload', requireAuth, upload.array('slideImages', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.redirect('/admin?err=Please%20select%20at%20least%20one%20image%20to%20upload.');
    }

    let duration = parseInt(req.body.duration_seconds, 10);
    if (isNaN(duration) || duration < 1) duration = 5;
    if (duration > 60) duration = 60;

    const title = (req.body.title || '').trim();
    const caption = (req.body.caption || '').trim();

    // Get current maximum sort_order
    const maxOrderRow = db.prepare('SELECT MAX(sort_order) as maxOrder FROM slides').get();
    let nextOrder = (maxOrderRow && maxOrderRow.maxOrder !== null) ? maxOrderRow.maxOrder + 1 : 1;

    for (const file of req.files) {
      const imagePath = '/uploads/' + file.filename;
      db.prepare(`
        INSERT INTO slides (image_path, duration_seconds, sort_order, is_active, title, caption)
        VALUES (?, ?, ?, 1, ?, ?)
      `).run(imagePath, duration, nextOrder, title, caption);
      nextOrder++;
    }

    res.redirect('/admin?msg=' + encodeURIComponent(`${req.files.length} slide image(s) uploaded successfully!`));
  } catch (err) {
    console.error('Slide upload error:', err);
    res.redirect('/admin?err=' + encodeURIComponent(err.message || 'Error uploading slides.'));
  }
});

// Slide Duration API Update
app.post('/admin/api/slides/:id/duration', requireAuth, (req, res) => {
  try {
    const slideId = parseInt(req.params.id, 10);
    let duration = parseInt(req.body.duration_seconds, 10);
    if (isNaN(duration) || duration < 1) duration = 1;
    if (duration > 60) duration = 60;

    db.prepare('UPDATE slides SET duration_seconds = ? WHERE id = ?').run(duration, slideId);
    res.json({ success: true, duration_seconds: duration });
  } catch (err) {
    console.error('Duration update error:', err);
    res.status(500).json({ success: false, error: 'Database update failed' });
  }
});

// Toggle Active/Inactive API
app.post('/admin/api/slides/:id/toggle-active', requireAuth, (req, res) => {
  try {
    const slideId = parseInt(req.params.id, 10);
    const slide = db.prepare('SELECT is_active FROM slides WHERE id = ?').get(slideId);
    if (!slide) {
      return res.status(404).json({ success: false, error: 'Slide not found' });
    }

    const newStatus = slide.is_active === 1 ? 0 : 1;
    db.prepare('UPDATE slides SET is_active = ? WHERE id = ?').run(newStatus, slideId);
    res.json({ success: true, is_active: newStatus });
  } catch (err) {
    console.error('Toggle status error:', err);
    res.status(500).json({ success: false, error: 'Database update failed' });
  }
});

// Reorder Slide API (Up / Down)
app.post('/admin/api/slides/:id/reorder', requireAuth, (req, res) => {
  try {
    const slideId = parseInt(req.params.id, 10);
    const { direction } = req.body; // 'up' or 'down'

    const allSlides = db.prepare('SELECT id, sort_order FROM slides ORDER BY sort_order ASC, id ASC').all();
    const currIdx = allSlides.findIndex(s => s.id === slideId);

    if (currIdx === -1) {
      return res.status(404).json({ success: false, error: 'Slide not found' });
    }

    let targetIdx = -1;
    if (direction === 'up' && currIdx > 0) {
      targetIdx = currIdx - 1;
    } else if (direction === 'down' && currIdx < allSlides.length - 1) {
      targetIdx = currIdx + 1;
    }

    if (targetIdx !== -1) {
      const currentSlide = allSlides[currIdx];
      const targetSlide = allSlides[targetIdx];

      // Swap sort orders
      const tempOrder = currentSlide.sort_order;
      let newCurrentOrder = targetSlide.sort_order;
      let newTargetOrder = tempOrder;

      // Handle identical sort_orders
      if (newCurrentOrder === newTargetOrder) {
        newCurrentOrder = targetIdx + 1;
        newTargetOrder = currIdx + 1;
      }

      db.prepare('UPDATE slides SET sort_order = ? WHERE id = ?').run(newCurrentOrder, currentSlide.id);
      db.prepare('UPDATE slides SET sort_order = ? WHERE id = ?').run(newTargetOrder, targetSlide.id);
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Reorder error:', err);
    res.status(500).json({ success: false, error: 'Failed to reorder' });
  }
});

// Delete Slide API (deletes record and disk file)
app.delete('/admin/api/slides/:id', requireAuth, (req, res) => {
  try {
    const slideId = parseInt(req.params.id, 10);
    const slide = db.prepare('SELECT image_path FROM slides WHERE id = ?').get(slideId);

    if (!slide) {
      return res.status(404).json({ success: false, error: 'Slide not found' });
    }

    // Delete record from DB
    db.prepare('DELETE FROM slides WHERE id = ?').run(slideId);

    // If uploaded image exists on disk, remove it safely
    if (slide.image_path.startsWith('/uploads/')) {
      const filename = path.basename(slide.image_path);
      const filePath = path.join(uploadDir, filename);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
          console.log('Deleted disk file:', filePath);
        } catch (unlinkErr) {
          console.warn('Could not remove file on disk:', unlinkErr.message);
        }
      }
    }

    res.json({ success: true, message: 'Slide deleted successfully' });
  } catch (err) {
    console.error('Delete slide error:', err);
    res.status(500).json({ success: false, error: 'Database delete failed' });
  }
});

// Delete Contact Message
app.post('/admin/messages/:id/delete', requireAuth, (req, res) => {
  try {
    const msgId = parseInt(req.params.id, 10);
    db.prepare('DELETE FROM messages WHERE id = ?').run(msgId);
    res.redirect('/admin/messages?msg=Message%20deleted');
  } catch (err) {
    console.error('Delete message error:', err);
    res.redirect('/admin/messages?err=Error%20deleting%20message');
  }
});

// Create News Post
app.post('/admin/news/create', requireAuth, (req, res) => {
  try {
    const { title, date, summary, content } = req.body;
    if (!title || !content) {
      return res.redirect('/admin/news?err=Title%20and%20content%20required');
    }
    db.prepare(`
      INSERT INTO news (title, date, summary, content, image_url)
      VALUES (?, ?, ?, ?, ?)
    `).run(title.trim(), date || new Date().toLocaleDateString(), summary.trim(), content.trim(), '/images/news-fleet.svg');

    res.redirect('/admin/news?msg=News%20post%20published%20successfully!');
  } catch (err) {
    console.error('Create news error:', err);
    res.redirect('/admin/news?err=Error%20publishing%20news');
  }
});

// Delete News Post
app.post('/admin/news/:id/delete', requireAuth, (req, res) => {
  try {
    const newsId = parseInt(req.params.id, 10);
    db.prepare('DELETE FROM news WHERE id = ?').run(newsId);
    res.redirect('/admin/news?msg=News%20post%20deleted');
  } catch (err) {
    console.error('Delete news error:', err);
    res.redirect('/admin/news?err=Error%20deleting%20news');
  }
});

// 404 Handler
app.use((req, res) => {
  res.status(404).render('contact', {
    title: 'Page Not Found',
    error: 'The requested page could not be located.'
  });
});

// Start Server
async function start() {
  db = await getDb();
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(` සමස්ත ලංකා පාසල් ළමුන් ප්‍රවාහන සංගමය - Server Running `);
    console.log(` - Website: http://localhost:${PORT}                `);
    console.log(` - Admin:   http://localhost:${PORT}/admin          `);
    console.log(` - Default Login: admin / admin123                  `);
    console.log(`====================================================`);
  });
}

start();

module.exports = app;
