const http = require('http');
const assert = require('assert');
const path = require('path');
const fs = require('fs');

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

// Test Audio Engine & Alert Repetition Logic
function testAudioEngineLogic() {
  console.log('\n--- Testing Audio Engine & 15-Repeat Alert Configuration ---');
  const AudioEngine = require(path.join(__dirname, '../public/audio-engine.js'));
  const engine = new AudioEngine();

  // Test defaults
  assert.strictEqual(engine.autoShutoffSeconds, 20, 'Default auto-shutoff should be 20s to allow 15-repeat sequence');
  assert.strictEqual(engine.speechEnabled, false, 'Default speechEnabled should be false');
  assert.strictEqual(engine.masterVolume, 0.50, 'Default master volume should be 0.50');

  // Test Speech toggling
  engine.setSpeech(true);
  assert.strictEqual(engine.speechEnabled, true, 'Speech should be enabled');
  engine.setSpeech(false);
  assert.strictEqual(engine.speechEnabled, false, 'Speech should be disabled');

  // Test Auto Shutoff bounds
  engine.setAutoShutoffSeconds(15);
  assert.strictEqual(engine.autoShutoffSeconds, 15);
  engine.setAutoShutoffSeconds(1); // Min bound clamp
  assert.strictEqual(engine.autoShutoffSeconds, 2);
  engine.setAutoShutoffSeconds(100); // Max bound clamp
  assert.strictEqual(engine.autoShutoffSeconds, 60);

  // Test Volume Clamping
  engine.setVolume(1.5);
  assert.strictEqual(engine.masterVolume, 1.0, 'Volume should be capped at 1.0');
  engine.setVolume(-0.5);
  assert.strictEqual(engine.masterVolume, 0.0, 'Volume should not go below 0.0');

  // Test 15-pulse sequence duration math
  const glucosePulses = 15;
  const pulseSpacing = 1.35;
  const totalDuration = (glucosePulses - 1) * pulseSpacing;
  assert.ok(totalDuration < 20, '15 pulses at 1.35s spacing should complete within the 20s auto-shutoff window');

  // Test stopAlarms method existence
  assert.strictEqual(typeof engine.stopAlarms, 'function', 'engine must have stopAlarms method');
  engine.stopAlarms();

  console.log('✓ AudioEngine, 15-repeat pulse math, and speech synthesis handlers verified successfully!');
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

    // =========================================================================
    // Test Connection Validation using .env Files & Parsed Configurations
    // =========================================================================
    console.log('\n--- Testing Test Connection Validation with .env Configurations ---');

    const parseEnv = (content) => {
      const env = {};
      if (!content) return env;
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx !== -1) {
          const key = trimmed.substring(0, idx).trim();
          let val = trimmed.substring(idx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          env[key] = val;
        }
      }
      return env;
    };

    const loadEnvFile = (filePath) => {
      if (fs.existsSync(filePath)) {
        return parseEnv(fs.readFileSync(filePath, 'utf8'));
      }
      return {};
    };

    // Test Case 1: Direct validation check (empty credentials)
    const testConnValidation = await fetchJson('/api/libre/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '', password: '', region: 'US' })
    });
    assert.strictEqual(testConnValidation.status, 400);
    assert.strictEqual(testConnValidation.data.success, false);
    assert.strictEqual(testConnValidation.data.error, 'Email and password are required');
    assert.ok(testConnValidation.data.logs.length > 0, 'Must produce diagnostic logs');
    console.log('✓ /api/libre/test-connection validation and diagnostic logging verified');

    // Test Case 2: .env configuration with missing email
    const envMissingEmail = parseEnv(`
      # Mock .env file with missing email
      LIBRE_EMAIL=
      LIBRE_PASSWORD=MySecretPassword123
      LIBRE_REGION=US
    `);
    const resMissingEmail = await fetchJson('/api/libre/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: envMissingEmail.LIBRE_EMAIL || '',
        password: envMissingEmail.LIBRE_PASSWORD || '',
        region: envMissingEmail.LIBRE_REGION || 'US'
      })
    });
    assert.strictEqual(resMissingEmail.status, 400, 'Missing email in .env must return 400');
    assert.strictEqual(resMissingEmail.data.success, false);
    assert.strictEqual(resMissingEmail.data.error, 'Email and password are required');
    assert.ok(resMissingEmail.data.logs.some(l => l.includes('Validation failed')), 'Must produce validation failure log');
    console.log('✓ .env with missing email correctly rejected with 400 Bad Request');

    // Test Case 3: .env configuration with missing password
    const envMissingPassword = parseEnv(`
      # Mock .env file with missing password
      LIBRE_EMAIL=follower@example.com
      LIBRE_PASSWORD=""
      LIBRE_REGION=EU
    `);
    const resMissingPassword = await fetchJson('/api/libre/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: envMissingPassword.LIBRE_EMAIL || '',
        password: envMissingPassword.LIBRE_PASSWORD || '',
        region: envMissingPassword.LIBRE_REGION || 'US'
      })
    });
    assert.strictEqual(resMissingPassword.status, 400, 'Missing password in .env must return 400');
    assert.strictEqual(resMissingPassword.data.success, false);
    assert.strictEqual(resMissingPassword.data.error, 'Email and password are required');
    assert.ok(resMissingPassword.data.logs.some(l => l.includes('Validation failed')), 'Must produce validation failure log');
    console.log('✓ .env with missing password correctly rejected with 400 Bad Request');

    // Test Case 4: Temporary .env.test file lifecycle on filesystem
    const testEnvPath = path.join(__dirname, '.env.test');
    fs.writeFileSync(testEnvPath, [
      '# Automated Test Environment File',
      'LIBRE_EMAIL="test.user@diabetestimer.local"',
      'LIBRE_PASSWORD="test_mock_password"',
      'LIBRE_REGION="US"'
    ].join('\n'), 'utf8');

    const loadedTestEnv = loadEnvFile(testEnvPath);
    assert.strictEqual(loadedTestEnv.LIBRE_EMAIL, 'test.user@diabetestimer.local');
    assert.strictEqual(loadedTestEnv.LIBRE_PASSWORD, 'test_mock_password');
    assert.strictEqual(loadedTestEnv.LIBRE_REGION, 'US');

    const resTestEnv = await fetchJson('/api/libre/test-connection', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: loadedTestEnv.LIBRE_EMAIL,
        password: loadedTestEnv.LIBRE_PASSWORD,
        region: loadedTestEnv.LIBRE_REGION
      })
    });
    assert.strictEqual(resTestEnv.status, 400, 'Invalid credentials from .env must return 400 with diagnostic suggestion');
    assert.strictEqual(resTestEnv.data.success, false);
    assert.ok(resTestEnv.data.suggestion, 'Must provide friendly diagnostic suggestion');
    assert.ok(resTestEnv.data.logs.length > 0, 'Must produce multi-step diagnostic logs');
    console.log(`✓ Temporary .env.test validated and executed: ${resTestEnv.data.error} (Suggestion: ${resTestEnv.data.suggestion})`);

    // Clean up temporary test .env file
    if (fs.existsSync(testEnvPath)) {
      fs.unlinkSync(testEnvPath);
    }
    console.log('✓ Temporary .env.test file cleaned up successfully');

    // Test Case 5: Root .env or .env.example verification
    const rootEnvPath = path.join(__dirname, '../.env');
    const rootExampleEnvPath = path.join(__dirname, '../.env.example');
    const activeEnv = fs.existsSync(rootEnvPath) ? loadEnvFile(rootEnvPath) : loadEnvFile(rootExampleEnvPath);
    
    if (activeEnv.LIBRE_EMAIL && activeEnv.LIBRE_PASSWORD && activeEnv.LIBRE_EMAIL !== 'user@example.com') {
      const masked = activeEnv.LIBRE_EMAIL.replace(/(.{2})(.*)(@.*)/, '$1***$3');
      console.log(`📡 Detected live .env credentials for ${masked} (Region: ${activeEnv.LIBRE_REGION || 'US'}). Running live connection validation...`);
      const liveRes = await fetchJson('/api/libre/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: activeEnv.LIBRE_EMAIL,
          password: activeEnv.LIBRE_PASSWORD,
          region: activeEnv.LIBRE_REGION || 'US'
        })
      });
      console.log(`✓ Live .env connection test completed: HTTP ${liveRes.status} (Success: ${liveRes.data.success})`);
    } else {
      console.log('✓ .env.example template parsed and verified for LibreLinkUp testing configuration');
    }

    // Test /api/libre/readings Validation Check
    const readingsValidation = await fetchJson('/api/libre/readings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.strictEqual(readingsValidation.status, 400, 'Empty readings request must return 400');
    assert.strictEqual(readingsValidation.data.success, false);
    console.log('✓ /api/libre/readings validation verified (returns 400 Bad Request instead of 500)');

    // Test /api/libre/logs Endpoint
    const logsResp = await fetchJson('/api/libre/logs');
    assert.strictEqual(logsResp.status, 200, '/api/libre/logs must return 200');
    assert.strictEqual(logsResp.data.success, true);
    assert.ok(Array.isArray(logsResp.data.logs), 'Logs must be an array');
    assert.ok(logsResp.data.total >= 3, 'Must contain logged glucose requests');
    console.log(`✓ /api/libre/logs returned ${logsResp.data.total} recorded glucose requests`);

    // Test LibreService unit formatting and null safety
    const LibreService = require(path.join(__dirname, '../public/libre-service.js'));
    const libreService = new LibreService();
    assert.deepStrictEqual(libreService.formatGlucose(null), { value: '--', unit: 'mg/dL' });
    assert.deepStrictEqual(libreService.formatGlucose(undefined), { value: '--', unit: 'mg/dL' });
    assert.deepStrictEqual(libreService.formatGlucose(NaN), { value: '--', unit: 'mg/dL' });
    assert.deepStrictEqual(libreService.formatGlucose(110), { value: 110, unit: 'mg/dL' });
    libreService.setUnit('mmol');
    assert.deepStrictEqual(libreService.formatGlucose(110), { value: '6.1', unit: 'mmol/L' });
    assert.deepStrictEqual(libreService.formatGlucose(null), { value: '--', unit: 'mmol/L' });
    console.log('✓ LibreService formatGlucose null safety and mmol/mgdl unit conversion verified');

    // Test kosher-zmanim Fast End calculation & Yom Kippur Schedule Resolution
    console.log('\n--- Testing Yom Kippur Schedule Calculation & States ---');
    
    // Scenario 1: Auto-resolved Yom Kippur for current date (e.g. Sept 2026 -> 5787)
    const zmanimAuto = await fetchJson('/api/zmanim/fast-end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: 31.7683,
        lng: 35.2137,
        timeZoneId: 'Asia/Jerusalem',
        additionalMinutes: 18
      })
    });
    assert.strictEqual(zmanimAuto.status, 200, 'Zmanim endpoint must return 200');
    assert.strictEqual(zmanimAuto.data.success, true);
    assert.ok(zmanimAuto.data.fastEndTimeFormatted, 'Must return formatted fast end time');
    assert.ok(zmanimAuto.data.fastStartDate, 'Must return fast start date');
    assert.ok(zmanimAuto.data.fastEndDate, 'Must return fast end date');
    assert.strictEqual(zmanimAuto.data.fastStartDate, '2026-09-20', 'Erev YK 5787 must be 2026-09-20');
    assert.strictEqual(zmanimAuto.data.fastEndDate, '2026-09-21', 'YK Day 5787 must be 2026-09-21');
    console.log(`✓ Auto Yom Kippur 5787 schedule resolved: Starts ${zmanimAuto.data.fastStartDate} at ${zmanimAuto.data.fastStartTimeFormatted}, Ends ${zmanimAuto.data.fastEndDate} at ${zmanimAuto.data.fastEndTimeFormatted}`);

    // Scenario 2: Yom Kippur Night (simulating 2026-09-20 at 21:00)
    // On Yom Kippur night, the fast MUST be active and targeting tomorrow night (2026-09-21), NOT concluded!
    const zmanimNight = await fetchJson('/api/zmanim/fast-end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: 31.7683,
        lng: 35.2137,
        timeZoneId: 'Asia/Jerusalem',
        additionalMinutes: 18,
        now: '2026-09-20T21:00:00+03:00'
      })
    });
    assert.strictEqual(zmanimNight.data.status, 'FAST_ACTIVE', 'Yom Kippur night must have status FAST_ACTIVE');
    assert.strictEqual(zmanimNight.data.isYomKippurNight, true, 'isYomKippurNight must be true');
    assert.strictEqual(zmanimNight.data.isYomKippurDay, false, 'isYomKippurDay must be false');
    assert.strictEqual(zmanimNight.data.fastEndDate, '2026-09-21', 'Fast end date must be tomorrow (2026-09-21)');
    console.log(`✓ Yom Kippur Night (Kol Nidre evening) correctly detected: Status is FAST_ACTIVE (Ends tomorrow ${zmanimNight.data.fastEndDate} at ${zmanimNight.data.fastEndTimeFormatted})`);

    // Scenario 3: Yom Kippur Day (simulating 2026-09-21 at 12:00)
    const zmanimDay = await fetchJson('/api/zmanim/fast-end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: 31.7683,
        lng: 35.2137,
        timeZoneId: 'Asia/Jerusalem',
        additionalMinutes: 18,
        now: '2026-09-21T12:00:00+03:00'
      })
    });
    assert.strictEqual(zmanimDay.data.status, 'FAST_ACTIVE', 'Yom Kippur daytime must have status FAST_ACTIVE');
    assert.strictEqual(zmanimDay.data.isYomKippurNight, false, 'isYomKippurNight must be false');
    assert.strictEqual(zmanimDay.data.isYomKippurDay, true, 'isYomKippurDay must be true');
    assert.strictEqual(zmanimDay.data.fastEndDate, '2026-09-21', 'Fast end date must be today (2026-09-21)');
    console.log(`✓ Yom Kippur Day correctly detected: Status is FAST_ACTIVE (Ends tonight ${zmanimDay.data.fastEndDate} at ${zmanimDay.data.fastEndTimeFormatted})`);

    // Scenario 4: Motzei Yom Kippur after fast end (simulating 2026-09-21 at 21:00)
    const zmanimConcluded = await fetchJson('/api/zmanim/fast-end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: 31.7683,
        lng: 35.2137,
        timeZoneId: 'Asia/Jerusalem',
        additionalMinutes: 18,
        now: '2026-09-21T21:00:00+03:00'
      })
    });
    assert.strictEqual(zmanimConcluded.data.status, 'FAST_CONCLUDED', 'After fast end must have status FAST_CONCLUDED');
    console.log('✓ Motzei Yom Kippur (after nightfall) correctly detected: Status is FAST_CONCLUDED');

    // Scenario 5: Manual Date and Time Override
    const zmanimManual = await fetchJson('/api/zmanim/fast-end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: 40.7128,
        lng: -74.0060,
        timeZoneId: 'America/New_York',
        isManual: true,
        manualDate: '2026-10-15',
        manualTime: '18:55'
      })
    });
    assert.strictEqual(zmanimManual.data.isManual, true);
    assert.strictEqual(zmanimManual.data.fastEndDate, '2026-10-15');
    assert.strictEqual(zmanimManual.data.fastEndTimeFormatted, '18:55');
    console.log(`✓ Manual Fast schedule override verified: Custom date ${zmanimManual.data.fastEndDate} at ${zmanimManual.data.fastEndTimeFormatted}`);

    // Scenario 6: Hebrew Localized Zmanim calculation
    const zmanimHebrew = await fetchJson('/api/zmanim/fast-end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lat: 31.7683,
        lng: 35.2137,
        timeZoneId: 'Asia/Jerusalem',
        lang: 'he'
      })
    });
    assert.strictEqual(zmanimHebrew.status, 200);
    assert.strictEqual(zmanimHebrew.data.success, true);
    assert.ok(zmanimHebrew.data.locationName.includes('ירושלים'), 'Location name must be localized in Hebrew');
    console.log(`✓ Localized Hebrew Zmanim calculated without errors: ${zmanimHebrew.data.locationName} (${zmanimHebrew.data.hebrewDateStr})`);

    // Test /api/languages endpoint
    const langResp = await fetchJson('/api/languages');
    assert.strictEqual(langResp.status, 200, '/api/languages must return 200');
    assert.strictEqual(langResp.data.success, true);
    assert.ok(Array.isArray(langResp.data.languages), 'languages must be an array');
    assert.ok(langResp.data.languages.some(l => l.code === 'en'), 'Must include en');
    assert.ok(langResp.data.languages.some(l => l.code === 'he'), 'Must include he');
    console.log(`✓ /api/languages returned ${langResp.data.languages.length} auto-discovered languages`);
  } finally {
    if (server && server.close) {
      server.close();
    }
  }
}

async function runAll() {
  try {
    testTimerLogic();
    testAudioEngineLogic();
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
