const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');

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

// Helper: Format log timestamp
function formatLogTime() {
  const d = new Date();
  return `[${d.toTimeString().split(' ')[0]}.${String(d.getMilliseconds()).padStart(3, '0')}]`;
}

// In-memory ring buffer for recent CGM requests & debug logs (last 100 entries)
const cgmRequestLogs = [];
function logGlucoseActivity(endpoint, type, details, meta = null) {
  const time = formatLogTime();
  const entry = {
    timestamp: new Date().toISOString(),
    formattedTime: time,
    endpoint,
    type, // 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR'
    details,
    meta: meta ? (typeof meta === 'object' ? meta : { raw: String(meta) }) : null
  };
  cgmRequestLogs.push(entry);
  if (cgmRequestLogs.length > 100) {
    cgmRequestLogs.shift();
  }
  const icon = type === 'SUCCESS' ? '✓' : (type === 'ERROR' ? '❌' : (type === 'WARN' ? '⚠️' : '📡'));
  console.log(`[CGM Activity] ${time} ${icon} [${endpoint}] ${details}`);
}

// Endpoint: Fetch all recent glucose request logs
app.get('/api/libre/logs', (req, res) => {
  res.json({
    success: true,
    total: cgmRequestLogs.length,
    logs: cgmRequestLogs
  });
});

// Demo Data Endpoint
app.get('/api/libre/demo', (req, res) => {
  logGlucoseActivity('/api/libre/demo', 'INFO', `Returning demo glucose: ${demoState.currentGlucose} mg/dL (arrow: ${demoState.trendArrow})`);
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
    logGlucoseActivity('/api/libre/demo/set', 'SUCCESS', `Simulated glucose set to ${demoState.currentGlucose} mg/dL, arrow: ${demoState.trendArrow}`);
  }
  res.json({ success: true, currentGlucose: demoState.currentGlucose });
});

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
      logGlucoseActivity('/api/libre/test-connection', 'WARN', 'Test connection validation failed: missing email or password.');
      return res.status(400).json({
        success: false,
        error: 'Email and password are required',
        suggestion: 'Please enter your LibreLinkUp follower email and password.',
        logs
      });
    }

    const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
    addLog(`🚀 Initializing LibreLinkUp connection test for account: ${maskedEmail} (Region: ${region})`);
    logGlucoseActivity('/api/libre/test-connection', 'INFO', `Starting test connection for: ${maskedEmail} (Region: ${region})`);

    const ClientClass = await getLibreLinkClient();
    if (!ClientClass) {
      throw new Error('librelinkup-api-client library could not be loaded.');
    }

    const defaultApiUrl = REGION_URLS[region.toUpperCase()] || REGION_URLS['GLOBAL'];
    addLog(`🌐 Target endpoint: ${defaultApiUrl}`);
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
      logGlucoseActivity('/api/libre/test-connection', 'WARN', `Authenticated ${maskedEmail} but no shared patient found.`);
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
    const patientId = primaryPatient.patientId || primaryPatient.id;
    addLog(`👤 Primary Patient: "${patientName}" (Patient ID: ${patientId})`);

    addLog('📊 Step 3/3: Fetching latest real-time glucose reading & graph data...');
    const readingResp = await client.fetchReading();
    const connectionData = readingResp?.data?.connection || readingResp?.connection;
    const glucoseItem = connectionData?.glucoseMeasurement || connectionData?.glucoseItem;
    const graphData = readingResp?.data?.graphData || readingResp?.graphData || [];

    let glucoseVal = glucoseItem?.ValueInMgPerDl !== undefined ? glucoseItem.ValueInMgPerDl : (glucoseItem?.Value !== undefined ? glucoseItem.Value : 0);
    let trendArrow = glucoseItem?.TrendArrow !== undefined ? glucoseItem.TrendArrow : 3;
    let timestamp = glucoseItem?.Timestamp || new Date().toISOString();

    if (!glucoseVal && graphData.length > 0) {
      const lastPt = graphData[graphData.length - 1];
      glucoseVal = lastPt.ValueInMgPerDl || lastPt.Value || 0;
      trendArrow = lastPt.TrendArrow || 3;
      timestamp = lastPt.Timestamp || timestamp;
    }

    addLog(`✓ Step 3 Complete: Latest Glucose: ${glucoseVal} mg/dL, Trend Arrow: ${trendArrow}, History Points: ${graphData.length}`);
    addLog('🎉 All tests passed successfully! LibreLinkUp connection is fully operational.');
    logGlucoseActivity('/api/libre/test-connection', 'SUCCESS', `Test connection verified: Glucose ${glucoseVal} mg/dL for ${patientName} (${graphData.length} points)`);

    return res.json({
      success: true,
      hasPatient: true,
      patientName,
      patientId,
      latestGlucose: glucoseVal,
      trendArrow,
      timestamp,
      historyPointsCount: graphData.length,
      logs
    });
  } catch (err) {
    const errorDetails = err?.message || String(err);
    addLog(`❌ Connection Error: ${errorDetails}`);
    const diagnosis = diagnoseLibreProblem(err, null, req.body?.region);
    addLog(`💡 Diagnosis: ${diagnosis.title} — ${diagnosis.suggestion}`);
    logGlucoseActivity('/api/libre/test-connection', 'ERROR', `Test connection failed: ${diagnosis.friendlyMessage}`, { error: errorDetails });

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
      logGlucoseActivity('/api/libre/login', 'WARN', 'Login attempt rejected: missing email or password.');
      return res.status(400).json({ success: false, error: 'Email and password are required' });
    }

    const maskedEmail = email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
    logGlucoseActivity('/api/libre/login', 'INFO', `Logging in account: ${maskedEmail} (Region: ${region})`);

    const defaultApiUrl = REGION_URLS[region.toUpperCase()] || REGION_URLS['GLOBAL'];
    const ClientClass = await getLibreLinkClient();

    if (!ClientClass) {
      throw new Error('librelinkup-api-client library could not be loaded.');
    }

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
      logGlucoseActivity('/api/libre/login', 'WARN', `Login succeeded for ${maskedEmail} but no shared connections found.`);
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
    const patientId = primaryPatient.patientId || primaryPatient.id;
    const patientName = `${primaryPatient.firstName || ''} ${primaryPatient.lastName || ''}`.trim() || 'Patient';

    logGlucoseActivity('/api/libre/login', 'SUCCESS', `Login succeeded: Patient="${patientName}" (ID: ${patientId})`);

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
  } catch (error) {
    console.error('LibreLinkUp login error:', error.message);
    const diagnosis = diagnoseLibreProblem(error, null, req.body?.region);
    logGlucoseActivity('/api/libre/login', 'ERROR', `Login error: ${diagnosis.friendlyMessage}`, { raw: error.message });
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
  const { token, accountId, baseUrl, patientId, region = 'US', email, password, userId } = req.body;
  const maskedEmail = email ? email.replace(/(.{2})(.*)(@.*)/, '$1***$3') : 'N/A';

  logGlucoseActivity('/api/libre/readings', 'INFO', `Fetch request: patientId=${patientId || '(auto)'}, region=${region}, account=${maskedEmail}`);

  try {
    let activeBaseUrl = baseUrl || REGION_URLS[region.toUpperCase()] || REGION_URLS['GLOBAL'];
    let activeAccountId = accountId || (userId ? calculateAccountId(userId) : '');
    let activeToken = token;
    let activePatientId = patientId;

    const ClientClass = await getLibreLinkClient();
    if (!ClientClass) {
      throw new Error('librelinkup-api-client library could not be loaded.');
    }

    if (!email || !password) {
      logGlucoseActivity('/api/libre/readings', 'WARN', 'Readings request missing email/password credentials.');
      return res.status(400).json({ success: false, error: 'Email and password are required for LibreLinkUp' });
    }

    logGlucoseActivity('/api/libre/readings', 'INFO', 'Using librelinkup-api-client to fetch readings...');
    const client = new ClientClass({
      email: email.trim(),
      password: password.trim(),
      apiUrl: activeBaseUrl,
      patientId: activePatientId || undefined,
      lluVersion: '4.16.0'
    });

    if (activeToken) {
      client.accessToken = activeToken;
    }

    let rawReading = null;
    let didReauth = false;

    try {
      rawReading = await client.fetchReading();
    } catch (fetchErr) {
      logGlucoseActivity('/api/libre/readings', 'INFO', `Initial fetch note (${fetchErr.message}). Performing login refresh...`);
      await client.login();
      rawReading = await client.fetchReading();
      activeToken = client.accessToken;
      activeAccountId = client.me?.id ? calculateAccountId(client.me.id) : activeAccountId;
      activeBaseUrl = client.apiUrl || activeBaseUrl;
      didReauth = true;
    }

    logGlucoseActivity('/api/libre/readings', 'INFO', `LibreClient reading response: status=${rawReading?.status}, keys=[${Object.keys(rawReading || {})}]`);

    const data = rawReading?.data || rawReading;

    if (!data) {
      logGlucoseActivity('/api/libre/readings', 'WARN', 'No reading payload returned from Abbott. Returning graceful sensor warmup status.');
      return res.json({
        success: true,
        isSensorWarmingUp: true,
        glucose: null,
        trendArrow: 3,
        timestamp: new Date().toISOString(),
        targetLow: 70,
        targetHigh: 180,
        isHigh: false,
        isLow: false,
        isUrgentLow: false,
        history: [],
        warning: 'Sensor is warming up or synchronizing latest data.',
        newToken: didReauth ? activeToken : undefined,
        newAccountId: didReauth ? activeAccountId : undefined,
        newBaseUrl: didReauth ? activeBaseUrl : undefined,
        newPatientId: didReauth ? activePatientId : undefined
      });
    }

    const connection = data.connection || {};
    const graphData = Array.isArray(data.graphData) ? data.graphData : [];
    const latestGraphPoint = graphData.length > 0 ? graphData[graphData.length - 1] : null;

    const currentMeasurement = connection.glucoseMeasurement || connection.glucoseItem || data.glucoseMeasurement || data.glucoseItem || latestGraphPoint;

    const targetLow = connection.targetLow || 70;
    const targetHigh = connection.targetHigh || 180;

    if (!currentMeasurement) {
      logGlucoseActivity('/api/libre/readings', 'WARN', 'No current measurement item in payload. Returning warmup state.');
      return res.json({
        success: true,
        isSensorWarmingUp: true,
        glucose: null,
        trendArrow: 3,
        timestamp: new Date().toISOString(),
        targetLow,
        targetHigh,
        isHigh: false,
        isLow: false,
        isUrgentLow: false,
        history: graphData.map(pt => ({
          Value: pt.ValueInMgPerDl !== undefined ? pt.ValueInMgPerDl : pt.Value,
          ValueInMgPerDl: pt.ValueInMgPerDl !== undefined ? pt.ValueInMgPerDl : pt.Value,
          Timestamp: pt.Timestamp || pt.timestamp
        })),
        warning: 'Sensor is warming up or synchronizing latest data.',
        newToken: didReauth ? activeToken : undefined,
        newAccountId: didReauth ? activeAccountId : undefined,
        newBaseUrl: didReauth ? activeBaseUrl : undefined,
        newPatientId: didReauth ? activePatientId : undefined
      });
    }

    const rawVal = currentMeasurement.ValueInMgPerDl !== undefined ? currentMeasurement.ValueInMgPerDl : currentMeasurement.Value;
    const glucoseVal = (rawVal !== undefined && rawVal !== null && !isNaN(rawVal)) ? Number(rawVal) : null;
    const trendArrow = currentMeasurement.TrendArrow !== undefined ? currentMeasurement.TrendArrow : (currentMeasurement.Trend !== undefined ? currentMeasurement.Trend : 3);
    const timestamp = currentMeasurement.Timestamp || currentMeasurement.timestamp || new Date().toISOString();

    const isHigh = Boolean(currentMeasurement.isHigh || (glucoseVal !== null && glucoseVal > targetHigh));
    const isLow = Boolean(currentMeasurement.isLow || (glucoseVal !== null && glucoseVal < targetLow));
    const isUrgentLow = Boolean(glucoseVal !== null && glucoseVal < 55);

    logGlucoseActivity('/api/libre/readings', 'SUCCESS', `Glucose extracted: ${glucoseVal} mg/dL (arrow: ${trendArrow}, points: ${graphData.length}, high=${isHigh}, low=${isLow})`);

    res.json({
      success: true,
      glucose: glucoseVal,
      trendArrow: trendArrow,
      timestamp: timestamp,
      targetLow: targetLow,
      targetHigh: targetHigh,
      isHigh,
      isLow,
      isUrgentLow,
      history: graphData.map(pt => ({
        Value: pt.ValueInMgPerDl !== undefined ? pt.ValueInMgPerDl : pt.Value,
        ValueInMgPerDl: pt.ValueInMgPerDl !== undefined ? pt.ValueInMgPerDl : pt.Value,
        Timestamp: pt.Timestamp || pt.timestamp
      })),
      newToken: didReauth ? activeToken : undefined,
      newAccountId: didReauth ? activeAccountId : undefined,
      newBaseUrl: didReauth ? activeBaseUrl : undefined,
      newPatientId: didReauth ? activePatientId : undefined
    });
  } catch (error) {
    const errorDetails = error.message;
    const diagnosis = diagnoseLibreProblem(error, null, req.body?.region);
    const status = error.message && error.message.includes('Invalid credentials') ? 401 : 502;

    logGlucoseActivity('/api/libre/readings', 'ERROR', `Failed to fetch readings: ${diagnosis.friendlyMessage} (HTTP ${status})`, { error: errorDetails });

    res.status(status).json({
      success: false,
      error: diagnosis.friendlyMessage,
      errorTitle: diagnosis.title,
      suggestion: diagnosis.suggestion,
      rawError: errorDetails
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

// Zmanim Fast End & Yom Kippur Schedule Calculation via kosher-zmanim
const KosherZmanim = require('kosher-zmanim');

// Helper: Calculate full Yom Kippur Schedule & Status
function calculateYomKippurSchedule({
  lat,
  lng,
  elevation = 0,
  timeZoneId,
  additionalMinutes = 0,
  method = 'geonim85',
  manualDate = null,
  manualTime = null,
  isManual = false,
  now = null
}) {
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
  const zcal = new KosherZmanim.ComplexZmanimCalendar(location);

  // Determine reference time in target timezone
  let nowDt;
  if (now) {
    if (typeof now === 'string') {
      nowDt = KosherZmanim.DateTime.fromISO(now, { zone: tz });
      if (!nowDt.isValid) nowDt = KosherZmanim.DateTime.fromJSDate(new Date(now)).setZone(tz);
    } else {
      nowDt = KosherZmanim.DateTime.fromJSDate(now).setZone(tz);
    }
  } else {
    nowDt = KosherZmanim.DateTime.now().setZone(tz);
  }

  let erevDt, ykDt, targetYear = null;

  if (isManual && manualDate) {
    // Manual date mode specified by user
    ykDt = KosherZmanim.DateTime.fromISO(manualDate, { zone: tz });
    erevDt = ykDt.minus({ days: 1 });
  } else {
    // Auto-detect Yom Kippur using Jewish Calendar
    const jc = new KosherZmanim.JewishCalendar();
    jc.setDate(nowDt);

    const jMonth = jc.getJewishMonth();
    const jDay = jc.getJewishDayOfMonth();
    const jYear = jc.getJewishYear();

    if (jMonth < KosherZmanim.JewishCalendar.TISHREI) {
      targetYear = jYear + 1;
    } else if (jMonth === KosherZmanim.JewishCalendar.TISHREI) {
      targetYear = (jDay <= 10) ? jYear : jYear + 1;
    } else {
      targetYear = jYear + 1;
    }

    const erevYK = new KosherZmanim.JewishCalendar(targetYear, KosherZmanim.JewishCalendar.TISHREI, 9);
    const ykDay = new KosherZmanim.JewishCalendar(targetYear, KosherZmanim.JewishCalendar.TISHREI, 10);
    erevDt = erevYK.getDate().setZone(tz);
    ykDt = ykDay.getDate().setZone(tz);
  }

  // Calculate Erev Yom Kippur Zmanim (Fast Start)
  zcal.setDate(erevDt);
  const erevSunset = zcal.getSunset();
  const candleLighting = zcal.getCandleLighting();
  const fastStart = candleLighting || (erevSunset ? erevSunset.minus({ minutes: 18 }) : null);

  // Calculate Yom Kippur Day Zmanim (Fast End)
  zcal.setDate(ykDt);
  const ykSunset = zcal.getSunset();
  let baseTzais = zcal.getTzaisGeonim8Point5Degrees();

  if (method === 'sunset72') {
    baseTzais = zcal.getTzais72();
  } else if (method === 'sunset42' && ykSunset) {
    baseTzais = ykSunset.plus({ minutes: 42 });
  } else if (method === 'sunset50' && ykSunset) {
    baseTzais = ykSunset.plus({ minutes: 50 });
  }

  if (!baseTzais && ykSunset) {
    baseTzais = ykSunset.plus({ minutes: 42 });
  }

  let finalFastEnd;
  if (isManual && manualTime) {
    const [mH, mM] = manualTime.split(':').map(Number);
    finalFastEnd = ykDt.set({ hour: mH || 19, minute: mM || 45, second: 0, millisecond: 0 });
  } else {
    finalFastEnd = baseTzais ? baseTzais.plus({ minutes: parsedExtra }) : null;
  }

  // Determine fast status
  const nowMillis = nowDt.toMillis();
  const fastStartMillis = fastStart ? fastStart.toMillis() : null;
  const fastEndMillis = finalFastEnd ? finalFastEnd.toMillis() : null;

  let status = 'BEFORE_FAST';
  if (fastEndMillis && nowMillis >= fastEndMillis) {
    status = 'FAST_CONCLUDED';
  } else if (fastStartMillis && nowMillis >= fastStartMillis) {
    status = 'FAST_ACTIVE';
  }

  const isYomKippurNight = (status === 'FAST_ACTIVE' && nowDt.toISODate() === erevDt.toISODate());
  const isYomKippurDay = (status === 'FAST_ACTIVE' && nowDt.toISODate() === ykDt.toISODate());

  const hf = new KosherZmanim.HebrewDateFormatter();
  hf.setHebrewFormat(false);
  const jcDisplay = new KosherZmanim.JewishCalendar(targetYear || 5787, KosherZmanim.JewishCalendar.TISHREI, 10);
  const hebrewDateStr = hf.format(jcDisplay);

  return {
    success: true,
    status,
    isYomKippurNight,
    isYomKippurDay,
    isManual: Boolean(isManual && manualDate),
    targetYear,
    hebrewDateStr,

    // Fast Start info (Erev Yom Kippur)
    erevDate: erevDt.toISODate(),
    fastStartDate: erevDt.toISODate(),
    fastStartTimeFormatted: fastStart ? fastStart.setZone(tz).toFormat('HH:mm') : null,
    fastStartTimeISO: fastStart ? fastStart.toISO() : null,
    candleLightingFormatted: candleLighting ? candleLighting.setZone(tz).toFormat('HH:mm') : null,
    erevSunsetFormatted: erevSunset ? erevSunset.setZone(tz).toFormat('HH:mm') : null,

    // Fast End info (Yom Kippur Day)
    ykDate: ykDt.toISODate(),
    fastEndDate: ykDt.toISODate(),
    fastEndTimeFormatted: finalFastEnd ? finalFastEnd.setZone(tz).toFormat('HH:mm') : '19:45',
    fastEndTimeISO: finalFastEnd ? finalFastEnd.toISO() : null,
    ykSunsetFormatted: ykSunset ? ykSunset.setZone(tz).toFormat('HH:mm') : null,
    tzaisBaseFormatted: baseTzais ? baseTzais.setZone(tz).toFormat('HH:mm') : null,

    additionalMinutes: parsedExtra,
    locationName,
    location: {
      latitude: parsedLat,
      longitude: parsedLng,
      timeZoneId: tz
    },
    // Backwards compatibility field
    date: ykDt.toISODate()
  };
}

app.post('/api/zmanim/fast-end', (req, res) => {
  try {
    const {
      lat,
      lng,
      elevation = 0,
      timeZoneId,
      date = null,
      manualDate = null,
      manualTime = null,
      isManual = false,
      additionalMinutes = 0,
      method = 'geonim85',
      now = null
    } = req.body;

    const result = calculateYomKippurSchedule({
      lat,
      lng,
      elevation,
      timeZoneId,
      additionalMinutes,
      method,
      manualDate: manualDate || (isManual ? date : null),
      manualTime,
      isManual: isManual || Boolean(manualDate),
      now: now || (date && !isManual ? date : null)
    });

    res.json(result);
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
