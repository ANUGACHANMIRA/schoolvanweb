# Safe Ride School Vans - Business Website & Admin Management System

A complete, modern, responsive website and administrative content management system for a professional **School Van Service** business.

Built with **Node.js**, **Express**, **SQLite** database, **EJS** server-rendered templates, and vanilla JavaScript and CSS (School Bus Yellow `#FFC20E` & Dark Navy `#0B1F3A` theme).

---

## Features

### Public Website
- **Sticky Navigation Bar:**
  - Slim top bar with company tagline, dispatch hotline `(555) 392-8267`, and direct email link.
  - Sticky navbar with brand logo + title, active page indicator, phone number, "Call Now" action button, and a mobile-responsive collapsible hamburger menu.
- **Home Page (`/`):**
  - **Full-Width Hero Slideshow Engine:**
    - Variable display duration per slide configured by admin in seconds.
    - Automatic looping and smooth fade transitions.
    - Indicators / progress dots and Previous / Next arrow controls.
    - **Pause on Hover:** automatically pauses when hovered and resumes upon mouse leave.
    - Content overlay with badge, headline, and "Book a Seat" call-to-action button.
    - Fallback placeholder gradient/image if no slides are uploaded yet.
  - **"Why Choose Us" Pillars:** Safety First, Vetted & Certified Drivers, Live GPS Parent Tracking, 99.4% Punctuality.
  - **Services & Routes Summary:** Door-to-Door, Single-Leg (AM/PM), and After-School Activity Shuttles.
  - **Latest News Preview:** Displays the 3 latest announcements dynamically fetched from the database.
  - **Call-To-Action Banner:** Quick reservation banner with direct contact links.
  - **Footer:** Quick links, route services, dispatch yard address, working hours, and copyright.
- **About Us Page (`/about`):**
  - Company heritage, journey, and core mission.
  - 4-point safety protocols (daily 20-point mechanical check, FBI fingerprint vetting, pediatric CPR, dual cameras).
  - Vehicle fleet specifications (climate control, 3-point seatbelts, child locks, UV sanitization).
- **News Page (`/news`):**
  - Chronological list of announcements, route openings, and fleet inspection bulletins.
- **Contact Us Page (`/contact`):**
  - Contact form (Name, Phone, Email, Message) that saves submissions directly to SQLite `messages` table with instant feedback.
  - Contact details (dispatch phone, email, headquarters address, operating hours).
  - Embedded Google Map placeholder highlighting the service zone.

### Admin Panel (`/admin`)
- **Protected Session Authentication:**
  - Login portal at `/admin/login`.
  - Password hashing via `bcrypt`.
  - Protected admin routes with session validation and automatic redirect if unauthenticated.
  - Logout functionality.
- **Slideshow Manager (Core Feature):**
  - **Upload Slides:** Upload 1 or more images (JPG, PNG, WebP) up to 5MB with instant client preview.
  - **Customizable Duration:** Per-slide number input (1 to 60 seconds) with instant AJAX update and immediate effect on the homepage.
  - **Slide Ordering:** Up & Down buttons to reorder slides.
  - **Active / Inactive Toggle:** Hide slides from the homepage without deleting them.
  - **Permanent Deletion:** Delete button with confirmation modal (removes record and purges file from `/uploads`).
  - **Optional Metadata:** Caption and title fields for each slide.
  - **Real-Time Feedback:** Toast notification system for success and error states.
- **Contact Submissions Inbox (`/admin/messages`):**
  - Real-time review of inquiries submitted through the contact form, with unread indicators and deletion controls.
- **News & Announcements Manager (`/admin/news`):**
  - Publish new announcements and delete outdated posts.

---

## Default Admin Credentials

- **URL:** `http://localhost:3000/admin`
- **Username:** `admin`
- **Password:** `admin123`

*(Note: In a production deployment, please update the admin password after initial setup).*

---

## Installation & Running

### Prerequisites
- Node.js (v18 or higher recommended)
- npm

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Application
```bash
npm start
```
The server will start on port `3000`:
- Public Website: [http://localhost:3000](http://localhost:3000)
- Admin Login: [http://localhost:3000/admin/login](http://localhost:3000/admin/login)

---

## Tech Stack & Architecture

- **Backend:** Node.js, Express, `express-session`, `multer` (file uploads)
- **Database:** SQLite (`data/database.sqlite`) via `sql.js` (WebAssembly SQLite) with fallback/support for `better-sqlite3`.
- **Security:** `bcryptjs` password hashing, input sanitization, file type & size limits (5MB, image only).
- **Templating:** EJS with reusable partials (`header.ejs`, `footer.ejs`).
- **Styling & Client:** Pure custom CSS (`public/css/style.css`) with CSS custom properties, responsive grid, flexbox, and vanilla JavaScript (`main.js`, `admin.js`).

---

## Database Schema

- `admins`: `id`, `username`, `password_hash`, `created_at`
- `slides`: `id`, `image_path`, `duration_seconds`, `sort_order`, `is_active`, `title`, `caption`, `created_at`
- `news`: `id`, `title`, `content`, `date`, `summary`, `image_url`, `created_at`
- `messages`: `id`, `name`, `phone`, `email`, `message`, `is_read`, `created_at`

---

## Project Structure

```
school-van-service/
├── data/
│   └── database.sqlite        # SQLite database file
├── public/
│   ├── css/
│   │   └── style.css          # School bus yellow & navy master styles
│   ├── js/
│   │   ├── main.js            # Slideshow engine, mobile nav, contact AJAX
│   │   └── admin.js           # Upload preview, duration update, reorder
│   ├── images/
│   │   ├── logo.svg           # Vector branding logo
│   │   ├── default-slide.svg  # Fallback hero slide
│   │   ├── news-*.svg         # Vector graphics for news items
│   │   └── slides/            # Default seeded hero slide vectors
│   └── uploads/               # Uploaded slideshow images
├── views/
│   ├── partials/
│   │   ├── header.ejs         # Top bar, sticky navbar, mobile hamburger
│   │   └── footer.ejs         # Footer links & dispatch details
│   ├── admin/
│   │   ├── login.ejs          # Admin login form
│   │   └── dashboard.ejs      # Slideshow manager, messages & news tabs
│   ├── index.ejs              # Home page with hero slideshow & sections
│   ├── about.ejs              # About Us page with safety & fleet info
│   ├── news.ejs               # News & route updates
│   └── contact.ejs            # Contact form & map
├── database.js                # SQLite setup, schema initialization & seed data
├── server.js                  # Express application & API routing
├── package.json               # Dependencies & scripts
└── README.md                  # Setup & usage instructions
```
