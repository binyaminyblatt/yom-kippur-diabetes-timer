/**
 * TimerEngine - Monotonic Dual-Track Eating Interval Scheduler
 * Provides precision drift-free timing for Yom Kippur Achila l'Shiurim.
 */
class TimerEngine {
  constructor(options = {}) {
    this.intervalSeconds = options.intervalSeconds || 540; // Default: 9 minutes
    this.isRunning = false;
    this.startTime = 0;
    this.elapsedOffset = 0;
    this.lastTriggeredChime = null;
    this.lastCycleIndex = -1;
    this.lastHalfCycleIndex = -1;
    this.intervalTimerId = null;

    // Callbacks
    this.onTick = options.onTick || (() => {});
    this.onChime = options.onChime || (() => {});

    // Active follow mode ('any', 'A', 'B')
    this.followedTrack = 'any';
  }

  get halfIntervalSeconds() {
    return this.intervalSeconds / 2;
  }

  setInterval(seconds) {
    const s = Math.max(2, parseFloat(seconds) || 540);
    this.intervalSeconds = s;
    this.reset();
  }

  setFollowedTrack(track) {
    this.followedTrack = track; // 'any', 'A', or 'B'
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.startTime = performance.now();
    this.lastCycleIndex = Math.floor(this.elapsedOffset / this.intervalSeconds);
    this.lastHalfCycleIndex = Math.floor(this.elapsedOffset / this.halfIntervalSeconds);

    this.intervalTimerId = setInterval(() => this._tick(), 100);
    this._tick();
  }

  pause() {
    if (!this.isRunning) return;
    this.isRunning = false;
    if (this.intervalTimerId) {
      clearInterval(this.intervalTimerId);
      this.intervalTimerId = null;
    }
    this.elapsedOffset += (performance.now() - this.startTime) / 1000;
    this._tick();
  }

  reset() {
    this.pause();
    this.elapsedOffset = 0;
    this.lastTriggeredChime = null;
    this.lastCycleIndex = -1;
    this.lastHalfCycleIndex = -1;
    this._tick();
  }

  /**
   * Immediately sync start to right now with Track A or Track B
   */
  syncNow(track = 'A') {
    const wasRunning = this.isRunning;
    this.pause();
    if (track === 'A') {
      this.elapsedOffset = 0;
      this.onChime('A');
    } else {
      this.elapsedOffset = this.halfIntervalSeconds;
      this.onChime('B');
    }
    if (wasRunning) {
      this.start();
    } else {
      this._tick();
    }
  }

  /**
   * Fast forward for testing / dry run
   */
  fastForward(seconds = 30) {
    if (this.isRunning) {
      this.startTime -= seconds * 1000;
    } else {
      this.elapsedOffset += seconds;
    }
    this._tick();
  }

  _tick() {
    let currentElapsed = this.elapsedOffset;
    if (this.isRunning) {
      currentElapsed += (performance.now() - this.startTime) / 1000;
    }

    const T = this.intervalSeconds;
    const halfT = this.halfIntervalSeconds;

    // Check chime triggers if running
    if (this.isRunning) {
      const halfIndex = Math.floor(currentElapsed / halfT);
      if (halfIndex > this.lastHalfCycleIndex && this.lastHalfCycleIndex !== -1) {
        // Did we cross an even half-index (Track A = 0, 2, 4...) or odd half-index (Track B = 1, 3, 5...)?
        if (halfIndex % 2 === 0) {
          this.onChime('A');
        } else {
          this.onChime('B');
        }
      }
      this.lastHalfCycleIndex = halfIndex;
      this.lastCycleIndex = Math.floor(currentElapsed / T);
    }

    // Position inside current full cycle [0, T)
    const cyclePosition = currentElapsed % T;

    // Time remaining until Track A (at 0 and T)
    const remainingA = (T - cyclePosition) % T;
    const progressA = 1 - (remainingA / T);

    // Time remaining until Track B (at T/2)
    let remainingB;
    if (cyclePosition < halfT) {
      remainingB = halfT - cyclePosition;
    } else {
      remainingB = (T + halfT) - cyclePosition;
    }
    const progressB = 1 - (remainingB / T);

    // Next upcoming chime (whichever is earlier)
    let nextChimeType;
    let nextRemaining;
    let nextProgress;

    if (remainingA <= remainingB) {
      nextChimeType = 'A';
      nextRemaining = remainingA;
      nextProgress = 1 - (nextRemaining / halfT);
    } else {
      nextChimeType = 'B';
      nextRemaining = remainingB;
      nextProgress = 1 - (nextRemaining / halfT);
    }

    // Prepare state payload for UI
    const state = {
      isRunning: this.isRunning,
      intervalSeconds: T,
      halfIntervalSeconds: halfT,
      totalElapsed: currentElapsed,
      cycleCount: Math.floor(currentElapsed / T),
      halfCycleCount: Math.floor(currentElapsed / halfT),
      followedTrack: this.followedTrack,
      trackA: {
        remaining: remainingA,
        progress: progressA,
        isNext: nextChimeType === 'A'
      },
      trackB: {
        remaining: remainingB,
        progress: progressB,
        isNext: nextChimeType === 'B'
      },
      nextChime: {
        type: nextChimeType,
        remaining: nextRemaining,
        progress: Math.max(0, Math.min(1, nextProgress))
      }
    };

    this.onTick(state);
  }

  // Format seconds to mm:ss or hh:mm:ss
  static formatTime(seconds, showDecimals = false) {
    const s = Math.max(0, seconds);
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    const pad = (n) => String(n).padStart(2, '0');

    if (showDecimals && s < 60) {
      const dec = Math.floor((s % 1) * 10);
      return `${pad(mins)}:${pad(secs)}.${dec}`;
    }
    return `${pad(mins)}:${pad(secs)}`;
  }
}

// Global instance & CommonJS export
if (typeof window !== 'undefined') {
  window.TimerEngine = TimerEngine;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TimerEngine;
}
