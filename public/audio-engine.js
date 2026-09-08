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
    this.voiceManager = null;
    this._initSpeech();
  }

  _initSpeech() {
    if (typeof window === 'undefined') return;

    const setupVoiceManager = () => {
      try {
        const availableLangs = (window.i18n && typeof window.i18n.getAvailableLanguages === 'function')
          ? window.i18n.getAvailableLanguages()
          : ['en', 'he'];

        if (window.ReadiumSpeech && window.ReadiumSpeech.WebSpeechVoiceManager) {
          window.ReadiumSpeech.WebSpeechVoiceManager.initialize({ languages: availableLangs })
            .then(manager => {
              this.voiceManager = manager;
              this.voices = manager.voices || (window.speechSynthesis ? window.speechSynthesis.getVoices() : []);
            })
            .catch(() => {
              if ('speechSynthesis' in window) {
                this.voices = window.speechSynthesis.getVoices() || [];
              }
            });
        } else if ('speechSynthesis' in window) {
          this.voices = window.speechSynthesis.getVoices() || [];
        }
      } catch (e) {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          this.voices = window.speechSynthesis.getVoices() || [];
        }
      }
    };

    setupVoiceManager();

    if ('speechSynthesis' in window && typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
      window.speechSynthesis.onvoiceschanged = () => {
        setupVoiceManager();
      };
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
          this._initSpeech();
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
    if (this._currentAlertAudio) {
      try {
        this._currentAlertAudio.pause();
        this._currentAlertAudio.currentTime = 0;
      } catch (e) {}
      this._currentAlertAudio = null;
    }
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

    const repeatCount = Math.max(1, parseInt(repeats, 10) || 15);

    if (this.ctx) {
      const t = this.ctx.currentTime;
      const base = isLow ? 349.23 : 440.00; // F4 for low, A4 for high

      // Schedule 15 gentle harmonic pulses spaced by ~1.35s
      for (let i = 0; i < repeatCount; i++) {
        const startTime = t + i * 1.35;
        this._playGentleSine(base, startTime, 1.0, 0.32, 0.06);
        this._playGentleSine(base * 1.25, startTime + 0.20, 1.2, 0.28, 0.06);
      }
    }

    if (this.speechEnabled) {
      const key = isLow ? 'alerts.speech.lowGlucose' : 'alerts.speech.highGlucose';
      const alertKey = isLow ? 'low-glucose' : 'high-glucose';
      const defaultText = isLow ? 'Low blood glucose alert.' : 'High blood glucose alert.';
      const msg = (typeof window !== 'undefined' && window.i18n && typeof window.i18n.t === 'function')
        ? window.i18n.t(key, { defaultValue: defaultText })
        : defaultText;

      // Announce clearly near start
      setTimeout(() => this.speak(msg, null, alertKey), 700);
      // If 15 pulses, repeat voice announcement midway (~9.5s) for safety
      if (repeatCount >= 10) {
        setTimeout(() => {
          if (this.speechEnabled && !this.isMuted) {
            this.speak(msg, null, alertKey);
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

    const repeatCount = Math.max(1, parseInt(repeats, 10) || 15);

    if (this.ctx) {
      const t = this.ctx.currentTime;
      for (let i = 0; i < repeatCount; i++) {
        const p = t + i * 1.1;
        this._playGentleSine(392.00, p, 0.8, 0.38, 0.05);
        this._playGentleSine(261.63, p + 0.22, 1.0, 0.42, 0.05);
      }
    }

    if (this.speechEnabled) {
      const alertKey = 'urgent-low-glucose';
      const defaultText = 'Urgent low blood glucose. Life safety overrides fasting.';
      const msg = (typeof window !== 'undefined' && window.i18n && typeof window.i18n.t === 'function')
        ? window.i18n.t('alerts.speech.urgentLowGlucose', { defaultValue: defaultText })
        : defaultText;

      setTimeout(() => this.speak(msg, null, alertKey), 600);
      if (repeatCount >= 10) {
        setTimeout(() => {
          if (this.speechEnabled && !this.isMuted) {
            this.speak(msg, null, alertKey);
          }
        }, 8500);
      }
    }
  }

  /**
   * Helper to resolve base language code, target BCP-47 region, and supported regions list
   * derived directly from the language file's _meta configuration (e.g. en.json, he.json).
   * e.g., 'en' -> { baseLang: 'en', targetRegion: 'en-US', regions: ['en-US', 'en-GB', 'en-CA', ...] }
   *       'en-GB' -> { baseLang: 'en', targetRegion: 'en-GB', regions: ['en-GB', 'en-US', ...] }
   */
  _resolveLanguageRegion(activeLang) {
    const raw = (activeLang || (typeof window !== 'undefined' && window.i18n ? window.i18n.getCurrentLanguage() : 'en') || 'en').trim();
    const parts = raw.split(/[-_]/);
    const baseLang = parts[0].toLowerCase();

    let meta = null;
    if (typeof window !== 'undefined' && window.i18n && typeof window.i18n.getLanguageMeta === 'function') {
      meta = window.i18n.getLanguageMeta(baseLang) || window.i18n.getLanguageMeta(raw);
    } else if (typeof require !== 'undefined') {
      try {
        const fs = require('fs');
        const path = require('path');
        const localePath = path.join(__dirname, 'locales', `${baseLang}.json`);
        if (fs.existsSync(localePath)) {
          meta = JSON.parse(fs.readFileSync(localePath, 'utf8'))._meta;
        }
      } catch (e) {}
    }

    const defaultRegion = meta?.defaultRegion || `${baseLang}-${baseLang.toUpperCase()}`;
    const regions = (Array.isArray(meta?.regions) && meta.regions.length > 0)
      ? meta.regions
      : [defaultRegion];

    let targetRegion = defaultRegion;
    if (parts.length > 1 && parts[1]) {
      targetRegion = `${baseLang}-${parts[1].toUpperCase()}`;
    }

    const neuralVoice = meta?.neuralVoice || null;

    return { baseLang, targetRegion, regions, defaultRegion, neuralVoice };
  }

  /**
   * Resolve the highest-quality speech voice for the requested language.
   * Utilizes @readium/speech WebSpeechVoiceManager with region prioritization from locale _meta.
   */
  async _resolveBestVoice(activeLang) {
    const { baseLang, targetRegion, regions } = this._resolveLanguageRegion(activeLang);

    // 1. Try Readium Voice Manager (querying candidate regions in order of preference)
    if (this.voiceManager && typeof this.voiceManager.getDefaultVoice === 'function') {
      try {
        const candidateRegions = [targetRegion, ...regions.filter(r => r !== targetRegion), baseLang];
        for (const reg of candidateRegions) {
          const bestVoiceObj = await this.voiceManager.getDefaultVoice(reg);
          if (bestVoiceObj) {
            const nativeVoice = this.voiceManager.convertToSpeechSynthesisVoice(bestVoiceObj);
            if (nativeVoice) return nativeVoice;
          }
        }
      } catch (e) {}
    }

    // 2. Fallback Intelligent Voice Classifier & Sorter
    const rawVoices = (typeof window !== 'undefined' && window.speechSynthesis)
      ? (window.speechSynthesis.getVoices() || [])
      : (this.voices || []);

    if (!rawVoices || rawVoices.length === 0) return null;

    // Filter voices matching base language or any configured region in _meta.regions
    const langVoices = rawVoices.filter(v => {
      const vLang = (v.lang || '').toLowerCase();
      return vLang.startsWith(baseLang) || regions.some(r => {
        const lowerR = r.toLowerCase();
        return vLang.startsWith(lowerR) || lowerR.startsWith(vLang);
      });
    });

    const candidatePool = langVoices.length > 0 ? langVoices : rawVoices;

    // Novelty / low-quality voice names to deprioritize/exclude
    const noveltyRegex = /albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|organ|princess|trinoids|whisper|zarvox|fred|junior|kathy|ralph|eddy|flo|grandma|grandpa|jacques|reed|rocko|sandy|shelley|espeak/i;

    // Score voice quality
    const scoreVoice = (v) => {
      const name = (v.name || '').toLowerCase();
      const uri = (v.voiceURI || '').toLowerCase();
      const vLang = (v.lang || '').toLowerCase();

      // Novelty / robotic legacy penalty
      if (noveltyRegex.test(name) || noveltyRegex.test(uri)) return 10;

      // Compact / low quality penalty
      if (name.includes('compact') || uri.includes('compact')) return 30;

      let score = 50;

      // Exact target region match bonus
      if (vLang === targetRegion.toLowerCase()) {
        score += 25;
      } else {
        // Match against any configured regional dialect in _meta.regions
        const regionIndex = regions.findIndex(r => r.toLowerCase() === vLang || vLang.startsWith(r.toLowerCase()));
        if (regionIndex >= 0) {
          score += Math.max(5, 20 - regionIndex * 2);
        }
      }

      // Apple Enhanced / Premium / Siri
      if (name.includes('enhanced') || uri.includes('enhanced')) score += 50;
      if (name.includes('premium') || uri.includes('premium')) score += 60;
      if (name.includes('siri') || uri.includes('siri')) score += 55;

      // Google Natural / Neural
      if (name.includes('natural') || uri.includes('natural')) score += 55;
      if (name.includes('neural') || uri.includes('neural')) score += 60;
      if (name.includes('google')) score += 40;

      // Microsoft Natural Online
      if (name.includes('online (natural)')) score += 65;

      // Standard desktop voices
      if (/samantha|ava|daniel|karen|carmit|zira|david|mark|asaf|hila|avri|elvira|jorge|alvaro|helena|paulina|thomas|marie|amelie|anna|stefan/i.test(name)) score += 20;

      return score;
    };

    const sorted = [...candidatePool].sort((a, b) => scoreVoice(b) - scoreVoice(a));
    return sorted[0] || candidatePool[0] || null;
  }

  /**
   * Text to speech announcement helper with 3-tier cascade:
   * 1. High-fidelity Neural Edge TTS via /api/tts (with local disk cache)
   * 2. Pre-bundled offline static studio MP3 fallback (/audio/alerts/${alertKey}-${baseLang}.mp3)
   * 3. Local OS WebSpeech Synthesis fallback via @readium/speech
   */
  async speak(text, lang = null, alertKey = null) {
    if (typeof window === 'undefined' || !this.speechEnabled || !text || this.isMuted) return;

    const activeLang = lang || (typeof window !== 'undefined' && window.i18n ? window.i18n.getCurrentLanguage() : 'en');
    const { baseLang, targetRegion } = this._resolveLanguageRegion(activeLang);

    // Helper: Play audio buffer / stream via HTML5 Audio element
    const playAudioUrl = (url) => {
      return new Promise((resolve, reject) => {
        try {
          const audio = new Audio(url);
          this._currentAlertAudio = audio;
          audio.volume = Math.max(0.1, this.masterVolume);
          audio.onended = () => {
            if (this._currentAlertAudio === audio) this._currentAlertAudio = null;
            resolve(true);
          };
          audio.onerror = (e) => {
            if (this._currentAlertAudio === audio) this._currentAlertAudio = null;
            reject(e);
          };
          audio.play().then(() => {}).catch(err => {
            if (this._currentAlertAudio === audio) this._currentAlertAudio = null;
            reject(err);
          });
        } catch (e) {
          reject(e);
        }
      });
    };

    // Helper: Play audio blob
    const playAudioBlob = async (blob) => {
      const blobUrl = URL.createObjectURL(blob);
      try {
        await playAudioUrl(blobUrl);
      } finally {
        setTimeout(() => {
          try { URL.revokeObjectURL(blobUrl); } catch (e) {}
        }, 10000);
      }
    };

    // --- Tier 1: Try Online / Cached Neural TTS (/api/tts) ---
    try {
      if (typeof fetch === 'function') {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), 2000) : null;
        const endpoint = `/api/tts?text=${encodeURIComponent(text)}&lang=${encodeURIComponent(targetRegion)}`;

        const res = await fetch(endpoint, {
          signal: controller?.signal,
          headers: { 'Accept': 'audio/mpeg' }
        });
        if (timeoutId) clearTimeout(timeoutId);

        if (res.ok && res.status === 200) {
          const blob = await res.blob();
          if (blob && blob.size > 1000) {
            await playAudioBlob(blob);
            return;
          }
        }
      }
    } catch (e) {
      // Network failed, offline, or timed out -> proceed to Tier 2
    }

    // --- Tier 2: Try Pre-bundled Static Studio Audio Fallback ---
    if (alertKey) {
      try {
        const staticFile = `/audio/alerts/${alertKey}-${baseLang}.mp3`;
        await playAudioUrl(staticFile);
        return;
      } catch (e) {
        // Pre-bundled file not available for this alertKey/language -> proceed to Tier 3
      }
    }

    // --- Tier 3: Local OS WebSpeech Synthesis Fallback via @readium/speech ---
    if ('speechSynthesis' in window) {
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0; // Natural pacing
        utterance.pitch = 1.0;
        utterance.volume = Math.max(0.1, this.masterVolume);
        utterance.lang = targetRegion;

        // Pick best matching voice
        const bestVoice = await this._resolveBestVoice(activeLang);
        if (bestVoice) {
          utterance.voice = bestVoice;
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
}

// Global instance & CommonJS export
if (typeof window !== 'undefined') {
  window.audioEngine = new AudioEngine();
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AudioEngine;
}
