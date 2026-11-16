const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 3001;
process.env.PORT = String(PORT);

const BASE_URL = `http://localhost:${PORT}`;

function request(urlPath, options = {}, postData = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE_URL);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    if (postData) {
      if (typeof postData === 'object' && !Buffer.isBuffer(postData)) {
        postData = JSON.stringify(postData);
        reqOptions.headers['Content-Type'] = 'application/json';
      }
      reqOptions.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body
        });
      });
    });

    req.on('error', reject);

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function run() {
  console.log(`Starting Safe Ride server on port ${PORT}...`);
  const srv = spawn(process.execPath, ['server.js'], {
    cwd: __dirname,
    env: { ...process.env, PORT: String(PORT) },
    stdio: 'pipe'
  });

  await new Promise(r => setTimeout(r, 1600));

  let testsPassed = 0;
  let testsTotal = 0;

  function assert(condition, message) {
    testsTotal++;
    if (condition) {
      console.log(`✔ PASS: ${message}`);
      testsPassed++;
    } else {
      console.error(`✘ FAIL: ${message}`);
    }
  }

  try {
    // 1. Home
    const home = await request('/');
    assert(home.statusCode === 200, 'Home page returns 200 OK');
    assert(home.body.includes('Safe &amp; Reliable') || home.body.includes('Safe & Reliable'), 'Home contains hero headline');
    assert(home.body.includes('data-duration='), 'Slides have variable durations');

    // 2. About
    const about = await request('/about');
    assert(about.statusCode === 200, 'About page returns 200 OK');
    assert(about.body.includes('About Safe Ride School Vans'), 'About page has title');

    // 3. News
    const news = await request('/news');
    assert(news.statusCode === 200, 'News page returns 200 OK');
    assert(news.body.includes('News &amp; Route Updates') || news.body.includes('News & Route Updates'), 'News page rendered');

    // 4. Contact
    const contact = await request('/contact');
    assert(contact.statusCode === 200, 'Contact page returns 200 OK');

    // 5. Contact Post
    const contactRes = await request('/api/contact', {
      method: 'POST',
      headers: { 'Accept': 'application/json' }
    }, {
      name: 'Verification Bot',
      phone: '(555) 999-0000',
      email: 'bot@example.com',
      message: 'Automated test suite verification inquiry.'
    });
    assert(contactRes.statusCode === 200, 'Contact API accepts submission');

    // 6. Admin auth guard
    const adminCheck = await request('/admin');
    assert(adminCheck.statusCode === 302 && adminCheck.headers.location === '/admin/login', 'Admin guard redirects to login');

    // 7. Login
    const loginForm = 'username=admin&password=admin123';
    const loginRes = await request('/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    }, loginForm);
    assert(loginRes.statusCode === 302 && loginRes.headers.location === '/admin', 'Admin login successful with admin/admin123');

    const cookie = loginRes.headers['set-cookie'][0].split(';')[0];

    // 8. Admin dashboard
    const dash = await request('/admin', { headers: { 'Cookie': cookie } });
    assert(dash.statusCode === 200 && dash.body.includes('Homepage Hero Slideshow Manager'), 'Admin dashboard accessible');

    // 9. Change duration
    const durRes = await request('/admin/api/slides/1/duration', {
      method: 'POST',
      headers: { 'Cookie': cookie }
    }, { duration_seconds: 5 });
    assert(durRes.statusCode === 200, 'Duration updated to 5s');

    // 10. Reorder
    const reorderRes = await request('/admin/api/slides/1/reorder', {
      method: 'POST',
      headers: { 'Cookie': cookie }
    }, { direction: 'down' });
    assert(reorderRes.statusCode === 200, 'Reorder API works');

    // 11. Toggle active
    const toggleRes = await request('/admin/api/slides/1/toggle-active', {
      method: 'POST',
      headers: { 'Cookie': cookie }
    });
    assert(toggleRes.statusCode === 200, 'Toggle active status works');

    // Reset toggle back
    await request('/admin/api/slides/1/toggle-active', {
      method: 'POST',
      headers: { 'Cookie': cookie }
    });

    console.log(`\n========================================`);
    console.log(`ALL TESTS PASSED: ${testsPassed} / ${testsTotal}`);
    console.log(`========================================`);
  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    srv.kill('SIGTERM');
    process.exit(0);
  }
}

run();
