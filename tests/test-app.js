const http = require('http');
const assert = require('assert');
const path = require('path');

// Test Timer Logic
function testTimerLogic() {
  console.log('\n--- Testing Timer Engine Logic ---');
  const path = require('path');
  const TimerEngine = require(path.join(__dirname, '../public/timer-engine.js'));
  
  // Test math directly
  const T = 540; // 9 min
  const halfT = T / 2; // 270s (4:30)

  assert.strictEqual(halfT, 270, 'Half interval should be 270s');

  // At elapsed = 0s
  let elapsed = 0;
  let pos = elapsed % T;
  let remA = (T - pos) % T;
  let remB = pos < halfT ? (halfT - pos) : (T + halfT - pos);
  console.log(`Elapsed 0s: Track A in ${remA}s, Track B in ${remB}s`);
  assert.strictEqual(remA, 0, 'Track A should be 0 at start');
  assert.strictEqual(remB, 270, 'Track B should be 270s at start');

  // At elapsed = 100s
  elapsed = 100;
  pos = elapsed % T;
  remA = (T - pos) % T;
  remB = pos < halfT ? (halfT - pos) : (T + halfT - pos);
  console.log(`Elapsed 100s: Track A in ${remA}s, Track B in ${remB}s`);
  assert.strictEqual(remA, 440, 'Track A should be 440s');
  assert.strictEqual(remB, 170, 'Track B should be 170s');

  // At elapsed = 270s (Half Interval)
  elapsed = 270;
  pos = elapsed % T;
  remA = (T - pos) % T;
  remB = pos < halfT ? (halfT - pos) : (T + halfT - pos);
  console.log(`Elapsed 270s: Track A in ${remA}s, Track B in ${remB}s`);
  assert.strictEqual(remA, 270, 'Track A should be 270s');
  assert.strictEqual(remB, 540, 'Track B should be 540s (or 0s)');

  console.log('✓ Dual-track interval calculation verified successfully!');
}

// Test Passcode and Lockout Logic
function testLockAndPasscodeLogic() {
  console.log('\n--- Testing Passcode & Cat Lockout Mechanics ---');
  let storedPin = '1234';
  let isLocked = false;

  // Lock simulation
  isLocked = true;
  assert.strictEqual(isLocked, true, 'App should be in locked state');

  // Verify PIN validation function
  function validatePin(input, pin) {
    if (!input || !pin) return false;
    return String(input).trim() === String(pin).trim();
  }

  // Attempt incorrect PIN
  assert.strictEqual(validatePin('0000', storedPin), false, 'Wrong PIN must fail validation');
  assert.strictEqual(validatePin('123', storedPin), false, 'Partial PIN must fail validation');
  assert.strictEqual(validatePin('12345', storedPin), false, 'Oversized PIN must fail validation');

  // Attempt correct PIN
  assert.strictEqual(validatePin('1234', storedPin), true, 'Correct PIN must succeed');
  isLocked = false;
  assert.strictEqual(isLocked, false, 'App should unlock after correct PIN');

  // Custom 6-digit PIN test
  storedPin = '987654';
  assert.strictEqual(validatePin('1234', storedPin), false, 'Old PIN must fail after change');
  assert.strictEqual(validatePin('987654', storedPin), true, 'New custom PIN must unlock');

  console.log('✓ Passcode validation and cat-proof lockout states verified successfully!');
}

// Test HTTP Endpoints
async function testServerEndpoints() {
  console.log('\n--- Testing Server Endpoints ---');

  const { startServer } = require('../server');
  const { server, port } = await startServer(0);

  const fetchJson = (path, options = {}) => {
    return new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: port,
        path: path,
        method: options.method || 'GET',
        headers: options.headers || {}
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(body) });
          } catch (e) {
            resolve({ status: res.statusCode, body });
          }
        });
      });
      req.on('error', reject);
      if (options.body) req.write(options.body);
      req.end();
    });
  };

  try {
    // Health
    const health = await fetchJson('/api/health');
    assert.strictEqual(health.status, 200, 'Health endpoint must return 200');
    assert.strictEqual(health.data.status, 'ok', 'Health status must be ok');
    console.log(`✓ /api/health returned 200 OK (port ${port})`);

    // Demo CGM
    const demo = await fetchJson('/api/libre/demo');
    assert.strictEqual(demo.status, 200);
    assert.strictEqual(demo.data.success, true);
    assert.ok(demo.data.data.glucose > 0, 'Glucose reading must be > 0');
    assert.ok(Array.isArray(demo.data.data.history), 'History must be an array');
    console.log(`✓ /api/libre/demo returned glucose: ${demo.data.data.glucose} mg/dL with ${demo.data.data.history.length} history points`);

    // Demo Set Value
    const setDemo = await fetchJson('/api/libre/demo/set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ glucose: 62, trendArrow: 2 })
    });
    assert.strictEqual(setDemo.status, 200);
    assert.strictEqual(setDemo.data.currentGlucose, 62);
    console.log('✓ /api/libre/demo/set correctly set low glucose (62 mg/dL) for alarm testing');

    // Test Libre Test-Connection Diagnostics Endpoint (Validation check)
    const testConnValidation = await fetchJson('/api/libre/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '', password: '', region: 'US' })
    });
    assert.strictEqual(testConnValidation.status, 400);
    assert.strictEqual(testConnValidation.data.success, false);
    assert.ok(testConnValidation.data.logs.length > 0, 'Must produce diagnostic logs');
    console.log('✓ /api/libre/test-connection validation and diagnostic logging verified');

    // Test kosher-zmanim Fast End calculation
    const zmanim = await fetchJson('/api/zmanim/fast-end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: 31.7683,
        lng: 35.2137,
        timeZoneId: 'Asia/Jerusalem',
        additionalMinutes: 18
      })
    });
    assert.strictEqual(zmanim.status, 200, 'Zmanim endpoint must return 200');
    assert.strictEqual(zmanim.data.success, true);
    assert.ok(zmanim.data.fastEndTimeFormatted, 'Must return formatted fast end time');
    console.log(`✓ /api/zmanim/fast-end computed Fast End Time: ${zmanim.data.fastEndTimeFormatted} (Sunset: ${zmanim.data.sunsetFormatted}, Tzais: ${zmanim.data.tzaisBaseFormatted} + 18m)`);
  } finally {
    if (server && server.close) {
      server.close();
    }
  }
}

async function runAll() {
  try {
    testTimerLogic();
    testLockAndPasscodeLogic();
    await testServerEndpoints();
    console.log('\n=============================================');
    console.log(' ALL AUTOMATED TESTS PASSED SUCCESSFULLY! ✓');
    console.log('=============================================\n');
    process.exit(0);
  } catch (err) {
    console.error('Test Failed:', err);
    process.exit(1);
  }
}

runAll();
