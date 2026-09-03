/**
 * AudioEngine - Ultra-Gentle Ambient Sound Synthesizer
 * Designed for peaceful 25-hour background operation (sleep-friendly, non-intrusive).
 */
class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterVolume = 0.50; // Comfortable gentle default
    this.isMuted = false;
    this.speechEnabled = false;
    this.autoShutoffSeconds = 20; // Default 20s allows full 15-pulse sequence
    this.soundProfile = 'soft-cabin'; // 'zen-bowl', 'warm-marimba', 'whisper-bell', 'soft-cabin', 'water-pluck'
    this._activeOscillators = [];
    this._activeUtterances = [];
    this.voices = [];
    this._initSpeech();
  }

  _initSpeech() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        try {
          this.voices = window.speechSynthesis.getVoices() || [];
        } catch (e) {
          this.voices = [];
        }
      };
      loadVoices();
      if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
    }
  }

  init() {
    if (typeof window === 'undefined') return;
    try {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
    } catch (e) {}

    // Wake up Web Speech engine on user gesture
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        if (!this.voices || this.voices.length === 0) {
          this.voices = window.speechSynthesis.getVoices() || [];
        }
      } catch (e) {}
    }
  }

  setVolume(val) {
    this.masterVolume = Math.max(0, Math.min(1, parseFloat(val)));
  }

  setSoundProfile(profile) {
    this.soundProfile = profile || 'soft-cabin';
  }

  setMuted(muted) {
    this.isMuted = !!muted;
    if (this.isMuted) {
      this.stopAlarms();
    }
  }

  setSpeech(enabled) {
    this.speechEnabled = !!enabled;
    // Note: Do not force synchronous init() on startup to respect browser autoplay policies
  }

  setAutoShutoffSeconds(secs) {
    this.autoShutoffSeconds = Math.max(2, Math.min(60, parseInt(secs, 10) || 20));
  }

  /**
   * Stop any ongoing glucose alarm sound pulses and speech immediately.
   */
  stopAlarms() {
    if (this._activeOscillators && this._activeOscillators.length > 0) {
      this._activeOscillators.forEach(osc => {
        try {
          osc.stop();
          osc.disconnect();
        } catch (e) {}
      });
      this._activeOscillators = [];
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
      this._activeUtterances = [];
    }
  }

  /**
   * Ultra-gentle pure sine tone with soft attack and smooth warm decay.
   * Zero harsh high-frequency transients.
   */
  _playGentleSine(freq, startTime, duration = 2.0, peakGain = 0.28, attackTime = 0.08) {
    if (this.isMuted || !this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    // Low-pass filter to remove any sharpness
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 3.5, startTime);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);

    const vol = peakGain * this.masterVolume;

    // Smooth, rounded envelope (no clicks/pops)
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(vol, startTime + attackTime);
    gain.gain.exponentialRampToValueAtTime(vol * 0.45, startTime + attackTime + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    // Track active oscillator for cancel/snooze safety
    this._activeOscillators.push(osc);
    osc.onended = () => {
      this._activeOscillators = this._activeOscillators.filter(o => o !== osc);
    };

    osc.start(startTime);
    osc.stop(startTime + duration + 0.1);
  }

  /**
   * Zen Tibetan Singing Bowl / Meditation Bell
   * Deep, warm, soothing harmonic resonance (sleep friendly).
   */
  _playZenBowl(baseFreq, startTime, duration = 2.8) {
    if (this.isMuted || !this.ctx) return;

    // Fundamental (Deep warm sine)
    this._playGentleSine(baseFreq, startTime, duration, 0.35, 0.12);
    // Subtle warm 2nd harmonic
    this._playGentleSine(baseFreq * 1.5, startTime + 0.02, duration * 0.8, 0.10, 0.15);
    // Soft subtle shimmer
    this._playGentleSine(baseFreq * 2.76, startTime + 0.04, duration * 0.6, 0.03, 0.18);
  }

  /**
   * Warm Wooden Marimba / Kalimba
   * Organic, soft felt-mallet wooden chime.
   */
  _playWarmMarimba(baseFreq, startTime, duration = 1.4) {
    if (this.isMuted || !this.ctx) return;

    this._playGentleSine(baseFreq, startTime, duration, 0.35, 0.04);
    this._playGentleSine(baseFreq * 2.0, startTime, duration * 0.7, 0.08, 0.04);
    this._playGentleSine(baseFreq * 4.0, startTime, duration * 0.4, 0.02, 0.04);
  }

  /**
   * Whisper Ambient Wind Bell
   * Distant, airy, tranquil tone.
   */
  _playWhisperBell(baseFreq, startTime, duration = 2.2) {
    if (this.isMuted || !this.ctx) return;

    this._playGentleSine(baseFreq, startTime, duration, 0.22, 0.10);
    this._playGentleSine(baseFreq * 2.0, startTime + 0.03, duration * 0.7, 0.06, 0.12);
  }

  /**
   * Soft Lower-Octave Cabin Chime
   * Subdued, warm passenger chime (no piercing high frequencies).
   */
  _playSoftCabin(isHighToLow, startTime) {
    if (this.isMuted || !this.ctx) return;

    const f1 = isHighToLow ? 523.25 : 392.00; // C5 or G4
    const f2 = isHighToLow ? 392.00 : 523.25; // G4 or C5

    this._playGentleSine(f1, startTime, 1.8, 0.28, 0.06);
    this._playGentleSine(f2, startTime + 0.38, 2.2, 0.32, 0.06);
  }

  /**
   * Track A Chime (First Cadence)
   */
  playChimeA() {
    this.init();
    if (this.isMuted) return;

    const t = this.ctx.currentTime;

    switch (this.soundProfile) {
      case 'zen-bowl':
        // Warm C4 (261.63 Hz) peaceful meditation bowl
        this._playZenBowl(261.63, t, 3.0);
        break;
      case 'warm-marimba':
        // Warm E4 (329.63 Hz) followed by B4
        this._playWarmMarimba(329.63, t, 1.5);
        this._playWarmMarimba(493.88, t + 0.22, 1.6);
        break;
      case 'whisper-bell':
        // Soft airy F4 (349.23 Hz)
        this._playWhisperBell(349.23, t, 2.5);
        break;
      case 'water-pluck':
        // Organic gentle water tone (G4 = 392 Hz)
        this._playGentleSine(392.00, t, 1.2, 0.30, 0.03);
        this._playGentleSine(523.25, t + 0.18, 1.4, 0.25, 0.03);
        break;
      case 'soft-cabin':
      default:
        this._playSoftCabin(true, t);
        break;
    }
  }

  /**
   * Track B Chime (Second Cadence - Staggered by T/2)
   */
  playChimeB() {
    this.init();
    if (this.isMuted) return;

    const t = this.ctx.currentTime;

    switch (this.soundProfile) {
      case 'zen-bowl':
        // Warm G3 (196.00 Hz) or A3 (220 Hz) deep serene singing bowl
        this._playZenBowl(220.00, t, 3.2);
        break;
      case 'warm-marimba':
        // Warm G3 (196 Hz) followed by D4 (293.66 Hz)
        this._playWarmMarimba(196.00, t, 1.5);
        this._playWarmMarimba(293.66, t + 0.22, 1.6);
        break;
      case 'whisper-bell':
        // Soft airy C4 (261.63 Hz)
        this._playWhisperBell(261.63, t, 2.5);
        break;
      case 'water-pluck':
        // Organic gentle water tone (D4 = 293.66 Hz)
        this._playGentleSine(293.66, t, 1.2, 0.30, 0.03);
        this._playGentleSine(440.00, t + 0.18, 1.4, 0.25, 0.03);
        break;
      case 'soft-cabin':
      default:
        this._playSoftCabin(false, t);
        break;
    }
  }

  /**
   * Glucose Alert: Gentle pulsing warm chime repeating 15 times (~20-second duration)
   * Voice announcements ONLY speak here for glucose safety alerts.
   */
  playGlucoseAlert(isLow = true, repeats = 15) {
    this.init();
    if (this.isMuted) return;

    const t = this.ctx.currentTime;
    const base = isLow ? 349.23 : 440.00; // F4 for low, A4 for high
    const repeatCount = Math.max(1, parseInt(repeats, 10) || 15);

    // Schedule 15 gentle harmonic pulses spaced by ~1.35s
    for (let i = 0; i < repeatCount; i++) {
      const startTime = t + i * 1.35;
      this._playGentleSine(base, startTime, 1.0, 0.32, 0.06);
      this._playGentleSine(base * 1.25, startTime + 0.20, 1.2, 0.28, 0.06);
    }

    if (this.speechEnabled) {
      const isHe = typeof window !== 'undefined' && window.i18n && window.i18n.getCurrentLanguage() === 'he';
      const msg = isHe 
        ? (isLow ? 'התראת סוכר נמוך' : 'התראת סוכר גבוה') 
        : (isLow ? 'Low glucose alert' : 'High glucose alert');
      // Announce clearly near start
      setTimeout(() => this.speak(msg), 700);
      // If 15 pulses, repeat voice announcement midway (~9.5s) for safety
      if (repeatCount >= 10) {
        setTimeout(() => {
          if (this.speechEnabled && !this.isMuted) {
            this.speak(msg);
          }
        }, 9500);
      }
    }
  }

  /**
   * Urgent Low (<55 mg/dL) Alert: Distinct 15-pulse gentle warning (~16.5-second duration)
   */
  playUrgentLowAlert(repeats = 15) {
    this.init();
    if (this.isMuted) return;

    const t = this.ctx.currentTime;
    const repeatCount = Math.max(1, parseInt(repeats, 10) || 15);

    for (let i = 0; i < repeatCount; i++) {
      const p = t + i * 1.1;
      this._playGentleSine(392.00, p, 0.8, 0.38, 0.05);
      this._playGentleSine(261.63, p + 0.22, 1.0, 0.42, 0.05);
    }

    if (this.speechEnabled) {
      const isHe = typeof window !== 'undefined' && window.i18n && window.i18n.getCurrentLanguage() === 'he';
      const msg = isHe
        ? 'התראת סוכר נמוך קריטי. פיקוח נפש דוחה תענית.'
        : 'Urgent low blood glucose. Life safety overrides fasting.';
      setTimeout(() => this.speak(msg), 600);
      if (repeatCount >= 10) {
        setTimeout(() => {
          if (this.speechEnabled && !this.isMuted) {
            this.speak(msg);
          }
        }, 8500);
      }
    }
  }

  /**
   * Text to speech announcement helper with robust browser compatibility
   */
  speak(text, lang = null) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !this.speechEnabled || !text) return;
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      const activeLang = lang || (typeof window !== 'undefined' && window.i18n ? window.i18n.getCurrentLanguage() : 'en');
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.92;
      utterance.pitch = 1.0;
      utterance.volume = Math.max(0.1, this.masterVolume);
      utterance.lang = activeLang === 'he' ? 'he-IL' : 'en-US';

      // Pick matching voice if available
      if (this.voices && this.voices.length > 0) {
        if (activeLang === 'he') {
          const heVoice = this.voices.find(v => v.lang.startsWith('he') || v.lang.startsWith('iw'));
          if (heVoice) {
            utterance.voice = heVoice;
          }
        } else {
          const enVoice = this.voices.find(v => (v.lang === 'en-US' || v.lang.startsWith('en')) && !v.name.toLowerCase().includes('whisper')) || this.voices[0];
          if (enVoice) {
            utterance.voice = enVoice;
          }
        }
      }

      // Retain utterance reference to protect from Chromium garbage collection bug
      this._activeUtterances.push(utterance);
      utterance.onend = () => {
        this._activeUtterances = this._activeUtterances.filter(u => u !== utterance);
      };
      utterance.onerror = (e) => {
        this._activeUtterances = this._activeUtterances.filter(u => u !== utterance);
        if (e.error !== 'interrupted' && e.error !== 'canceled') {
          console.warn('Speech synthesis utterance notice:', e);
        }
      };

      window.speechSynthesis.speak(utterance);

      // Keep synthesis from sleeping in Chrome
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  }
}

// Global instance & CommonJS export
if (typeof window !== 'undefined') {
  window.audioEngine = new AudioEngine();
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioEngine;
}
