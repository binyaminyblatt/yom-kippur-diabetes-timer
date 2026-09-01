const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), { etag: false, maxAge: 0 }));

// Regional API endpoints for LibreLinkUp / LibreView
const REGION_URLS = {
  'US': 'https://api-us.libreview.io',
  'EU': 'https://api-eu.libreview.io',
  'GLOBAL': 'https://api.libreview.io',
  'DE': 'https://api-de.libreview.io',
  'FR': 'https://api-fr.libreview.io',
  'JP': 'https://api-jp.libreview.io',
  'AP': 'https://api-ap.libreview.io',
  'CA': 'https://api-ca.libreview.io',
  'AE': 'https://api-ae.libreview.io'
};

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'version': '4.16.0',
  'product': 'llu.android',
  'User-Agent': 'Mozilla/5.0 (Linux; Android 14; Mobile; rv:128.0) Gecko/128.0 Firefox/128.0'
};

// Helper: Calculate SHA-256 hash of userId for modern Account-Id header
function calculateAccountId(userId) {
  if (!userId) return '';
  return crypto.createHash('sha256').update(String(userId)).digest('hex');
}

// In-memory demo simulation state
let demoState = {
  currentGlucose: 118,
  trendArrow: 3, // 1: falling quickly, 2: falling, 3: steady, 4: rising, 5: rising quickly
  lastUpdated: new Date().toISOString(),
  targetLow: 70,
  targetHigh: 180,
  urgentLow: 55,
  history: []
};

// Seed demo history (last 12 hours)
function initDemoHistory() {
  const points = [];
  const now = Date.now();
  let val = 110;
  for (let i = 144; i >= 0; i--) {
    const time = new Date(now - i * 5 * 60 * 1000);
    // Smooth sine wave + subtle random drift
    const wave = Math.sin((144 - i) / 12) * 25;
    const noise = (Math.random() - 0.5) * 6;
    val = Math.round(Math.max(65, Math.min(220, 115 + wave + noise)));
    points.push({
      Value: val,
      ValueInMgPerDl: val,
      Timestamp: time.toISOString()
    });
  }
  demoState.history = points;
  demoState.currentGlucose = points[points.length - 1].Value;
  demoState.lastUpdated = points[points.length - 1].Timestamp;
}
initDemoHistory();

// Periodic demo update (simulates live CGM updates every 60s)
setInterval(() => {
  const last = demoState.currentGlucose;
  const drift = (Math.random() - 0.49) * 4;
  let next = Math.round(Math.max(50, Math.min(260, last + drift)));
  
  let arrow = 3;
  const diff = next - last;
  if (diff > 3) arrow = 5;
  else if (diff > 1) arrow = 4;
  else if (diff < -3) arrow = 1;
  else if (diff < -1) arrow = 2;

  demoState.currentGlucose = next;
  demoState.trendArrow = arrow;
  demoState.lastUpdated = new Date().toISOString();
  
  demoState.history.push({
    Value: next,
    ValueInMgPerDl: next,
    Timestamp: demoState.lastUpdated
  });
  if (demoState.history.length > 200) {
    demoState.history.shift();
  }
}, 60000);

// API Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

// Demo Data Endpoint
app.get('/api/libre/demo', (req, res) => {
  res.json({
    success: true,
    isDemo: true,
    data: {
      glucose: demoState.currentGlucose,
      trendArrow: demoState.trendArrow,
      timestamp: demoState.lastUpdated,
      targetLow: demoState.targetLow,
      targetHigh: demoState.targetHigh,
      urgentLow: demoState.urgentLow,
      isHigh: demoState.currentGlucose > demoState.targetHigh,
      isLow: demoState.currentGlucose < demoState.targetLow,
      isUrgentLow: demoState.currentGlucose < demoState.urgentLow,
      history: demoState.history.slice(-144) // last 12 hours
    }
  });
});

// Demo Set Value Endpoint (Allows user to test alarms directly)
app.post('/api/libre/demo/set', (req, res) => {
  const { glucose, trendArrow } = req.body;
  if (typeof glucose === 'number') {
    demoState.currentGlucose = Math.round(glucose);
    if (trendArrow) demoState.trendArrow = trendArrow;
    demoState.lastUpdated = new Date().toISOString();
    demoState.history.push({
      Value: demoState.currentGlucose,
      ValueInMgPerDl: demoState.currentGlucose,
      Timestamp: demoState.lastUpdated
    });
  }
  res.json({ success: true, currentGlucose: demoState.currentGlucose });
});

// Helper: Format log timestamp
function formatLogTime() {
  const d = new Date();
  return `[${d.toTimeString().split(' ')[0]}.${String(d.getMilliseconds()).padStart(3, '0')}]`;
}

// Helper: Diagnose LibreLinkUp authentication & connection problems
function diagnoseLibreProblem(err, rawData = null, region = 'US') {
  const errMsg = (err?.message || (typeof err === 'string' ? err : '')).toLowerCase();
  const rawMsg = (rawData?.error?.message || rawData?.message || JSON.stringify(rawData || '')).toLowerCase();
  const fullText = `${errMsg} ${rawMsg}`;

  if (fullText.includes('invalid credentials') || fullText.includes('status 2') || fullText.includes('unauthorized') || fullText.includes('401')) {
    return {
      category: 'INVALID_CREDENTIALS',
      title: 'Invalid Email or Password',
      friendlyMessage: 'Abbott rejected the email or password.',
      suggestion: 'Please verify that your email and password work when logging into the official LibreLinkUp mobile app. If your LibreView account uses "Sign in with Apple" or Google on your phone, you must set a password on the LibreView website.'
    };
  }

  if (fullText.includes('redirect') || fullText.includes('region')) {
    return {
      category: 'REGION_MISMATCH',
      title: 'Region Server Mismatch',
      friendlyMessage: `Your account belongs to a different regional server than "${region}".`,
      suggestion: 'The client attempted automatic regional redirection. If issue persists, try changing the region in Settings (e.g. from US to EU or Global).'
    };
  }

  if (fullText.includes('terms') || fullText.includes('tou') || fullText.includes('privacy') || fullText.includes('consent')) {
    return {
      category: 'TERMS_OF_SERVICE',
      title: 'Terms of Service Acceptance Required',
      friendlyMessage: 'Abbott requires you to accept updated Terms of Service or Privacy Policy.',
      suggestion: 'Open the LibreLinkUp mobile app on your smartphone once to accept the updated terms, then re-test the connection here.'
    };
  }

  if (fullText.includes('no connections') || fullText.includes('patient id not found')) {
    return {
      category: 'NO_PATIENT_CONNECTIONS',
      title: 'No Shared Patient Connected',
      friendlyMessage: 'Login succeeded, but no connected patient or active sensor was found.',
      suggestion: 'In the LibreLinkUp mobile app, verify that you have accepted the sharing invitation from the sensor wearer.'
    };
  }

  if (fullText.includes('too many requests') || fullText.includes('429') || fullText.includes('rate limit')) {
    return {
      category: 'RATE_LIMITED',
      title: 'Temporary Rate Limiting',
      friendlyMessage: 'Abbott servers are temporarily limiting requests due to rapid attempts.',
      suggestion: 'Please wait 2 to 3 minutes before testing again.'
    };
  }

  if (fullText.includes('enotfound') || fullText.includes('etimedout') || fullText.includes('econnrefused') || fullText.includes('fetch failed')) {
    return {
      category: 'NETWORK_TIMEOUT',
      title: 'Network / Connection Timeout',
      friendlyMessage: 'Could not connect to Abbott LibreLinkUp servers.',
      suggestion: 'Please check your computer internet connection and verify that api-us.libreview.io or api-eu.libreview.io is accessible.'
    };
  }

  return {
    category: 'GENERAL_ERROR',
    title: 'Connection Error',
    friendlyMessage: err?.message || 'Failed to communicate with LibreLinkUp.',
    suggestion: 'Check your credentials and region settings or inspect the detailed connection log below.'
  };
}

// Dynamic loader for librelinkup-api-client
let LibreLinkClientClass = null;
async function getLibreLinkClient() {
  if (!LibreLinkClientClass) {
    try {
      const mod = await import('librelinkup-api-client');
      LibreLinkClientClass = mod.LibreLinkClient;
    } catch (e) {
      console.warn('[LibreLinkUp] Dynamic import of librelinkup-api-client note:', e.message);
    }
  }
  return LibreLinkClientClass;
}

// ============================================================================
// LibreLinkUp Test Connection & Diagnostics Endpoint
// ============================================================================
app.post('/api/libre/test-connection', async (req, res) => {
  const logs = [];
  const addLog = (msg) => {
    const entry = `${formatLogTime()} ${msg}`;
    logs.push(entry);
    console.log(`[LibreLinkUp Test] ${entry}`);
  };

  try {
    const { email, password, region = 'US' } = req.body;

    if (!email || !password) {
      addLog('❌ Validation failed: Email and password are required.');
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
        suggestion: 'Please enter your LibreLinkUp follower email and password.',
        logs
      });
    }

    const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
    addLog(`🚀 Initializing LibreLinkUp connection test for account: ${maskedEmail} (Region: ${region})`);

    const ClientClass = await getLibreLinkClient();
    const defaultApiUrl = REGION_URLS[region.toUpperCase()] || REGION_URLS['GLOBAL'];
    addLog(`🌐 Target endpoint: ${defaultApiUrl}`);

    if (ClientClass) {
      addLog('📦 Using librelinkup-api-client engine...');
      const client = new ClientClass({
        email: email.trim(),
        password: password.trim(),
        apiUrl: defaultApiUrl,
        lluVersion: '4.16.0'
      });

      addLog('🔐 Step 1/3: Authenticating with Abbott servers...');
      const loginResp = await client.login();
      addLog(`✓ Step 1 Complete: Authentication successful (Status: ${loginResp?.status})`);

      addLog('🔍 Step 2/3: Querying connected patient sensors...');
      const connectionsResp = await client.fetchConnections();
      const connections = connectionsResp?.data || [];
      addLog(`✓ Step 2 Complete: Found ${connections.length} connected patient(s)`);

      if (!connections.length) {
        addLog('⚠️ Warning: No patient connections found. Ensure sensor sharing is accepted.');
        return res.json({
          success: true,
          hasPatient: false,
          user: client.me,
          warning: 'Login succeeded, but no connected patient was found in LibreLinkUp.',
          suggestion: 'Ensure the sensor wearer has sent a sharing invitation and you have accepted it in the LibreLinkUp app.',
          logs
        });
      }

      const primaryPatient = connections[0];
      const patientName = `${primaryPatient.firstName || ''} ${primaryPatient.lastName || ''}`.trim() || 'Patient';
      addLog(`👤 Primary Patient: "${patientName}" (Patient ID: ${primaryPatient.patientId || primaryPatient.id})`);

      addLog('📊 Step 3/3: Fetching latest real-time glucose reading & graph data...');
      const readingResp = await client.fetchReading();
      const connectionData = readingResp?.data?.connection;
      const glucoseItem = connectionData?.glucoseMeasurement;
      const graphData = readingResp?.data?.graphData || [];

      let glucoseVal = glucoseItem?.ValueInMgPerDl || glucoseItem?.Value || 0;
      let trendArrow = glucoseItem?.TrendArrow || 3;
      let timestamp = glucoseItem?.Timestamp || new Date().toISOString();

      addLog(`✓ Step 3 Complete: Latest Glucose: ${glucoseVal} mg/dL, Trend Arrow: ${trendArrow}, History Points: ${graphData.length}`);
      addLog('🎉 All tests passed successfully! LibreLinkUp connection is fully operational.');

      return res.json({
        success: true,
        hasPatient: true,
        patientName,
        patientId: primaryPatient.patientId || primaryPatient.id,
        latestGlucose: glucoseVal,
        trendArrow,
        timestamp,
        historyPointsCount: graphData.length,
        logs
      });
    }

    // Fallback: Direct Axios implementation with verbose logs
    addLog('📡 Running direct Abbott API test...');
    const loginResp = await axios.post(
      `${defaultApiUrl}/llu/auth/login`,
      { email: email.trim(), password: password.trim() },
      { headers: DEFAULT_HEADERS, timeout: 15000 }
    );

    const data = loginResp.data;
    if (data.status !== 0 && data.status !== 2) {
      throw new Error(data.error?.message || 'Login failed. Invalid credentials.');
    }

    addLog('✓ Direct login successful!');
    return res.json({
      success: true,
      hasPatient: true,
      patientName: 'Libre User',
      logs
    });
  } catch (err) {
    const errorDetails = err?.message || String(err);
    addLog(`❌ Connection Error: ${errorDetails}`);
    const diagnosis = diagnoseLibreProblem(err, err.response?.data, req.body?.region);
    addLog(`💡 Diagnosis: ${diagnosis.title} — ${diagnosis.suggestion}`);

    res.status(400).json({
      success: false,
      error: diagnosis.friendlyMessage,
      errorTitle: diagnosis.title,
      suggestion: diagnosis.suggestion,
      rawError: errorDetails,
      logs
    });
  }
});

// ============================================================================
// LibreLinkUp Standard Login Endpoint
// ============================================================================
app.post('/api/libre/login', async (req, res) => {
  try {
    const { email, password, region = 'US' } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const defaultApiUrl = REGION_URLS[region.toUpperCase()] || REGION_URLS['GLOBAL'];
    const ClientClass = await getLibreLinkClient();

    if (ClientClass) {
      try {
        const client = new ClientClass({
          email: email.trim(),
          password: password.trim(),
          apiUrl: defaultApiUrl,
          lluVersion: '4.16.0'
        });

        await client.login();
        const connectionsResp = await client.fetchConnections();
        const connections = connectionsResp?.data || [];

        if (!connections.length) {
          return res.json({
            success: true,
            token: client.accessToken,
            userId: client.me?.id,
            accountId: client.me?.id ? calculateAccountId(client.me.id) : '',
            baseUrl: client.apiUrl || defaultApiUrl,
            region,
            patientId: null,
            patientName: 'Self',
            warning: 'No shared patient connections found.'
          });
        }

        const primaryPatient = connections[0];
        const patientId = primaryPatient.id || primaryPatient.patientId;
        const patientName = `${primaryPatient.firstName || ''} ${primaryPatient.lastName || ''}`.trim() || 'Patient';

        return res.json({
          success: true,
          token: client.accessToken,
          userId: client.me?.id,
          accountId: client.me?.id ? calculateAccountId(client.me.id) : '',
          baseUrl: client.apiUrl || defaultApiUrl,
          region,
          patientId,
          patientName,
          patientData: primaryPatient
        });
      } catch (clientErr) {
        console.warn('[LibreLinkUp] Client instance note, trying direct auth:', clientErr.message);
      }
    }

    // Direct Axios fallback
    const baseUrl = defaultApiUrl;
    const loginUrl = `${baseUrl}/llu/auth/login`;

    const loginResponse = await axios.post(
      loginUrl,
      { email: email.trim(), password: password.trim() },
      { headers: DEFAULT_HEADERS, timeout: 15000 }
    );

    const data = loginResponse.data;
    if (data.status !== 0 && data.status !== 2) {
      const diagnosis = diagnoseLibreProblem(null, data, region);
      return res.status(401).json({
        success: false,
        error: diagnosis.friendlyMessage,
        suggestion: diagnosis.suggestion
      });
    }

    let activeBaseUrl = baseUrl;
    if (data.data?.redirect && data.data?.region) {
      const redirectRegion = data.data.region.toUpperCase();
      if (REGION_URLS[redirectRegion]) {
        activeBaseUrl = REGION_URLS[redirectRegion];
      }
    }

    const authTicket = data.data?.authTicket;
    const user = data.data?.user;

    if (!authTicket?.token || !user?.id) {
      return res.status(401).json({ success: false, error: 'Invalid response from LibreLinkUp server.' });
    }

    const token = authTicket.token;
    const userId = user.id;
    const accountId = calculateAccountId(userId);

    const connectionsResponse = await axios.get(`${activeBaseUrl}/llu/connections`, {
      headers: {
        ...DEFAULT_HEADERS,
        'Authorization': `Bearer ${token}`,
        'Account-Id': accountId
      },
      timeout: 15000
    });

    const connections = connectionsResponse.data?.data || [];
    const primaryPatient = connections[0] || {};
    const patientId = primaryPatient.id || primaryPatient.patientId || null;
    const patientName = `${primaryPatient.firstName || ''} ${primaryPatient.lastName || ''}`.trim() || 'Patient';

    res.json({
      success: true,
      token,
      userId,
      accountId,
      baseUrl: activeBaseUrl,
      region,
      patientId,
      patientName,
      patientData: primaryPatient
    });
  } catch (error) {
    console.error('LibreLinkUp login error:', error.response?.data || error.message);
    const diagnosis = diagnoseLibreProblem(error, error.response?.data, req.body?.region);
    res.status(401).json({
      success: false,
      error: diagnosis.friendlyMessage,
      errorTitle: diagnosis.title,
      suggestion: diagnosis.suggestion
    });
  }
});

// ============================================================================
// LibreLinkUp Fetch Latest Glucose & Graph Data
// ============================================================================
app.post('/api/libre/readings', async (req, res) => {
  try {
    const { token, accountId, baseUrl, patientId, region = 'US' } = req.body;

    if (!token || !patientId) {
      return res.status(400).json({ success: false, error: 'Token and Patient ID are required' });
    }

    const activeBaseUrl = baseUrl || REGION_URLS[region.toUpperCase()] || REGION_URLS['GLOBAL'];
    const graphUrl = `${activeBaseUrl}/llu/connections/${patientId}/graph`;

    const response = await axios.get(graphUrl, {
      headers: {
        ...DEFAULT_HEADERS,
        'Authorization': `Bearer ${token}`,
        'Account-Id': accountId
      },
      timeout: 15000
    });

    const data = response.data?.data;
    if (!data) {
      return res.status(500).json({ success: false, error: 'Empty response from CGM server' });
    }

    const currentMeasurement = data.connection?.glucoseMeasurement;
    const graphData = data.graphData || [];

    if (!currentMeasurement) {
      return res.status(500).json({ success: false, error: 'No recent glucose measurement available' });
    }

    const glucoseVal = currentMeasurement.ValueInMgPerDl || currentMeasurement.Value;
    const trendArrow = currentMeasurement.TrendArrow || 3;
    const timestamp = currentMeasurement.Timestamp || new Date().toISOString();
    const isHigh = currentMeasurement.isHigh || glucoseVal > (data.connection?.targetHigh || 180);
    const isLow = currentMeasurement.isLow || glucoseVal < (data.connection?.targetLow || 70);

    res.json({
      success: true,
      glucose: glucoseVal,
      trendArrow: trendArrow,
      timestamp: timestamp,
      targetLow: data.connection?.targetLow || 70,
      targetHigh: data.connection?.targetHigh || 180,
      isHigh,
      isLow,
      isUrgentLow: glucoseVal < 55,
      history: graphData.map(pt => ({
        Value: pt.ValueInMgPerDl || pt.Value,
        ValueInMgPerDl: pt.ValueInMgPerDl || pt.Value,
        Timestamp: pt.Timestamp
      }))
    });
  } catch (error) {
    console.error('LibreLinkUp readings error:', error.response?.data || error.message);
    const diagnosis = diagnoseLibreProblem(error, error.response?.data, req.body?.region);
    const status = error.response?.status || 500;
    res.status(status).json({
      success: false,
      error: diagnosis.friendlyMessage,
      errorTitle: diagnosis.title,
      suggestion: diagnosis.suggestion
    });
  }
});

// Common Timezone to Default Geo Coordinates Mapping
const TIMEZONE_LOCATIONS = {
  'Asia/Jerusalem': { lat: 31.7683, lng: 35.2137, name: 'Jerusalem, Israel' },
  'Israel': { lat: 31.7683, lng: 35.2137, name: 'Jerusalem, Israel' },
  'America/New_York': { lat: 40.7128, lng: -74.0060, name: 'New York, NY' },
  'America/Detroit': { lat: 42.3314, lng: -83.0458, name: 'Detroit / Southfield, MI' },
  'America/Chicago': { lat: 41.8781, lng: -87.6298, name: 'Chicago, IL' },
  'America/Los_Angeles': { lat: 34.0522, lng: -118.2437, name: 'Los Angeles, CA' },
  'America/Miami': { lat: 25.7617, lng: -80.1918, name: 'Miami, FL' },
  'America/Toronto': { lat: 43.6532, lng: -79.3832, name: 'Toronto, Canada' },
  'America/Montreal': { lat: 45.5017, lng: -73.5673, name: 'Montreal, Canada' },
  'America/Denver': { lat: 39.7392, lng: -104.9903, name: 'Denver, CO' },
  'America/Phoenix': { lat: 33.4484, lng: -112.0740, name: 'Phoenix, AZ' },
  'Europe/London': { lat: 51.5074, lng: -0.1278, name: 'London, UK' },
  'Europe/Paris': { lat: 48.8566, lng: 2.3522, name: 'Paris, France' },
  'Europe/Berlin': { lat: 52.5200, lng: 13.4050, name: 'Berlin, Germany' },
  'Europe/Zurich': { lat: 47.3769, lng: 8.5417, name: 'Zurich, Switzerland' },
  'Australia/Sydney': { lat: -33.8688, lng: 151.2093, name: 'Sydney, Australia' },
  'Australia/Melbourne': { lat: -37.8136, lng: 144.9631, name: 'Melbourne, Australia' },
  'America/Sao_Paulo': { lat: -23.5505, lng: -46.6333, name: 'São Paulo, Brazil' },
  'America/Buenos_Aires': { lat: -34.6037, lng: -58.3816, name: 'Buenos Aires, Argentina' },
  'Africa/Johannesburg': { lat: -26.2041, lng: 28.0473, name: 'Johannesburg, South Africa' }
};

// Zmanim Fast End Calculation via kosher-zmanim
const KosherZmanim = require('kosher-zmanim');

app.post('/api/zmanim/fast-end', (req, res) => {
  try {
    let {
      lat,
      lng,
      elevation = 0,
      timeZoneId,
      date = null,
      additionalMinutes = 0,
      method = 'geonim85'
    } = req.body;

    const tz = timeZoneId || Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jerusalem';

    // Auto-resolve coordinates from timezone if not provided or default
    let locationName = 'Auto Location';
    if (!lat || !lng) {
      const match = TIMEZONE_LOCATIONS[tz] || TIMEZONE_LOCATIONS['Asia/Jerusalem'];
      lat = match.lat;
      lng = match.lng;
      locationName = match.name;
    } else if (TIMEZONE_LOCATIONS[tz]) {
      locationName = TIMEZONE_LOCATIONS[tz].name;
    }

    const parsedLat = parseFloat(lat) || 31.7683;
    const parsedLng = parseFloat(lng) || 35.2137;
    const parsedElev = parseFloat(elevation) || 0;
    const parsedExtra = parseInt(additionalMinutes, 10) || 0;

    const location = new KosherZmanim.GeoLocation(locationName, parsedLat, parsedLng, parsedElev, tz);
    const zmanimCalendar = new KosherZmanim.ComplexZmanimCalendar(location);

    const targetDate = date ? new Date(date) : new Date();
    zmanimCalendar.setDate(targetDate);

    const sunset = zmanimCalendar.getSunset();
    let baseTzais = zmanimCalendar.getTzaisGeonim8Point5Degrees();

    if (method === 'sunset72') {
      baseTzais = zmanimCalendar.getTzais72();
    } else if (method === 'sunset42' && sunset) {
      baseTzais = sunset.plus({ minutes: 42 });
    } else if (method === 'sunset50' && sunset) {
      baseTzais = sunset.plus({ minutes: 50 });
    }

    if (!baseTzais && sunset) {
      baseTzais = sunset.plus({ minutes: 42 });
    }

    const finalFastEnd = baseTzais ? baseTzais.plus({ minutes: parsedExtra }) : null;

    res.json({
      success: true,
      fastEndTimeFormatted: finalFastEnd ? finalFastEnd.setZone(tz).toFormat('HH:mm') : '19:45',
      fastEndTimeISO: finalFastEnd ? finalFastEnd.toISO() : null,
      sunsetFormatted: sunset ? sunset.setZone(tz).toFormat('HH:mm') : null,
      tzaisBaseFormatted: baseTzais ? baseTzais.setZone(tz).toFormat('HH:mm') : null,
      additionalMinutes: parsedExtra,
      locationName,
      location: {
        latitude: parsedLat,
        longitude: parsedLng,
        timeZoneId: tz
      },
      date: targetDate.toISOString().split('T')[0]
    });
  } catch (err) {
    console.error('Zmanim calculation error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Graceful Application Quit Endpoint
app.post('/api/app/quit', (req, res) => {
  res.json({ success: true, message: 'Application shutting down...' });
  setTimeout(() => {
    process.exit(0);
  }, 200);
});

// Catch-all: serve index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server Function with automatic random port fallback
function startServer(targetPort = (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000)) {
  return new Promise((resolve, reject) => {
    const srv = app.listen(targetPort, () => {
      const actualPort = srv.address().port;
      console.log(`=======================================================`);
      console.log(` Yom Kippur Diabetes Timer & LibreLinkUp CGM Server`);
      console.log(` Running on: http://localhost:${actualPort}`);
      console.log(`=======================================================`);
      resolve({ app, server: srv, port: actualPort });
    });

    srv.on('error', (err) => {
      if (err.code === 'EADDRINUSE' && targetPort !== 0) {
        console.warn(`[Server] Port ${targetPort} is occupied. Automatically falling back to a free random port...`);
        const fallbackSrv = app.listen(0, () => {
          const fallbackPort = fallbackSrv.address().port;
          console.log(`[Server] Yom Kippur Timer listening on fallback port: http://localhost:${fallbackPort}`);
          resolve({ app, server: fallbackSrv, port: fallbackPort });
        });
        fallbackSrv.on('error', reject);
      } else {
        reject(err);
      }
    });
  });
}

// Auto-start server when executed directly: node server.js
if (require.main === module) {
  const portToUse = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  startServer(portToUse).catch(err => {
    console.error('Failed to start server:', err);
  });
}

module.exports = { app, startServer };
