/**
 * Yom Kippur Diabetes Interval Timer & LibreLinkUp CGM
 * Master Application Controller
 */

document.addEventListener('DOMContentLoaded', () => {
  // --------------------------------------------------------------------------
  // 1. Instances & State
  // --------------------------------------------------------------------------
  const audio = window.audioEngine;
  let chart = null;
  let timer = null;
  let libre = null;

  let wakeLockSentinel = null;
  let currentAlarmTimer = null;
  let alarmSnoozedUntil = 0;
  let lastChimeTriggerTime = 0;

  // DOM Elements - Navigation & System
  const wallClockEl = document.getElementById('wallClock');
  const wakeLockBadge = document.getElementById('wakeLockBadge');
  const wakeLockText = document.getElementById('wakeLockText');
  const btnFullscreen = document.getElementById('btnFullscreen');
  const btnAmbient = document.getElementById('btnAmbient');
  const btnSettings = document.getElementById('btnSettings');
  const screenFlash = document.getElementById('screenFlash');

  // DOM Elements - Lock Shield & Passcode
  const btnLockToggle = document.getElementById('btnLockToggle');
  const lockIcon = document.getElementById('lockIcon');
  const lockToggleText = document.getElementById('lockToggleText');
  const lockShieldBanner = document.getElementById('lockShieldBanner');
  const btnBannerUnlock = document.getElementById('btnBannerUnlock');
  const passcodeModal = document.getElementById('passcodeModal');
  const btnClosePasscodeModal = document.getElementById('btnClosePasscodeModal');
  const pinDotsContainer = document.getElementById('pinDotsContainer');
  const passcodeErrorMsg = document.getElementById('passcodeErrorMsg');
  const inputLockPasscode = document.getElementById('inputLockPasscode');
  const checkAutoLock = document.getElementById('checkAutoLock');
  const inputPasscodePin = document.getElementById('inputPasscodePin');
  const btnSubmitPin = document.getElementById('btnSubmitPin');
  const displayUnlockPin = document.getElementById('displayUnlockPin');
  const passcodeTimeoutCountdown = document.getElementById('passcodeTimeoutCountdown');
  const pinKeys = document.querySelectorAll('.pin-key');

  // DOM Elements - Checklist Modal
  const checklistModal = document.getElementById('checklistModal');
  const btnCloseChecklistModal = document.getElementById('btnCloseChecklistModal');
  const btnHeaderChecklist = document.getElementById('btnHeaderChecklist');
  const btnOpenChecklistFromSettings = document.getElementById('btnOpenChecklistFromSettings');
  const btnChecklistGoSettings = document.getElementById('btnChecklistGoSettings');
  const btnChecklistDone = document.getElementById('btnChecklistDone');
  const checkHideStartupChecklist = document.getElementById('checkHideStartupChecklist');

  // DOM Elements - Exit App Modal
  const btnExitApp = document.getElementById('btnExitApp');
  const btnExitFromSettings = document.getElementById('btnExitFromSettings');
  const exitConfirmModal = document.getElementById('exitConfirmModal');
  const btnCloseExitModal = document.getElementById('btnCloseExitModal');
  const btnCancelExit = document.getElementById('btnCancelExit');
  const btnConfirmExit = document.getElementById('btnConfirmExit');

  // DOM Elements - Timer
  const displayTargetInterval = document.getElementById('displayTargetInterval');
  const displayHalfInterval = document.getElementById('displayHalfInterval');
  const progressRingBar = document.getElementById('progressRingBar');
  const nextChimeTag = document.getElementById('nextChimeTag');
  const masterCountdownDigits = document.getElementById('masterCountdownDigits');
  const nextChimeBadge = document.getElementById('nextChimeBadge');
  const nextChimeName = document.getElementById('nextChimeName');
  const presetButtons = document.querySelectorAll('.btn-preset');
  const selectQuickSoundProfile = document.getElementById('selectQuickSoundProfile');
  const selectModalSoundProfile = document.getElementById('selectModalSoundProfile');
  
  const trackACard = document.getElementById('trackACard');
  const trackACountdown = document.getElementById('trackACountdown');
  const trackAInterval = document.getElementById('trackAInterval');
  const trackAToneLabel = document.getElementById('trackAToneLabel');
  const btnTestA = document.getElementById('btnTestA');
  const btnSyncA = document.getElementById('btnSyncA');

  const trackBCard = document.getElementById('trackBCard');
  const trackBCountdown = document.getElementById('trackBCountdown');
  const trackBInterval = document.getElementById('trackBInterval');
  const trackBToneLabel = document.getElementById('trackBToneLabel');
  const btnTestB = document.getElementById('btnTestB');
  const btnSyncB = document.getElementById('btnSyncB');

  const btnStartPause = document.getElementById('btnStartPause');
  const startPauseIcon = document.getElementById('startPauseIcon');
  const startPauseText = document.getElementById('startPauseText');
  const btnReset = document.getElementById('btnReset');
  const btnFastForward = document.getElementById('btnFastForward');

  // DOM Elements - Fast End & Yom Kippur Schedule
  const headerFastEndCountdown = document.getElementById('headerFastEndCountdown');
  const displayFastEndTime = document.getElementById('displayFastEndTime');
  const displayFastEndDate = document.getElementById('displayFastEndDate');
  const displayFastEndLocation = document.getElementById('displayFastEndLocation');
  const displayFastEndRemaining = document.getElementById('displayFastEndRemaining');
  const displayRemainingIntervals = document.getElementById('displayRemainingIntervals');
  const displayFastStartNote = document.getElementById('displayFastStartNote');
  const fastStatusBadge = document.getElementById('fastStatusBadge');
  const selectFastEndExtra = document.getElementById('selectFastEndExtra');
  const selectFastScheduleMode = document.getElementById('selectFastScheduleMode');
  const autoZmanimSummary = document.getElementById('autoZmanimSummary');
  const manualFastFields = document.getElementById('manualFastFields');
  const zmanimHebrewYear = document.getElementById('zmanimHebrewYear');
  const summaryFastStart = document.getElementById('summaryFastStart');
  const summaryFastEnd = document.getElementById('summaryFastEnd');
  const inputFastEndTime = document.getElementById('inputFastEndTime');
  const inputFastEndDate = document.getElementById('inputFastEndDate');

  // DOM Elements - CGM
  const cgmCard = document.getElementById('cgmCard');
  const btnToggleCGM = document.getElementById('btnToggleCGM');
  const cgmToggleText = document.getElementById('cgmToggleText');
  const cgmDisabledOverlay = document.getElementById('cgmDisabledOverlay');
  const btnEnableCGM = document.getElementById('btnEnableCGM');
  const cgmConnectionBadge = document.getElementById('cgmConnectionBadge');
  const cgmConnectionText = document.getElementById('cgmConnectionText');
  const btnToggleUnit = document.getElementById('btnToggleUnit');
  const glucoseValue = document.getElementById('glucoseValue');
  const glucoseUnitDisplay = document.getElementById('glucoseUnitDisplay');
  const trendArrowBadge = document.getElementById('trendArrowBadge');
  const trendArrowSymbol = document.getElementById('trendArrowSymbol');
  const trendArrowText = document.getElementById('trendArrowText');
  const glucoseStatusBadge = document.getElementById('glucoseStatusBadge');
  const cgmUpdatedTime = document.getElementById('cgmUpdatedTime');
  const displayTargetLow = document.getElementById('displayTargetLow');
  const displayTargetHigh = document.getElementById('displayTargetHigh');
  const alarmBanner = document.getElementById('alarmBanner');
  const alarmTitle = document.getElementById('alarmTitle');
  const alarmMessage = document.getElementById('alarmMessage');
  const btnSnoozeAlarm = document.getElementById('btnSnoozeAlarm');
  const cgmCanvas = document.getElementById('cgmChart');
  const demoButtons = document.querySelectorAll('.btn-demo-val');

  // DOM Elements - Modal & Settings
  const settingsModal = document.getElementById('settingsModal');
  const btnCloseModal = document.getElementById('btnCloseModal');
  const btnSaveSettings = document.getElementById('btnSaveSettings');
  const inputIntervalMin = document.getElementById('inputIntervalMin');
  const inputIntervalSec = document.getElementById('inputIntervalSec');
  const inputVolume = document.getElementById('inputVolume');
  const volumeVal = document.getElementById('volumeVal');
  const inputAutoShutoff = document.getElementById('inputAutoShutoff');
  const checkSpeech = document.getElementById('checkSpeech');
  const checkCGMEnabled = document.getElementById('checkCGMEnabled');
  const checkDemoMode = document.getElementById('checkDemoMode');
  const liveLibreFields = document.getElementById('liveLibreFields');
  const inputLibreEmail = document.getElementById('inputLibreEmail');
  const inputLibrePassword = document.getElementById('inputLibrePassword');
  const selectLibreRegion = document.getElementById('selectLibreRegion');
  const inputTargetLow = document.getElementById('inputTargetLow');
  const inputTargetHigh = document.getElementById('inputTargetHigh');
  const btnTestModalA = document.getElementById('btnTestModalA');
  const btnTestModalB = document.getElementById('btnTestModalB');
  const btnTestModalAlarm = document.getElementById('btnTestModalAlarm');
  const btnTestModalVoice = document.getElementById('btnTestModalVoice');

  // --------------------------------------------------------------------------
  // 2. Initialize Chart & Services
  // --------------------------------------------------------------------------
  chart = new ChartRenderer(cgmCanvas);

  // Initialize Timer Engine
  timer = new TimerEngine({
    intervalSeconds: 540, // 9 minutes default
    onTick: updateTimerUI,
    onChime: handleChimeTrigger
  });

  // Initialize LibreLinkUp Service
  libre = new LibreService({
    onReading: handleCGMReading,
    onStatusChange: handleCGMStatusChange,
    onError: handleCGMError
  });

  // --------------------------------------------------------------------------
  // 3. Yom Kippur Fast Schedule & Zmanim Engine (kosher-zmanim & Geolocation)
  // --------------------------------------------------------------------------
  const todayStr = new Date().toISOString().split('T')[0];
  let scheduleMode = 'auto'; // 'auto' | 'manual'
  let fastStartDate = null;
  let fastStartTime = null;
  let fastStartTimeISO = null;
  let fastEndDate = null;
  let fastEndTime = '19:45';
  let fastEndTimeISO = null;
  let fastScheduleStatus = 'BEFORE_FAST';
  let isYomKippurNight = false;
  let isYomKippurDay = false;
  let hebrewYearStr = 'Yom Kippur';
  let detectedLat = 31.7683;
  let detectedLng = 35.2137;
  let detectedLocationName = 'Auto-Detected Location';
  let extraMinutes = 18;

  try {
    const savedMode = localStorage.getItem('yom_kippur_schedule_mode');
    if (savedMode) scheduleMode = savedMode;
    const savedEndTime = localStorage.getItem('yom_kippur_fast_end_time');
    if (savedEndTime) fastEndTime = savedEndTime;
    const savedEndDate = localStorage.getItem('yom_kippur_fast_end_date');
    if (savedEndDate) fastEndDate = savedEndDate;
    const savedExtra = localStorage.getItem('yom_kippur_fast_end_extra');
    if (savedExtra !== null) {
      extraMinutes = parseInt(savedExtra, 10);
      selectFastEndExtra.value = String(extraMinutes);
    }
  } catch (e) {}

  displayFastEndTime.textContent = fastEndTime;
  if (inputFastEndTime) inputFastEndTime.value = fastEndTime;
  if (inputFastEndDate && fastEndDate) inputFastEndDate.value = fastEndDate;

  // Helper: Format date string for user-friendly display (e.g., 'Mon, Sep 21')
  function formatDisplayDate(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
  }

  // Function: Fetch exact Yom Kippur Schedule & Fast End time from server kosher-zmanim calculation
  async function fetchZmanimFastEnd() {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jerusalem';
      const bodyPayload = {
        lat: detectedLat,
        lng: detectedLng,
        timeZoneId: tz,
        additionalMinutes: extraMinutes,
        isManual: scheduleMode === 'manual'
      };

      if (scheduleMode === 'manual' && fastEndDate) {
        bodyPayload.manualDate = fastEndDate;
        bodyPayload.manualTime = fastEndTime;
      }

      const resp = await fetch('/api/zmanim/fast-end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload)
      });
      const data = await resp.json();
      if (data.success) {
        fastStartDate = data.fastStartDate || data.erevDate;
        fastStartTime = data.fastStartTimeFormatted;
        fastStartTimeISO = data.fastStartTimeISO;
        fastEndDate = data.fastEndDate || data.ykDate;
        fastEndTime = data.fastEndTimeFormatted;
        fastEndTimeISO = data.fastEndTimeISO;
        fastScheduleStatus = data.status;
        isYomKippurNight = Boolean(data.isYomKippurNight);
        isYomKippurDay = Boolean(data.isYomKippurDay);
        hebrewYearStr = data.hebrewDateStr || (data.targetYear ? `Yom Kippur ${data.targetYear}` : 'Yom Kippur');

        displayFastEndTime.textContent = fastEndTime;
        if (inputFastEndTime) inputFastEndTime.value = fastEndTime;
        if (inputFastEndDate) inputFastEndDate.value = fastEndDate;

        const locTitle = data.locationName || detectedLocationName;
        displayFastEndLocation.textContent = `📍 ${locTitle} (+${extraMinutes}m)`;

        if (summaryFastStart) {
          summaryFastStart.textContent = `${formatDisplayDate(fastStartDate)} at ${fastStartTime || '--:--'}`;
        }
        if (summaryFastEnd) {
          summaryFastEnd.textContent = `${formatDisplayDate(fastEndDate)} at ${fastEndTime} (+${extraMinutes}m)`;
        }
        if (zmanimHebrewYear) {
          zmanimHebrewYear.textContent = hebrewYearStr;
        }

        updateFastEndCountdown();
      }
    } catch (err) {
      console.warn('Zmanim calculation fetch note:', err);
    }
  }

  // Automatic Location Detection (Instant Timezone Mapping + Optional GPS refinement)
  function initAutomaticLocation() {
    // 1. Instantly calculate for the detected timezone (0ms latency)
    fetchZmanimFastEnd();

    // 2. Optionally refine via GPS coordinates if available (quiet background check)
    if ('geolocation' in navigator) {
      try {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            detectedLat = pos.coords.latitude;
            detectedLng = pos.coords.longitude;
            detectedLocationName = `${detectedLat.toFixed(2)}°, ${detectedLng.toFixed(2)}°`;
            fetchZmanimFastEnd();
          },
          () => {
            // Geolocation not granted or timed out; timezone location is already active and accurate
          },
          { timeout: 3000, maximumAge: 3600000, enableHighAccuracy: false }
        );
      } catch (e) {}
    }
  }
  initAutomaticLocation();

  // Listen to Extra Time changes
  selectFastEndExtra.addEventListener('change', (e) => {
    extraMinutes = parseInt(e.target.value, 10) || 0;
    try {
      localStorage.setItem('yom_kippur_fast_end_extra', String(extraMinutes));
    } catch (err) {}
    fetchZmanimFastEnd();
  });

  function updateFastEndCountdown() {
    const now = new Date();
    wallClockEl.textContent = now.toLocaleTimeString([], { hour12: false });

    if (!fastEndTimeISO && !fastEndTime) return;

    // Determine target Date objects
    let targetEnd;
    if (fastEndTimeISO) {
      targetEnd = new Date(fastEndTimeISO);
    } else {
      const [hours, minutes] = fastEndTime.split(':').map(Number);
      targetEnd = new Date(fastEndDate || todayStr);
      targetEnd.setHours(hours, minutes, 0, 0);
    }

    let targetStart = null;
    if (fastStartTimeISO) {
      targetStart = new Date(fastStartTimeISO);
    } else if (fastStartDate && fastStartTime) {
      const [sH, sM] = fastStartTime.split(':').map(Number);
      targetStart = new Date(fastStartDate);
      targetStart.setHours(sH, sM, 0, 0);
    }

    const nowMs = now.getTime();
    const diffMsToEnd = targetEnd.getTime() - nowMs;
    const diffSecsToEnd = Math.floor(diffMsToEnd / 1000);

    const isFastStarted = targetStart ? (nowMs >= targetStart.getTime()) : true;
    const isFastEnded = diffSecsToEnd <= 0;

    // Date text beside time display
    if (displayFastEndDate && fastEndDate) {
      const isToday = now.toISOString().split('T')[0] === fastEndDate;
      displayFastEndDate.textContent = isToday ? '(Tonight)' : `(${formatDisplayDate(fastEndDate)})`;
    }

    if (isFastEnded) {
      headerFastEndCountdown.textContent = 'CONCLUDED';
      headerFastEndCountdown.classList.add('fast-end-concluded');
      displayFastEndRemaining.textContent = '🎉 Fast Concluded (Motzei Yom Kippur)';
      displayFastEndRemaining.classList.add('concluded');
      displayRemainingIntervals.textContent = '0 intervals left (Fast has ended)';
      if (fastStatusBadge) {
        fastStatusBadge.className = 'fast-status-chip badge-concluded';
        fastStatusBadge.textContent = '✓ Concluded';
      }
      if (displayFastStartNote) {
        displayFastStartNote.textContent = '';
      }
      return;
    }

    headerFastEndCountdown.classList.remove('fast-end-concluded');
    displayFastEndRemaining.classList.remove('concluded');

    const pad = (n) => String(n).padStart(2, '0');
    const h = Math.floor(diffSecsToEnd / 3600);
    const m = Math.floor((diffSecsToEnd % 3600) / 60);
    const s = diffSecsToEnd % 60;

    // Shiurim interval calculations
    const intervalSecs = timer ? timer.intervalSeconds : 540;
    const intervalsLeft = Math.floor(diffSecsToEnd / intervalSecs);
    const intervalMinStr = Math.round(intervalSecs / 60);

    if (isFastStarted) {
      // FAST ACTIVE (During Yom Kippur Night or Yom Kippur Day)
      headerFastEndCountdown.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
      displayFastEndRemaining.textContent = `${h}h ${m}m ${s}s remaining`;
      displayRemainingIntervals.textContent = `~${intervalsLeft} eating intervals left (${intervalMinStr}m each)`;

      if (fastStatusBadge) {
        const todayIso = now.toISOString().split('T')[0];
        if (isYomKippurNight || (fastStartDate && todayIso === fastStartDate && now.getHours() >= 17)) {
          fastStatusBadge.className = 'fast-status-chip badge-yk-night';
          fastStatusBadge.textContent = '🌙 Yom Kippur Night';
        } else {
          fastStatusBadge.className = 'fast-status-chip badge-yk-day';
          fastStatusBadge.textContent = '☀️ Yom Kippur Day';
        }
      }
      if (displayFastStartNote) {
        displayFastStartNote.textContent = '';
      }
    } else {
      // BEFORE FAST (Upcoming Yom Kippur)
      const days = Math.floor(h / 24);
      const remH = h % 24;
      if (days >= 1) {
        headerFastEndCountdown.textContent = `${days}d ${pad(remH)}h`;
        displayFastEndRemaining.textContent = `${days}d ${remH}h ${m}m until Motzei YK`;
      } else {
        headerFastEndCountdown.textContent = `${pad(h)}:${pad(m)}:${pad(s)}`;
        displayFastEndRemaining.textContent = `${h}h ${m}m ${s}s until Motzei YK`;
      }

      displayRemainingIntervals.textContent = `~${intervalsLeft} intervals during fast (${intervalMinStr}m each)`;

      if (fastStatusBadge) {
        fastStatusBadge.className = 'fast-status-chip badge-upcoming';
        fastStatusBadge.textContent = '⏳ Upcoming Fast';
      }
      if (displayFastStartNote && fastStartDate && fastStartTime) {
        displayFastStartNote.textContent = `Starts ${formatDisplayDate(fastStartDate)} at ${fastStartTime}`;
      }
    }
  }

  setInterval(updateFastEndCountdown, 1000);
  updateFastEndCountdown();

  // --------------------------------------------------------------------------
  // 4. Screen Wake Lock (Continuous 25 Hours Prevention of Sleep)
  // --------------------------------------------------------------------------
  async function requestWakeLock() {
    try {
      if ('wakeLock' in navigator) {
        wakeLockSentinel = await navigator.wakeLock.request('screen');
        wakeLockBadge.className = 'status-chip chip-active';
        wakeLockText.textContent = 'Screen Awake';
        wakeLockSentinel.addEventListener('release', () => {
          wakeLockBadge.className = 'status-chip';
          wakeLockText.textContent = 'Screen Unlocked';
        });
      } else {
        wakeLockText.textContent = 'WakeLock N/A';
      }
    } catch (err) {
      console.warn('Wake Lock request failed:', err);
      wakeLockText.textContent = 'Screen Active';
    }
  }
  requestWakeLock();
  document.addEventListener('visibilitychange', () => {
    if (wakeLockSentinel !== null && document.visibilityState === 'visible') {
      requestWakeLock();
    }
  });

  // --------------------------------------------------------------------------
  // 5. Timer UI Rendering
  // --------------------------------------------------------------------------
  const circumference = 2 * Math.PI * 105; // 659.73

  function updateTimerUI(state) {
    const T = state.intervalSeconds;
    const halfT = state.halfIntervalSeconds;

    displayTargetInterval.textContent = TimerEngine.formatTime(T);
    displayHalfInterval.textContent = TimerEngine.formatTime(halfT);

    // Track counts
    trackAInterval.textContent = `${Math.round(T / 60)}m`;
    trackBInterval.textContent = `${Math.round(T / 60)}m`;

    trackACountdown.textContent = TimerEngine.formatTime(state.trackA.remaining);
    trackBCountdown.textContent = TimerEngine.formatTime(state.trackB.remaining);

    // Master hero countdown
    masterCountdownDigits.textContent = TimerEngine.formatTime(state.nextChime.remaining);

    // Progress Ring offset
    const offset = circumference * (1 - state.nextChime.progress);
    progressRingBar.style.strokeDashoffset = offset;

    // Sound Profile descriptor helper
    const getProfileLabel = (type) => {
      const p = audio.soundProfile;
      if (p === 'zen-bowl') return type === 'A' ? 'Track A (Zen Meditation Bowl)' : 'Track B (Deep Serene Bowl)';
      if (p === 'warm-marimba') return type === 'A' ? 'Track A (Warm Marimba)' : 'Track B (Deep Wooden Mallet)';
      if (p === 'whisper-bell') return type === 'A' ? 'Track A (Whisper Wind Bell)' : 'Track B (Airy Low Bell)';
      if (p === 'water-pluck') return type === 'A' ? 'Track A (Gentle Water Pluck)' : 'Track B (Peaceful Low Pluck)';
      return type === 'A' ? 'Track A (Soft Cabin Bell)' : 'Track B (Soft Reverse Chime)';
    };

    if (state.nextChime.type === 'A') {
      progressRingBar.style.stroke = 'var(--accent-cyan)';
      nextChimeBadge.className = 'next-chime-pill chime-pill-a';
      nextChimeName.textContent = getProfileLabel('A');
      trackACard.classList.add('active-next');
      trackBCard.classList.remove('active-next');
    } else {
      progressRingBar.style.stroke = 'var(--accent-purple)';
      nextChimeBadge.className = 'next-chime-pill chime-pill-b';
      nextChimeName.textContent = getProfileLabel('B');
      trackBCard.classList.add('active-next');
      trackACard.classList.remove('active-next');
    }

    // Play/Pause button appearance
    if (state.isRunning) {
      btnStartPause.classList.remove('btn-primary');
      btnStartPause.classList.add('btn-secondary');
      startPauseText.textContent = 'Pause Timer';
      startPauseIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
    } else {
      btnStartPause.classList.add('btn-primary');
      btnStartPause.classList.remove('btn-secondary');
      startPauseText.textContent = state.totalElapsed > 0 ? 'Resume Timer' : 'Start Timer';
      startPauseIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
    }
  }

  // --------------------------------------------------------------------------
  // 6. Audio Cues & Visual Flashes (Alternating Ding-Dongs)
  // --------------------------------------------------------------------------
  function triggerScreenFlash() {
    screenFlash.classList.add('active');
    setTimeout(() => screenFlash.classList.remove('active'), 250);
  }

  function handleChimeTrigger(trackType) {
    const now = Date.now();
    if (now - lastChimeTriggerTime < 800) return; // Debounce
    lastChimeTriggerTime = now;

    triggerScreenFlash();

    if (trackType === 'A') {
      audio.playChimeA();
    } else {
      audio.playChimeB();
    }
  }

  // --------------------------------------------------------------------------
  // 7. CGM Reading & Auto-Silencing Alarms
  // --------------------------------------------------------------------------
  function handleCGMReading(data) {
    if (data.isSensorWarmingUp || data.glucose === null || data.glucose === undefined) {
      glucoseValue.textContent = '--';
      trendArrowSymbol.textContent = '⏳';
      trendArrowText.textContent = data.warning || 'Warming up / Syncing';
      trendArrowBadge.className = 'trend-badge trend-steady';
      glucoseValue.classList.remove('val-low', 'val-high');
      glucoseStatusBadge.className = 'glucose-status-pill status-in-range';
      glucoseStatusBadge.textContent = 'Sensor Syncing';
      cgmUpdatedTime.textContent = 'Syncing...';
      hideAlarmBanner();
      if (data.history && data.history.length > 0) {
        chart.setData(data.history, data.targetLow || 70, data.targetHigh || 180, libre.unit);
      }
      return;
    }

    const formatted = libre.formatGlucose(data.glucose);
    glucoseValue.textContent = formatted.value;
    glucoseUnitDisplay.textContent = formatted.unit;

    // Trend Arrow
    const trend = libre.getTrendInfo(data.trendArrow);
    trendArrowSymbol.textContent = trend.symbol;
    trendArrowText.textContent = trend.text;
    trendArrowBadge.className = `trend-badge ${trend.className}`;

    // Target Status Styling
    glucoseValue.classList.remove('val-low', 'val-high');
    glucoseStatusBadge.className = 'glucose-status-pill';

    if (data.isUrgentLow) {
      glucoseValue.classList.add('val-low');
      glucoseStatusBadge.classList.add('status-low');
      glucoseStatusBadge.textContent = 'URGENT LOW (< 55)';
      triggerGlucoseAlarm('urgent-low', data.glucose);
    } else if (data.isLow) {
      glucoseValue.classList.add('val-low');
      glucoseStatusBadge.classList.add('status-low');
      glucoseStatusBadge.textContent = 'Low Blood Glucose';
      triggerGlucoseAlarm('low', data.glucose);
    } else if (data.isHigh) {
      glucoseValue.classList.add('val-high');
      glucoseStatusBadge.classList.add('status-high');
      glucoseStatusBadge.textContent = 'High Blood Glucose';
      triggerGlucoseAlarm('high', data.glucose);
    } else {
      glucoseStatusBadge.classList.add('status-in-range');
      glucoseStatusBadge.textContent = 'In Target Range';
      hideAlarmBanner();
    }

    // Time since update
    cgmUpdatedTime.textContent = 'Updated just now';

    // Chart update
    chart.setData(data.history, data.targetLow, data.targetHigh, libre.unit);

    // Update threshold display labels
    const lowFormatted = libre.formatGlucose(data.targetLow);
    const highFormatted = libre.formatGlucose(data.targetHigh);
    displayTargetLow.textContent = `< ${lowFormatted.value} ${lowFormatted.unit}`;
    displayTargetHigh.textContent = `> ${highFormatted.value} ${highFormatted.unit}`;
  }

  function handleCGMStatusChange(status) {
    if (!libre.isEnabled || status.isEnabled === false) {
      cgmDisabledOverlay.classList.remove('hidden');
      cgmCard.classList.add('cgm-off');
      btnToggleCGM.classList.remove('active');
      cgmToggleText.textContent = 'CGM: Off';
      cgmConnectionBadge.className = 'status-chip';
      cgmConnectionText.textContent = 'Disabled';
      document.getElementById('demoControlsSection').classList.add('hidden');
      hideAlarmBanner();
      return;
    }

    cgmDisabledOverlay.classList.add('hidden');
    cgmCard.classList.remove('cgm-off');
    btnToggleCGM.classList.add('active');
    cgmToggleText.textContent = 'CGM: Active';

    if (status.isDemo) {
      cgmConnectionBadge.className = 'status-chip chip-demo';
      cgmConnectionText.textContent = 'Demo Simulator';
      document.getElementById('demoControlsSection').classList.remove('hidden');
    } else if (status.isConnected) {
      cgmConnectionBadge.className = 'status-chip chip-live';
      cgmConnectionText.textContent = status.name ? `Live: ${status.name}` : 'LibreLinkUp Live';
      document.getElementById('demoControlsSection').classList.add('hidden');
    } else {
      cgmConnectionBadge.className = 'status-chip';
      cgmConnectionText.textContent = status.statusText || 'Disconnected';
    }
  }

  function handleCGMError(errMsg) {
    console.warn('CGM Notice:', errMsg);
  }

  // --------------------------------------------------------------------------
  // 8. Auto-Silencing Alarm Logic (Yom Kippur Hands-Free Mode)
  // --------------------------------------------------------------------------
  function triggerGlucoseAlarm(type, glucoseVal) {
    if (!libre.isEnabled) return; // Strict silence if CGM is disabled
    const now = Date.now();
    if (now < alarmSnoozedUntil) {
      return; // Snoozed
    }

    // Show Alarm Banner
    alarmBanner.classList.remove('hidden');
    const autoShutoffSecs = audio.autoShutoffSeconds;

    if (type === 'urgent-low') {
      alarmTitle.textContent = `🚨 Urgent Low Glucose: ${glucoseVal} mg/dL`;
      alarmMessage.textContent = `Pikuach Nefesh: Fast-acting carbs recommended. Auto-silencing in ${autoShutoffSecs}s.`;
      audio.playUrgentLowAlert();
    } else if (type === 'low') {
      alarmTitle.textContent = `⚠️ Low Glucose Alert: ${glucoseVal} mg/dL`;
      alarmMessage.textContent = `Below target threshold. Auto-silencing in ${autoShutoffSecs}s.`;
      audio.playGlucoseAlert(true);
    } else if (type === 'high') {
      alarmTitle.textContent = `⚠️ High Glucose Alert: ${glucoseVal} mg/dL`;
      alarmMessage.textContent = `Above target threshold. Auto-silencing in ${autoShutoffSecs}s.`;
      audio.playGlucoseAlert(false);
    }

    // Auto-silence and clear visual alert after autoShutoffSecs so no human needs to touch device
    if (currentAlarmTimer) clearTimeout(currentAlarmTimer);
    currentAlarmTimer = setTimeout(() => {
      // Keep banner but stop active pulse/alarm until next cycle
      alarmMessage.textContent = 'Alarm silenced (Yom Kippur automatic mode).';
    }, autoShutoffSecs * 1000);
  }

  function hideAlarmBanner() {
    alarmBanner.classList.add('hidden');
    audio.stopAlarms();
    if (currentAlarmTimer) {
      clearTimeout(currentAlarmTimer);
      currentAlarmTimer = null;
    }
  }

  btnSnoozeAlarm.addEventListener('click', () => {
    alarmSnoozedUntil = Date.now() + 15 * 60 * 1000; // Snooze for 15 minutes
    audio.stopAlarms();
    hideAlarmBanner();
  });

  // --------------------------------------------------------------------------
  // 9. Presets & Controls Event Listeners
  // --------------------------------------------------------------------------
  presetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      presetButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const seconds = parseInt(btn.getAttribute('data-seconds'), 10);
      timer.setInterval(seconds);
      inputIntervalMin.value = Math.floor(seconds / 60);
      inputIntervalSec.value = seconds % 60;
    });
  });

  btnStartPause.addEventListener('click', () => {
    audio.init();
    if (timer.isRunning) {
      timer.pause();
    } else {
      timer.start();
      if (autoLockEnabled && !isLocked) {
        if (autoLockTimeout) clearTimeout(autoLockTimeout);
        autoLockTimeout = setTimeout(() => {
          if (timer && timer.isRunning && !isLocked) {
            setAppLocked(true);
          }
        }, 60000);
      }
    }
  });

  btnReset.addEventListener('click', () => {
    timer.reset();
  });

  btnFastForward.addEventListener('click', () => {
    timer.fastForward(30);
  });

  // Sync Buttons
  btnSyncA.addEventListener('click', () => {
    audio.init();
    timer.syncNow('A');
  });

  btnSyncB.addEventListener('click', () => {
    audio.init();
    timer.syncNow('B');
  });

  // Audio Preview Buttons
  btnTestA.addEventListener('click', () => {
    audio.playChimeA();
    triggerScreenFlash();
  });

  btnTestB.addEventListener('click', () => {
    audio.playChimeB();
    triggerScreenFlash();
  });

  // Unit Toggle (mg/dL <-> mmol/L)
  btnToggleUnit.addEventListener('click', () => {
    const nextUnit = libre.unit === 'mgdl' ? 'mmol' : 'mgdl';
    libre.setUnit(nextUnit);
    btnToggleUnit.textContent = nextUnit === 'mgdl' ? 'mg/dL' : 'mmol/L';
    if (libre.isDemo) {
      libre.fetchDemoData();
    } else {
      libre.fetchLiveReadings();
    }
  });

  // Demo Value Buttons
  demoButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const val = parseInt(btn.getAttribute('data-val'), 10);
      const trend = parseInt(btn.getAttribute('data-trend'), 10);
      libre.setSimulatedGlucose(val, trend);
    });
  });

  // --------------------------------------------------------------------------
  // 10. Navigation & Settings Modal
  // --------------------------------------------------------------------------
  async function lockKeyboardEscape() {
    try {
      if (navigator.keyboard && navigator.keyboard.lock) {
        await navigator.keyboard.lock(['Escape']);
      }
    } catch (e) {}
  }

  btnFullscreen.addEventListener('click', () => {
    if (isLocked) return;
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(lockKeyboardEscape).catch(err => console.warn(err));
    } else {
      document.exitFullscreen().catch(err => console.warn(err));
    }
  });

  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement) {
      lockKeyboardEscape();
    } else if (isLocked) {
      document.documentElement.requestFullscreen().then(lockKeyboardEscape).catch(() => {});
    }
  });

  // Function to apply sound profile across UI and audio engine
  function applySoundProfile(profileKey) {
    audio.setSoundProfile(profileKey);
    selectQuickSoundProfile.value = profileKey;
    selectModalSoundProfile.value = profileKey;

    if (profileKey === 'zen-bowl') {
      trackAToneLabel.textContent = 'Warm Meditation Bowl (C4)';
      trackBToneLabel.textContent = 'Deep Serene Bowl (A3)';
    } else if (profileKey === 'warm-marimba') {
      trackAToneLabel.textContent = 'Warm Wooden Marimba (E4/B4)';
      trackBToneLabel.textContent = 'Deep Wooden Mallet (G3/D4)';
    } else if (profileKey === 'whisper-bell') {
      trackAToneLabel.textContent = 'Whisper Wind Bell (F4)';
      trackBToneLabel.textContent = 'Airy Low Bell (C4)';
    } else if (profileKey === 'water-pluck') {
      trackAToneLabel.textContent = 'Gentle Water Pluck (G4)';
      trackBToneLabel.textContent = 'Peaceful Low Pluck (D4)';
    } else {
      trackAToneLabel.textContent = 'Soft Cabin Chime (High → Low)';
      trackBToneLabel.textContent = 'Soft Reverse Chime (Low → High)';
    }

    try {
      localStorage.setItem('yom_kippur_audio_profile', profileKey);
    } catch (e) {}
  }

  // Load saved sound settings
  try {
    const savedProfile = localStorage.getItem('yom_kippur_audio_profile');
    if (savedProfile) applySoundProfile(savedProfile);
    const savedVol = localStorage.getItem('yom_kippur_volume');
    if (savedVol !== null) {
      const v = parseFloat(savedVol);
      audio.setVolume(v);
      inputVolume.value = v;
      volumeVal.textContent = `${Math.round(v * 100)}%`;
    }
    const savedSpeech = localStorage.getItem('yom_kippur_speech_enabled');
    if (savedSpeech !== null) {
      const isSpeech = savedSpeech === 'true';
      audio.setSpeech(isSpeech);
      if (checkSpeech) checkSpeech.checked = isSpeech;
    }
    const savedAutoShutoff = localStorage.getItem('yom_kippur_auto_shutoff');
    if (savedAutoShutoff !== null) {
      audio.setAutoShutoffSeconds(savedAutoShutoff);
      if (inputAutoShutoff) inputAutoShutoff.value = savedAutoShutoff;
    }
  } catch (e) {}

  selectQuickSoundProfile.addEventListener('change', (e) => {
    applySoundProfile(e.target.value);
    audio.init();
    audio.playChimeA(); // Quick soothing preview
  });

  selectModalSoundProfile.addEventListener('change', (e) => {
    applySoundProfile(e.target.value);
  });

  btnAmbient.addEventListener('click', () => {
    const isAmbient = document.body.classList.toggle('ambient-mode');
    // In ambient / night sleep mode, reduce volume for maximum peace
    if (isAmbient) {
      audio.setVolume(Math.max(0.15, audio.masterVolume * 0.5));
    } else {
      audio.setVolume(parseFloat(inputVolume.value) || 0.50);
    }
  });

  // Toggle CGM Button (Main Dashboard Header)
  btnToggleCGM.addEventListener('click', () => {
    libre.setEnabled(!libre.isEnabled);
  });

  // Enable Button inside Disabled Overlay
  btnEnableCGM.addEventListener('click', () => {
    libre.setEnabled(true);
  });

  function openSettingsModal() {
    if (isLocked) return;
    inputIntervalMin.value = Math.floor(timer.targetInterval / 60);
    inputIntervalSec.value = timer.targetInterval % 60;

    // Yom Kippur Schedule fields
    if (selectFastScheduleMode) selectFastScheduleMode.value = scheduleMode;
    if (inputFastEndTime) inputFastEndTime.value = fastEndTime;
    if (inputFastEndDate) inputFastEndDate.value = fastEndDate || '';
    if (scheduleMode === 'manual') {
      if (manualFastFields) manualFastFields.classList.remove('hidden');
      if (autoZmanimSummary) autoZmanimSummary.classList.add('hidden');
    } else {
      if (manualFastFields) manualFastFields.classList.add('hidden');
      if (autoZmanimSummary) autoZmanimSummary.classList.remove('hidden');
    }

    selectModalSoundProfile.value = audio.soundProfile;
    inputVolume.value = audio.masterVolume;
    inputAutoShutoff.value = audio.autoShutoffSeconds;
    checkSpeech.checked = audio.speechEnabled;
    checkCGMEnabled.checked = libre.isEnabled;
    checkDemoMode.checked = libre.isDemo;
    inputLibreEmail.value = libre.email;
    inputLibrePassword.value = libre.password;
    selectLibreRegion.value = libre.region;
    inputTargetLow.value = libre.targetLow;
    inputTargetHigh.value = libre.targetHigh;
    inputLockPasscode.value = storedPin;
    checkAutoLock.checked = autoLockEnabled;

    if (libre.isDemo) {
      liveLibreFields.classList.add('hidden');
    } else {
      liveLibreFields.classList.remove('hidden');
    }

    settingsModal.classList.remove('hidden');
  }

  if (selectFastScheduleMode) {
    selectFastScheduleMode.addEventListener('change', (e) => {
      const mode = e.target.value;
      if (mode === 'manual') {
        if (manualFastFields) manualFastFields.classList.remove('hidden');
        if (autoZmanimSummary) autoZmanimSummary.classList.add('hidden');
      } else {
        if (manualFastFields) manualFastFields.classList.add('hidden');
        if (autoZmanimSummary) autoZmanimSummary.classList.remove('hidden');
      }
    });
  }

  function closeSettingsModal() {
    settingsModal.classList.add('hidden');
  }

  btnSettings.addEventListener('click', openSettingsModal);
  btnCloseModal.addEventListener('click', closeSettingsModal);

  // --------------------------------------------------------------------------
  // Checklist Modal Logic
  // --------------------------------------------------------------------------
  function openChecklistModal() {
    if (isLocked) return;
    if (checklistModal) {
      checklistModal.classList.remove('hidden');
      checklistModal.style.display = 'flex';
    }
  }

  function closeChecklistModal() {
    if (checklistModal) {
      checklistModal.classList.add('hidden');
      checklistModal.style.display = 'none';
      if (checkHideStartupChecklist) {
        try {
          localStorage.setItem('yom_kippur_hide_startup_checklist', checkHideStartupChecklist.checked ? 'true' : 'false');
        } catch (e) {}
      }
    }
  }

  if (btnHeaderChecklist) {
    btnHeaderChecklist.addEventListener('click', () => {
      if (!isLocked) openChecklistModal();
    });
  }

  if (btnOpenChecklistFromSettings) {
    btnOpenChecklistFromSettings.addEventListener('click', () => {
      closeSettingsModal();
      openChecklistModal();
    });
  }

  if (btnCloseChecklistModal) {
    btnCloseChecklistModal.addEventListener('click', closeChecklistModal);
  }

  if (btnChecklistDone) {
    btnChecklistDone.addEventListener('click', closeChecklistModal);
  }

  if (btnChecklistGoSettings) {
    btnChecklistGoSettings.addEventListener('click', () => {
      closeChecklistModal();
      openSettingsModal();
    });
  }

  if (checkHideStartupChecklist) {
    checkHideStartupChecklist.addEventListener('change', () => {
      try {
        localStorage.setItem('yom_kippur_hide_startup_checklist', checkHideStartupChecklist.checked ? 'true' : 'false');
      } catch (e) {}
    });
  }

  // Auto-open checklist on startup (if not opted out)
  try {
    const hideChecklist = localStorage.getItem('yom_kippur_hide_startup_checklist');
    if (checkHideStartupChecklist) {
      checkHideStartupChecklist.checked = hideChecklist === 'true';
    }
    if (hideChecklist !== 'true' && !isLocked) {
      setTimeout(openChecklistModal, 450);
    }
  } catch (e) {}

  // --------------------------------------------------------------------------
  // Exit Application Logic (with 15s Auto-Cancel on Inactivity)
  // --------------------------------------------------------------------------
  const exitTimeoutCountdown = document.getElementById('exitTimeoutCountdown');
  let exitTimeoutInterval = null;
  let exitTimeoutSeconds = 15;

  function openExitModal() {
    if (isLocked) return;
    if (exitConfirmModal) {
      exitTimeoutSeconds = 15;
      if (exitTimeoutCountdown) exitTimeoutCountdown.textContent = '15s';
      
      if (exitTimeoutInterval) {
        clearInterval(exitTimeoutInterval);
      }

      exitTimeoutInterval = setInterval(() => {
        exitTimeoutSeconds--;
        if (exitTimeoutCountdown) exitTimeoutCountdown.textContent = `${exitTimeoutSeconds}s`;
        if (exitTimeoutSeconds <= 0) {
          closeExitModal();
        }
      }, 1000);

      exitConfirmModal.classList.remove('hidden');
      exitConfirmModal.style.display = 'flex';
    }
  }

  function closeExitModal() {
    if (exitTimeoutInterval) {
      clearInterval(exitTimeoutInterval);
      exitTimeoutInterval = null;
    }
    if (exitConfirmModal) {
      exitConfirmModal.classList.add('hidden');
      exitConfirmModal.style.display = 'none';
    }
  }

  async function performAppExit() {
    if (exitTimeoutInterval) {
      clearInterval(exitTimeoutInterval);
      exitTimeoutInterval = null;
    }
    try {
      await fetch('/api/app/quit', { method: 'POST' });
    } catch (e) {}
    try {
      window.close();
    } catch (e) {}
  }

  if (btnExitApp) btnExitApp.addEventListener('click', openExitModal);
  if (btnExitFromSettings) {
    btnExitFromSettings.addEventListener('click', () => {
      closeSettingsModal();
      openExitModal();
    });
  }
  if (btnCloseExitModal) btnCloseExitModal.addEventListener('click', closeExitModal);
  if (btnCancelExit) btnCancelExit.addEventListener('click', closeExitModal);
  if (btnConfirmExit) btnConfirmExit.addEventListener('click', performAppExit);

  checkDemoMode.addEventListener('change', () => {
    liveLibreFields.classList.toggle('hidden', checkDemoMode.checked);
  });

  // LibreLinkUp Test Connection & Diagnostics UI
  const btnTestLibreLogin = document.getElementById('btnTestLibreLogin');
  const testLibreBtnText = document.getElementById('testLibreBtnText');
  const libreTestFeedback = document.getElementById('libreTestFeedback');
  const libreTestStatusBadge = document.getElementById('libreTestStatusBadge');
  const libreTestStatusTitle = document.getElementById('libreTestStatusTitle');
  const libreTestMessage = document.getElementById('libreTestMessage');
  const libreTestSuggestionBox = document.getElementById('libreTestSuggestionBox');
  const libreTestSuggestion = document.getElementById('libreTestSuggestion');
  const btnToggleLibreLogs = document.getElementById('btnToggleLibreLogs');
  const libreLogsToggleText = document.getElementById('libreLogsToggleText');
  const libreLogToggleArrow = document.getElementById('libreLogToggleArrow');
  const libreLogsConsole = document.getElementById('libreLogsConsole');

  if (btnToggleLibreLogs && libreLogsConsole) {
    btnToggleLibreLogs.addEventListener('click', () => {
      const isHidden = libreLogsConsole.classList.toggle('hidden');
      if (libreLogsToggleText) libreLogsToggleText.textContent = isHidden ? 'Show Diagnostic API Logs' : 'Hide Diagnostic API Logs';
      if (libreLogToggleArrow) libreLogToggleArrow.textContent = isHidden ? '▼' : '▲';
    });
  }

  if (btnTestLibreLogin) {
    btnTestLibreLogin.addEventListener('click', async () => {
      const email = inputLibreEmail.value.trim();
      const password = inputLibrePassword.value.trim();
      const region = selectLibreRegion.value;

      if (!email || !password) {
        libreTestFeedback.classList.remove('hidden', 'feedback-success', 'feedback-pending');
        libreTestFeedback.classList.add('feedback-error');
        libreTestStatusBadge.className = 'libre-badge badge-error';
        libreTestStatusBadge.textContent = 'Missing Info';
        libreTestStatusTitle.textContent = 'Email & Password Required';
        libreTestMessage.textContent = 'Please enter both your LibreLinkUp follower email and password above.';
        libreTestSuggestionBox.classList.remove('hidden');
        libreTestSuggestion.textContent = 'Use the follower account created in LibreLinkUp. If you do not have one yet, invite a follower in the main Libre 2 / Libre 3 app.';
        return;
      }

      btnTestLibreLogin.disabled = true;
      if (testLibreBtnText) testLibreBtnText.textContent = 'Testing Connection...';
      libreTestFeedback.classList.remove('hidden', 'feedback-success', 'feedback-error');
      libreTestFeedback.classList.add('feedback-pending');
      libreTestStatusBadge.className = 'libre-badge badge-pending';
      libreTestStatusBadge.textContent = 'Testing...';
      libreTestStatusTitle.textContent = 'Authenticating with Abbott Cloud...';
      libreTestMessage.textContent = `Connecting to ${region} regional endpoint and verifying follower credentials...`;
      libreTestSuggestionBox.classList.add('hidden');
      if (libreLogsConsole) libreLogsConsole.textContent = 'Connecting...';

      try {
        const resp = await fetch('/api/libre/test-connection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, region })
        });
        const data = await resp.json();

        if (data.logs && Array.isArray(data.logs) && libreLogsConsole) {
          libreLogsConsole.textContent = data.logs.join('\n');
        }

        if (data.success) {
          libreTestFeedback.classList.remove('feedback-pending', 'feedback-error');
          libreTestFeedback.classList.add('feedback-success');
          libreTestStatusBadge.className = 'libre-badge badge-success';
          libreTestStatusBadge.textContent = 'Connected ✓';

          if (data.hasPatient) {
            libreTestStatusTitle.textContent = `Connected to "${data.patientName}"`;
            libreTestMessage.innerHTML = `Successfully authenticated! <strong>Current Glucose: ${data.latestGlucose} mg/dL</strong> (${data.historyPointsCount || 0} graph points loaded). Sensor is online.`;
            libreTestSuggestionBox.classList.add('hidden');
          } else {
            libreTestStatusTitle.textContent = 'Login Succeeded (No Patient Linked)';
            libreTestMessage.textContent = data.warning || 'Authentication succeeded, but no connected sensor was found.';
            libreTestSuggestionBox.classList.remove('hidden');
            libreTestSuggestion.textContent = data.suggestion || 'In the LibreLinkUp app, accept the sharing invite from the sensor wearer.';
          }
        } else {
          libreTestFeedback.classList.remove('feedback-pending', 'feedback-success');
          libreTestFeedback.classList.add('feedback-error');
          libreTestStatusBadge.className = 'libre-badge badge-error';
          libreTestStatusBadge.textContent = 'Login Failed ❌';
          libreTestStatusTitle.textContent = data.errorTitle || 'Authentication Error';
          libreTestMessage.textContent = data.error || 'Failed to authenticate with LibreLinkUp.';

          if (data.suggestion) {
            libreTestSuggestionBox.classList.remove('hidden');
            libreTestSuggestion.textContent = data.suggestion;
          } else {
            libreTestSuggestionBox.classList.add('hidden');
          }
        }
      } catch (netErr) {
        libreTestFeedback.classList.remove('feedback-pending', 'feedback-success');
        libreTestFeedback.classList.add('feedback-error');
        libreTestStatusBadge.className = 'libre-badge badge-error';
        libreTestStatusBadge.textContent = 'Network Error';
        libreTestStatusTitle.textContent = 'Could Not Contact Local Backend';
        libreTestMessage.textContent = netErr.message || 'Request failed';
        libreTestSuggestionBox.classList.add('hidden');
      } finally {
        btnTestLibreLogin.disabled = false;
        if (testLibreBtnText) testLibreBtnText.textContent = 'Test & Verify Libre Connection';
      }
    });
  }

  inputVolume.addEventListener('input', () => {
    audio.setVolume(inputVolume.value);
    volumeVal.textContent = `${Math.round(inputVolume.value * 100)}%`;
    try {
      localStorage.setItem('yom_kippur_volume', inputVolume.value);
    } catch (e) {}
  });

  if (checkSpeech) {
    checkSpeech.addEventListener('change', () => {
      const isEnabled = checkSpeech.checked;
      audio.setSpeech(isEnabled);
      try {
        localStorage.setItem('yom_kippur_speech_enabled', String(isEnabled));
      } catch (e) {}
      if (isEnabled) {
        audio.init();
        audio.speak('Voice alerts enabled');
      }
    });
  }

  if (inputAutoShutoff) {
    inputAutoShutoff.addEventListener('change', () => {
      audio.setAutoShutoffSeconds(inputAutoShutoff.value);
      try {
        localStorage.setItem('yom_kippur_auto_shutoff', inputAutoShutoff.value);
      } catch (e) {}
    });
  }

  btnTestModalA.addEventListener('click', () => {
    audio.init();
    audio.playChimeA();
  });
  btnTestModalB.addEventListener('click', () => {
    audio.init();
    audio.playChimeB();
  });
  btnTestModalAlarm.addEventListener('click', () => {
    audio.init();
    audio.playGlucoseAlert(true, 15);
  });
  if (btnTestModalVoice) {
    btnTestModalVoice.addEventListener('click', () => {
      audio.init();
      const prevSpeech = audio.speechEnabled;
      audio.setSpeech(true);
      audio.speak('Voice alerts are active. Yom Kippur timer is running.');
      if (!prevSpeech && checkSpeech && !checkSpeech.checked) {
        setTimeout(() => {
          if (!checkSpeech.checked) audio.setSpeech(false);
        }, 4000);
      }
    });
  }

  btnSaveSettings.addEventListener('click', async () => {
    const mins = parseInt(inputIntervalMin.value, 10) || 0;
    const secs = parseInt(inputIntervalSec.value, 10) || 0;
    const totalSeconds = Math.max(5, mins * 60 + secs);

    timer.setInterval(totalSeconds);

    // Save Fast Schedule Settings
    if (selectFastScheduleMode) {
      scheduleMode = selectFastScheduleMode.value;
      try {
        localStorage.setItem('yom_kippur_schedule_mode', scheduleMode);
      } catch (e) {}
    }

    if (scheduleMode === 'manual') {
      fastEndTime = inputFastEndTime.value || '19:45';
      fastEndDate = inputFastEndDate.value || todayStr;
      displayFastEndTime.textContent = fastEndTime;
      try {
        localStorage.setItem('yom_kippur_fast_end_time', fastEndTime);
        localStorage.setItem('yom_kippur_fast_end_date', fastEndDate);
      } catch (e) {}
    } else {
      try {
        localStorage.removeItem('yom_kippur_fast_end_date');
      } catch (e) {}
    }

    await fetchZmanimFastEnd();

    applySoundProfile(selectModalSoundProfile.value);
    audio.setVolume(inputVolume.value);
    audio.setAutoShutoffSeconds(inputAutoShutoff.value);
    audio.setSpeech(checkSpeech.checked);
    try {
      localStorage.setItem('yom_kippur_speech_enabled', String(checkSpeech.checked));
      localStorage.setItem('yom_kippur_auto_shutoff', inputAutoShutoff.value);
    } catch (e) {}

    libre.isEnabled = checkCGMEnabled.checked;
    libre.isDemo = checkDemoMode.checked;
    libre.email = inputLibreEmail.value.trim();
    libre.password = inputLibrePassword.value.trim();
    libre.region = selectLibreRegion.value;
    libre.targetLow = parseInt(inputTargetLow.value, 10) || 70;
    libre.targetHigh = parseInt(inputTargetHigh.value, 10) || 180;
    libre.saveSettings();

    // Passcode Settings
    const newPin = inputLockPasscode.value.trim();
    if (newPin && /^\d+$/.test(newPin)) {
      storedPin = newPin;
      try { localStorage.setItem('yom_kippur_lock_pin', storedPin); } catch (e) {}
    }
    autoLockEnabled = checkAutoLock.checked;
    try { localStorage.setItem('yom_kippur_auto_lock', String(autoLockEnabled)); } catch (e) {}

    // Re-initialize CGM service
    await libre.start();

    settingsModal.classList.add('hidden');
  });

  // --------------------------------------------------------------------------
  // 11. Cat-Proof Lock Shield & Passcode Logic
  // --------------------------------------------------------------------------
  let isLocked = false;
  let isPasscodeModalOpen = false;
  let enteredPin = '';
  let storedPin = '1234';
  let autoLockEnabled = false;
  let autoLockTimeout = null;
  let modalIdleSeconds = 60;
  let modalIdleInterval = null;

  try {
    const savedPin = localStorage.getItem('yom_kippur_lock_pin');
    if (savedPin) storedPin = savedPin;
    const savedAutoLock = localStorage.getItem('yom_kippur_auto_lock');
    if (savedAutoLock !== null) autoLockEnabled = savedAutoLock === 'true';
    const savedIsLocked = localStorage.getItem('yom_kippur_is_locked');
    if (savedIsLocked === 'true') {
      setAppLocked(true);
    }
  } catch (e) {}

  function setAppLocked(locked) {
    isLocked = locked;
    if (locked) {
      document.body.classList.add('app-locked');
      btnLockToggle.classList.add('active');
      lockToggleText.textContent = 'Shield Active';
      lockIcon.innerHTML = '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path>';
      lockShieldBanner.classList.remove('hidden');
      try {
        if (window.getSelection) {
          window.getSelection().removeAllRanges();
        }
      } catch (e) {}
      try {
        if (navigator.keyboard && navigator.keyboard.lock) {
          navigator.keyboard.lock(['Escape']).catch(() => {});
        }
      } catch (e) {}
      try { localStorage.setItem('yom_kippur_is_locked', 'true'); } catch (e) {}
    } else {
      document.body.classList.remove('app-locked');
      btnLockToggle.classList.remove('active');
      lockToggleText.textContent = 'Lock Shield';
      lockIcon.innerHTML = '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 9.9-1"></path>';
      lockShieldBanner.classList.add('hidden');
      try {
        if (navigator.keyboard && navigator.keyboard.unlock) {
          navigator.keyboard.unlock();
        }
      } catch (e) {}
      try { localStorage.setItem('yom_kippur_is_locked', 'false'); } catch (e) {}
    }
  }

  function updatePinDotsUI() {
    const dotCount = Math.max(4, storedPin.length);
    pinDotsContainer.innerHTML = '';
    for (let i = 0; i < dotCount; i++) {
      const dot = document.createElement('span');
      dot.className = 'pin-dot' + (i < enteredPin.length ? ' filled' : '');
      pinDotsContainer.appendChild(dot);
    }
  }

  function resetModalIdleTimer() {
    modalIdleSeconds = 60;
    if (passcodeTimeoutCountdown) passcodeTimeoutCountdown.textContent = '60s';
    if (modalIdleInterval) clearInterval(modalIdleInterval);
    modalIdleInterval = setInterval(() => {
      modalIdleSeconds--;
      if (passcodeTimeoutCountdown) passcodeTimeoutCountdown.textContent = `${modalIdleSeconds}s`;
      if (modalIdleSeconds <= 0) {
        clearInterval(modalIdleInterval);
        modalIdleInterval = null;
        closeUnlockModal();
      }
    }, 1000);
  }

  function openUnlockModal() {
    isPasscodeModalOpen = true;
    enteredPin = '';
    if (inputPasscodePin) {
      inputPasscodePin.value = '';
      setTimeout(() => inputPasscodePin.focus(), 80);
    }
    if (displayUnlockPin) displayUnlockPin.textContent = storedPin;
    passcodeErrorMsg.classList.add('hidden');
    passcodeModal.classList.remove('hidden');
    passcodeModal.style.display = 'flex';
    resetModalIdleTimer();
  }

  function closeUnlockModal() {
    isPasscodeModalOpen = false;
    enteredPin = '';
    if (inputPasscodePin) inputPasscodePin.value = '';
    if (modalIdleInterval) {
      clearInterval(modalIdleInterval);
      modalIdleInterval = null;
    }
    passcodeModal.classList.add('hidden');
    passcodeModal.style.display = 'none';
    passcodeErrorMsg.classList.add('hidden');
  }

  function appendPinDigit(digit) {
    if (enteredPin.length >= 8) return;
    enteredPin += digit;
    if (inputPasscodePin) inputPasscodePin.value = enteredPin;
    passcodeErrorMsg.classList.add('hidden');
    resetModalIdleTimer();

    if (enteredPin.length === storedPin.length) {
      setTimeout(() => {
        submitUnlockPin();
      }, 120);
    }
  }

  function removeLastPinDigit() {
    if (enteredPin.length > 0) {
      enteredPin = enteredPin.slice(0, -1);
      if (inputPasscodePin) inputPasscodePin.value = enteredPin;
      passcodeErrorMsg.classList.add('hidden');
      resetModalIdleTimer();
    }
  }

  function clearPin() {
    enteredPin = '';
    if (inputPasscodePin) inputPasscodePin.value = '';
    passcodeErrorMsg.classList.add('hidden');
    resetModalIdleTimer();
  }

  function submitUnlockPin() {
    if (inputPasscodePin && inputPasscodePin.value) {
      enteredPin = inputPasscodePin.value.replace(/\D/g, '');
    }
    if (enteredPin === storedPin) {
      closeUnlockModal();
      setAppLocked(false);
      if (autoLockTimeout) {
        clearTimeout(autoLockTimeout);
        autoLockTimeout = null;
      }
    } else {
      passcodeErrorMsg.textContent = 'Incorrect passcode. Try again.';
      passcodeErrorMsg.classList.remove('hidden');
      if (inputPasscodePin) {
        inputPasscodePin.classList.remove('pin-shake');
        void inputPasscodePin.offsetWidth; // trigger reflow
        inputPasscodePin.classList.add('pin-shake');
      }
      setTimeout(() => {
        enteredPin = '';
        if (inputPasscodePin) {
          inputPasscodePin.value = '';
          inputPasscodePin.focus();
        }
      }, 500);
    }
  }

  // Lock toggle button listeners
  btnLockToggle.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (isLocked) {
      openUnlockModal();
    } else {
      setAppLocked(true);
    }
  });

  btnBannerUnlock.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openUnlockModal();
  });

  lockShieldBanner.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openUnlockModal();
  });

  if (btnSubmitPin) {
    btnSubmitPin.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      submitUnlockPin();
    });
  }

  if (inputPasscodePin) {
    inputPasscodePin.addEventListener('input', () => {
      enteredPin = inputPasscodePin.value.replace(/\D/g, '').slice(0, 8);
      inputPasscodePin.value = enteredPin;
      passcodeErrorMsg.classList.add('hidden');
      resetModalIdleTimer();

      if (enteredPin.length === storedPin.length) {
        setTimeout(() => {
          submitUnlockPin();
        }, 120);
      }
    });

    inputPasscodePin.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submitUnlockPin();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        closeUnlockModal();
      }
    });
  }

  btnClosePasscodeModal.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    closeUnlockModal();
  });

  // Numeric Keypad Click Listeners
  pinKeys.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const num = btn.getAttribute('data-num');
      const action = btn.getAttribute('data-action');
      if (num !== null) {
        appendPinDigit(num);
      } else if (action === 'backspace') {
        removeLastPinDigit();
      } else if (action === 'clear') {
        clearPin();
      }
    });
  });

  // Start CGM Service
  libre.start();

  // --------------------------------------------------------------------------
  // Global Capture-Phase Keyboard Interception (Cat Proof!)
  // --------------------------------------------------------------------------
  window.addEventListener('keydown', (e) => {
    if (isLocked) {
      if (!isPasscodeModalOpen) {
        // Cat walking on keyboard or accidental key mash: block completely!
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        return false;
      } else {
        // Passcode modal is open: only handle PIN digits and PIN controls
        if (e.key >= '0' && e.key <= '9') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          appendPinDigit(e.key);
        } else if (e.key === 'Backspace') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          removeLastPinDigit();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          submitUnlockPin();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          closeUnlockModal();
        } else {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
        }
      }
    } else {
      // Normal unlocked shortcuts
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.code === 'Space') {
        e.preventDefault();
        btnStartPause.click();
      } else if (e.key === 's' || e.key === 'S') {
        btnSettings.click();
      } else if (e.key === 'l' || e.key === 'L') {
        btnLockToggle.click();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'q' || e.key === 'Q')) {
        e.preventDefault();
        openExitModal();
      }
    }
  }, true);

  window.addEventListener('keyup', (e) => {
    if (isLocked && !isPasscodeModalOpen) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  }, true);

  window.addEventListener('keypress', (e) => {
    if (isLocked && !isPasscodeModalOpen) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }
  }, true);

  // Scroll wheel & Touch gesture lockout while in locked shield mode
  window.addEventListener('wheel', (e) => {
    if (isLocked && !isPasscodeModalOpen) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }
  }, { passive: false, capture: true });

  window.addEventListener('touchmove', (e) => {
    if (isLocked && !isPasscodeModalOpen) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      return false;
    }
  }, { passive: false, capture: true });

  // Text selection & Context Menu suppression while locked
  window.addEventListener('selectstart', (e) => {
    if (isLocked && !isPasscodeModalOpen) {
      e.preventDefault();
      return false;
    }
  }, true);

  window.addEventListener('contextmenu', (e) => {
    if (isLocked && !isPasscodeModalOpen) {
      e.preventDefault();
      return false;
    }
  }, true);
});
