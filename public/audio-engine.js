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
    this.autoShutoffSeconds = 5;
    this.soundProfile = 'soft-cabin'; // 'zen-bowl', 'warm-marimba', 'whisper-bell', 'soft-cabin', 'water-pluck'
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
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
  }

  setSpeech(enabled) {
    this.speechEnabled = !!enabled;
  }

  setAutoShutoffSeconds(secs) {
    this.autoShutoffSeconds = Math.max(2, Math.min(30, parseInt(secs, 10) || 5));
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

    if (this.speechEnabled) {
      setTimeout(() => this.speak('Track A'), 600);
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

    if (this.speechEnabled) {
      setTimeout(() => this.speak('Track B'), 600);
    }
  }

  /**
   * Glucose Alert: Gentle pulsing warm chime (auto-stops after 3 gentle pulses)
   */
  playGlucoseAlert(isLow = true) {
    this.init();
    if (this.isMuted) return;

    const t = this.ctx.currentTime;
    const base = isLow ? 349.23 : 440.00; // F4 for low, A4 for high

    // Pulse 1
    this._playGentleSine(base, t, 1.0, 0.32, 0.06);
    this._playGentleSine(base * 1.25, t + 0.20, 1.2, 0.28, 0.06);

    // Pulse 2 (gentle repeat)
    this._playGentleSine(base, t + 1.4, 1.0, 0.32, 0.06);
    this._playGentleSine(base * 1.25, t + 1.60, 1.2, 0.28, 0.06);

    // Pulse 3
    this._playGentleSine(base, t + 2.8, 1.0, 0.32, 0.06);
    this._playGentleSine(base * 1.25, t + 3.00, 1.4, 0.30, 0.06);

    if (this.speechEnabled) {
      const msg = isLow ? 'Low glucose alert' : 'High glucose alert';
      setTimeout(() => this.speak(msg), 3200);
    }
  }

  /**
   * Urgent Low (<55 mg/dL) Alert: Distinct 3-pulse gentle warning
   * Auto-shuts off in ~4 seconds
   */
  playUrgentLowAlert() {
    this.init();
    if (this.isMuted) return;

    const t = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const p = t + i * 1.1;
      this._playGentleSine(392.00, p, 0.8, 0.38, 0.05);
      this._playGentleSine(261.63, p + 0.22, 1.0, 0.42, 0.05);
    }

    if (this.speechEnabled) {
      setTimeout(() => this.speak('Urgent low blood glucose. Life safety overrides fasting.'), 3500);
    }
  }

  /**
   * Text to speech announcement helper
   */
  speak(text) {
    if (!('speechSynthesis' in window) || !this.speechEnabled) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.90;
      utterance.pitch = 0.95;
      utterance.volume = this.masterVolume;
      window.speechSynthesis.speak(utterance);
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
