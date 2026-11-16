const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const dbDir = path.join(__dirname, 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const dbPath = path.join(dbDir, 'database.sqlite');

let dbInstance = null;

class DatabaseWrapper {
  constructor() {
    this.type = null;
    this.rawDb = null;
  }

  async init() {
    // Attempt 1: Try better-sqlite3 if possible
    try {
      const BetterSqlite3 = require('better-sqlite3');
      this.rawDb = new BetterSqlite3(dbPath);
      this.type = 'better-sqlite3';
      console.log('Database initialized with better-sqlite3');
    } catch (err) {
      // Attempt 2: Fall back to sql.js (WebAssembly SQLite)
      const initSqlJs = require('sql.js');
      const SQL = await initSqlJs();
      if (fs.existsSync(dbPath)) {
        const fileBuffer = fs.readFileSync(dbPath);
        this.rawDb = new SQL.Database(fileBuffer);
      } else {
        this.rawDb = new SQL.Database();
        const data = this.rawDb.export();
        fs.writeFileSync(dbPath, Buffer.from(data));
      }
      this.type = 'sql.js';
      console.log('Database initialized with sql.js (pure WebAssembly SQLite)');
    }

    this.initTables();
    this.seedDefaultData();
    return this;
  }

  save() {
    if (this.type === 'sql.js') {
      try {
        const data = this.rawDb.export();
        fs.writeFileSync(dbPath, Buffer.from(data));
      } catch (e) {
        console.error('Error saving sql.js database:', e);
      }
    }
  }

  exec(sql) {
    if (this.type === 'better-sqlite3') {
      return this.rawDb.exec(sql);
    } else {
      this.rawDb.run(sql);
      this.save();
    }
  }

  prepare(sql) {
    if (this.type === 'better-sqlite3') {
      return this.rawDb.prepare(sql);
    }

    // sql.js wrapper matching better-sqlite3 statement interface
    const self = this;
    return {
      run(...params) {
        // Flatten params if passed as an array
        const args = (params.length === 1 && Array.isArray(params[0])) ? params[0] : params;
        self.rawDb.run(sql, args);
        self.save();
        
        let lastInsertRowid = 0;
        let changes = 0;
        try {
          const idRes = self.rawDb.exec("SELECT last_insert_rowid() as id, changes() as chg");
          if (idRes.length && idRes[0].values.length) {
            lastInsertRowid = idRes[0].values[0][0];
            changes = idRes[0].values[0][1];
          }
        } catch (e) {}

        return { changes, lastInsertRowid };
      },
      get(...params) {
        const args = (params.length === 1 && Array.isArray(params[0])) ? params[0] : params;
        const stmt = self.rawDb.prepare(sql);
        try {
          if (args && args.length) {
            stmt.bind(args);
          }
          if (stmt.step()) {
            const row = stmt.getAsObject();
            stmt.free();
            return row;
          }
          stmt.free();
          return undefined;
        } catch (err) {
          try { stmt.free(); } catch (_) {}
          throw err;
        }
      },
      all(...params) {
        const args = (params.length === 1 && Array.isArray(params[0])) ? params[0] : params;
        const stmt = self.rawDb.prepare(sql);
        const rows = [];
        try {
          if (args && args.length) {
            stmt.bind(args);
          }
          while (stmt.step()) {
            rows.push(stmt.getAsObject());
          }
          stmt.free();
          return rows;
        } catch (err) {
          try { stmt.free(); } catch (_) {}
          throw err;
        }
      }
    };
  }

  initTables() {
    this.exec(`
      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS slides (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_path TEXT NOT NULL,
        duration_seconds INTEGER DEFAULT 5,
        sort_order INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        caption TEXT,
        title TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS news (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        date TEXT NOT NULL,
        summary TEXT,
        image_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT NOT NULL,
        message TEXT NOT NULL,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  }

  seedDefaultData() {
    // 1. Seed Admin: admin / admin123
    const adminCheck = this.prepare('SELECT id FROM admins WHERE username = ?').get('admin');
    if (!adminCheck) {
      const hash = bcrypt.hashSync('admin123', 10);
      this.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run('admin', hash);
      console.log('Default admin seeded: admin / admin123');
    }

    // 2. Seed Slides if empty
    const slideCount = this.prepare('SELECT COUNT(*) as count FROM slides').get().count;
    if (slideCount === 0) {
      const defaultSlides = [
        {
          image_path: '/images/slides/slide1.svg',
          duration_seconds: 5,
          sort_order: 1,
          is_active: 1,
          title: 'Safe & Reliable School Transport',
          caption: 'GPS-tracked, climate-controlled vans operated by certified, background-checked professional drivers.'
        },
        {
          image_path: '/images/slides/slide2.svg',
          duration_seconds: 4,
          sort_order: 2,
          is_active: 1,
          title: 'Real-Time Parent Tracking & Alerts',
          caption: 'Stay connected with instant notifications on pickup, transit progress, and safe school arrivals.'
        },
        {
          image_path: '/images/slides/slide3.svg',
          duration_seconds: 6,
          sort_order: 3,
          is_active: 1,
          title: 'Comfortable & Modern Fleet',
          caption: 'Every van is equipped with three-point seat belts, first-aid kits, onboard cameras, and child safety locks.'
        }
      ];

      for (const slide of defaultSlides) {
        this.prepare(`
          INSERT INTO slides (image_path, duration_seconds, sort_order, is_active, title, caption)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(slide.image_path, slide.duration_seconds, slide.sort_order, slide.is_active, slide.title, slide.caption);
      }
      console.log('Default slides seeded');
    }

    // 3. Seed News if empty
    const newsCount = this.prepare('SELECT COUNT(*) as count FROM news').get().count;
    if (newsCount === 0) {
      const defaultNews = [
        {
          title: '2026 Fleet Modernization & Advanced GPS Upgrades',
          date: 'November 2, 2026',
          summary: 'We have updated our entire vehicle fleet with state-of-the-art live GPS telemetry and AI-assisted safety monitoring.',
          content: 'Safe Ride School Vans is proud to announce the completion of our 2026 fleet upgrade program. Every van in our active roster is now outfitted with dual HD dashcams, live real-time GPS sensors, automated maintenance logs, and emergency SOS buttons. Our parent portal now updates vehicle coordinates every 5 seconds for complete peace of mind.',
          image_url: '/images/news-fleet.svg'
        },
        {
          title: 'Annual Driver Safety & First-Aid Certification Complete',
          date: 'October 24, 2026',
          summary: 'All 48 drivers and van attendants completed comprehensive defensive driving, CPR, and pediatric first-aid renewal.',
          content: 'Safety is the core of everything we do. This past week, our complete driving personnel attended a mandatory 3-day intensive workshop led by state certified safety evaluators and Red Cross trainers. The curriculum included severe weather navigation, child psychology, defensive driving maneuvers, and emergency protocols.',
          image_url: '/images/news-training.svg'
        },
        {
          title: 'New Service Routes Added for North & East District Schools',
          date: 'October 10, 2026',
          summary: 'Expanding door-to-door pickup and drop services across 12 newly partnered primary and secondary schools.',
          content: 'Responding to widespread requests from parents and school administrations, we are pleased to launch 4 brand new dedicated morning and afternoon routes covering the North and East school districts. Seats are limited to ensure single-seat comfort for each child. Reserve your spot today via our contact form or hotline.',
          image_url: '/images/news-routes.svg'
        },
        {
          title: 'Winter Readiness & Seasonal Vehicle Inspections',
          date: 'September 28, 2026',
          summary: 'All school vans have passed strict multi-point safety inspections to ensure reliability during upcoming colder months.',
          content: 'Prior to seasonal weather shifts, each van underwent a 75-point mechanical inspection covering all-weather tire treads, brake performance, cabin heating, defrosters, and lighting. Parents can rest assured our fleet will maintain uninterrupted, punctual service in all weather conditions.',
          image_url: '/images/news-inspection.svg'
        }
      ];

      for (const item of defaultNews) {
        this.prepare(`
          INSERT INTO news (title, date, summary, content, image_url)
          VALUES (?, ?, ?, ?, ?)
        `).run(item.title, item.date, item.summary, item.content, item.image_url);
      }
      console.log('Default news seeded');
    }
  }
}

async function getDb() {
  if (!dbInstance) {
    dbInstance = new DatabaseWrapper();
    await dbInstance.init();
  }
  return dbInstance;
}

module.exports = {
  getDb
};
