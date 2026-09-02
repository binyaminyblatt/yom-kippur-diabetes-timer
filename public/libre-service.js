/**
 * LibreService - Abbott LibreLinkUp CGM Integration & Simulator
 */
class LibreService {
  constructor(options = {}) {
    this.isEnabled = options.isEnabled !== undefined ? options.isEnabled : true;
    this.isDemo = options.isDemo !== undefined ? options.isDemo : true;
    this.unit = options.unit || 'mgdl'; // 'mgdl' or 'mmol'
    this.region = options.region || 'US';
    this.email = '';
    this.password = '';
    this.token = null;
    this.accountId = null;
    this.baseUrl = null;
    this.patientId = null;
    this.patientName = 'Simulated User';
    this.pollIntervalSeconds = 60;
    this.pollTimerId = null;
    this.isConnected = false;

    // Thresholds
    this.targetLow = 70;
    this.targetHigh = 180;
    this.urgentLow = 55;

    // Callbacks
    this.onReading = options.onReading || (() => {});
    this.onStatusChange = options.onStatusChange || (() => {});
    this.onError = options.onError || (() => {});

    this.loadSettings();
  }

  loadSettings() {
    try {
      if (typeof localStorage === 'undefined') return;
      const saved = localStorage.getItem('yom_kippur_cgm_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.isEnabled = parsed.isEnabled !== undefined ? parsed.isEnabled : true;
        this.isDemo = parsed.isDemo !== undefined ? parsed.isDemo : true;
        this.unit = parsed.unit || 'mgdl';
        this.region = parsed.region || 'US';
        this.email = parsed.email || '';
        this.password = parsed.password || '';
        this.targetLow = parsed.targetLow || 70;
        this.targetHigh = parsed.targetHigh || 180;
        this.urgentLow = parsed.urgentLow || 55;
      }
    } catch (e) {
      console.warn('Failed to load CGM settings:', e);
    }
  }

  saveSettings() {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem('yom_kippur_cgm_settings', JSON.stringify({
        isEnabled: this.isEnabled,
        isDemo: this.isDemo,
        unit: this.unit,
        region: this.region,
        email: this.email,
        password: this.password,
        targetLow: this.targetLow,
        targetHigh: this.targetHigh,
        urgentLow: this.urgentLow
      }));
    } catch (e) {
      console.warn('Failed to save CGM settings:', e);
    }
  }

  setEnabled(enabled) {
    this.isEnabled = !!enabled;
    this.saveSettings();
    if (this.isEnabled) {
      this.start();
    } else {
      this.stop();
    }
  }

  setUnit(unit) {
    this.unit = unit === 'mmol' ? 'mmol' : 'mgdl';
    this.saveSettings();
  }

  formatGlucose(mgdl) {
    if (mgdl === null || mgdl === undefined || isNaN(mgdl)) {
      return { value: '--', unit: this.unit === 'mmol' ? 'mmol/L' : 'mg/dL' };
    }
    if (this.unit === 'mmol') {
      const mmol = (mgdl / 18.0182).toFixed(1);
      return { value: mmol, unit: 'mmol/L' };
    }
    return { value: Math.round(mgdl), unit: 'mg/dL' };
  }

  getTrendInfo(arrowCode) {
    // 1: Falling fast, 2: Falling, 3: Steady, 4: Rising, 5: Rising fast
    switch (parseInt(arrowCode, 10)) {
      case 1:
        return { symbol: '↓↓', text: 'Falling rapidly', className: 'trend-falling-fast', angle: 90 };
      case 2:
        return { symbol: '↓', text: 'Falling', className: 'trend-falling', angle: 45 };
      case 3:
        return { symbol: '→', text: 'Steady', className: 'trend-steady', angle: 0 };
      case 4:
        return { symbol: '↑', text: 'Rising', className: 'trend-rising', angle: -45 };
      case 5:
        return { symbol: '↑↑', text: 'Rising rapidly', className: 'trend-rising-fast', angle: -90 };
      default:
        return { symbol: '→', text: 'Steady', className: 'trend-steady', angle: 0 };
    }
  }

  async start() {
    if (this.pollTimerId) clearInterval(this.pollTimerId);

    if (!this.isEnabled) {
      this.isConnected = false;
      this.onStatusChange({ isEnabled: false, isConnected: false, statusText: 'CGM Monitor Disabled' });
      return;
    }

    if (this.isDemo) {
      this.isConnected = true;
      this.onStatusChange({ isEnabled: true, isConnected: true, isDemo: true, name: 'Demo Simulator' });
      await this.fetchDemoData();
      this.pollTimerId = setInterval(() => this.fetchDemoData(), this.pollIntervalSeconds * 1000);
      return;
    }

    if (!this.email || !this.password) {
      this.onError('Please enter LibreLinkUp email & password in Settings, or use Demo Mode.');
      this.isDemo = true;
      await this.start();
      return;
    }

    const loginSuccess = await this.login();
    if (loginSuccess) {
      await this.fetchLiveReadings();
      this.pollTimerId = setInterval(() => this.fetchLiveReadings(), this.pollIntervalSeconds * 1000);
    } else {
      this.onError('LibreLinkUp login failed. Falling back to Demo Mode.');
      this.isDemo = true;
      await this.start();
    }
  }

  stop() {
    if (this.pollTimerId) {
      clearInterval(this.pollTimerId);
      this.pollTimerId = null;
    }
    this.isConnected = false;
    this.onStatusChange({ isEnabled: this.isEnabled, isConnected: false, isDemo: this.isDemo, name: '' });
  }

  async login() {
    try {
      this.onStatusChange({ isConnected: false, isDemo: false, statusText: 'Connecting to LibreLinkUp...' });
      const resp = await fetch('/api/libre/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: this.email,
          password: this.password,
          region: this.region
        })
      });
      const data = await resp.json();
      if (!data.success) {
        const errorMsg = data.error || 'Login failed';
        const fullMsg = data.suggestion ? `${errorMsg} (${data.suggestion})` : errorMsg;
        throw new Error(fullMsg);
      }

      this.token = data.token;
      this.userId = data.userId;
      this.accountId = data.accountId;
      this.baseUrl = data.baseUrl;
      this.patientId = data.patientId;
      this.patientName = data.patientName || 'Patient';
      this.isConnected = true;

      this.onStatusChange({
        isConnected: true,
        isDemo: false,
        name: this.patientName
      });
      return true;
    } catch (err) {
      console.error('[LibreLinkUp] Login error:', err);
      this.onError(`LibreLinkUp Error: ${err.message}`);
      return false;
    }
  }

  async fetchLiveReadings(isRetry = false) {
    if (!this.token && this.email && this.password) {
      await this.login();
    }
    if (!this.token || !this.patientId) return;

    try {
      const resp = await fetch('/api/libre/readings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: this.token,
          accountId: this.accountId,
          baseUrl: this.baseUrl,
          patientId: this.patientId,
          region: this.region,
          email: this.email,
          password: this.password,
          userId: this.userId
        })
      });
      const res = await resp.json();

      // If backend auto-renewed token
      if (res.newToken) this.token = res.newToken;
      if (res.newAccountId) this.accountId = res.newAccountId;
      if (res.newBaseUrl) this.baseUrl = res.newBaseUrl;
      if (res.newPatientId) this.patientId = res.newPatientId;

      if (!res.success) {
        // If auth failed and we haven't retried yet, try relogin once
        if (!isRetry && this.email && this.password) {
          const relogged = await this.login();
          if (relogged) {
            return await this.fetchLiveReadings(true);
          }
        }
        const errorMsg = res.error || 'Failed to fetch readings';
        const fullMsg = res.suggestion ? `${errorMsg} (${res.suggestion})` : errorMsg;
        throw new Error(fullMsg);
      }

      if (res.isSensorWarmingUp) {
        this.onStatusChange({
          isConnected: true,
          isDemo: false,
          name: this.patientName,
          statusText: 'Sensor Warming Up...'
        });
        this.onReading({
          glucose: null,
          isSensorWarmingUp: true,
          trendArrow: 3,
          timestamp: res.timestamp || new Date().toISOString(),
          targetLow: this.targetLow || res.targetLow,
          targetHigh: this.targetHigh || res.targetHigh,
          urgentLow: this.urgentLow || res.urgentLow,
          isHigh: false,
          isLow: false,
          isUrgentLow: false,
          history: res.history || [],
          warning: res.warning || 'Sensor is warming up / syncing',
          isDemo: false
        });
        return;
      }

      this.onReading({
        glucose: res.glucose,
        trendArrow: res.trendArrow,
        timestamp: res.timestamp,
        targetLow: this.targetLow || res.targetLow,
        targetHigh: this.targetHigh || res.targetHigh,
        urgentLow: this.urgentLow || res.urgentLow,
        isHigh: res.glucose !== null && res.glucose > this.targetHigh,
        isLow: res.glucose !== null && res.glucose < this.targetLow,
        isUrgentLow: res.glucose !== null && res.glucose < this.urgentLow,
        history: res.history || [],
        isDemo: false
      });
    } catch (err) {
      console.warn('Error fetching live readings:', err);
      if (!isRetry && this.email && this.password) {
        try {
          const relogged = await this.login();
          if (relogged) {
            return await this.fetchLiveReadings(true);
          }
        } catch (e) {}
      }
      this.onError(`Failed to update CGM: ${err.message}`);
    }
  }

  async fetchDemoData() {
    try {
      const resp = await fetch('/api/libre/demo');
      const res = await resp.json();
      if (res.success && res.data) {
        const d = res.data;
        this.onReading({
          glucose: d.glucose,
          trendArrow: d.trendArrow,
          timestamp: d.timestamp,
          targetLow: this.targetLow,
          targetHigh: this.targetHigh,
          urgentLow: this.urgentLow,
          isHigh: d.glucose > this.targetHigh,
          isLow: d.glucose < this.targetLow,
          isUrgentLow: d.glucose < this.urgentLow,
          history: d.history || [],
          isDemo: true
        });
      }
    } catch (err) {
      console.warn('Error fetching demo data:', err);
    }
  }

  /**
   * Set simulated glucose value directly for testing alarms
   */
  async setSimulatedGlucose(glucose, trendArrow = 3) {
    try {
      await fetch('/api/libre/demo/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ glucose, trendArrow })
      });
      await this.fetchDemoData();
    } catch (e) {
      console.warn('Set demo glucose error:', e);
    }
  }
}

// Global instance & CommonJS export
if (typeof window !== 'undefined') {
  window.LibreService = LibreService;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = LibreService;
}
