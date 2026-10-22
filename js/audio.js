/**
 * Audio Engine for SNOWMAN
 * Pure procedural sound synthesis using Web Audio API.
 * Zero external audio assets required; ensures 100% offline & local reliability.
 */

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.isMuted = false;
    this.initialized = false;

    // Master volume gain node
    this.masterGain = null;

    // Continuous sound nodes
    this.slideGain = null;
    this.slideFilter = null;
    this.slideNoiseSource = null;

    this.windGain = null;
    this.windFilter = null;
    this.windNoiseSource = null;

    // Load muted state from localStorage
    try {
      this.isMuted = localStorage.getItem('snowman_muted') === 'true';
    } catch {
      this.isMuted = false;
    }
  }

  /**
   * Initializes audio context on first user interaction to comply with browser autoplay policies.
   */
  init() {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return;
    }

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.setupContinuousSounds();
      this.initialized = true;
    } catch (e) {
      console.warn('Web Audio API initialization failed:', e);
    }
  }

  /**
   * Creates seamless looping white noise buffer
   */
  createNoiseBuffer(seconds = 3) {
    if (!this.ctx) return null;
    const bufferSize = this.ctx.sampleRate * seconds;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /**
   * Sets up looping noise generators for snow carving and mountain wind
   */
  setupContinuousSounds() {
    if (!this.ctx) return;
    const noiseBuffer = this.createNoiseBuffer(4);
    if (!noiseBuffer) return;

    // --- Snow Carving / Sliding Stream ---
    this.slideNoiseSource = this.ctx.createBufferSource();
    this.slideNoiseSource.buffer = noiseBuffer;
    this.slideNoiseSource.loop = true;

    // Bandpass filter to emulate snow crunch & scraping
    this.slideFilter = this.ctx.createBiquadFilter();
    this.slideFilter.type = 'bandpass';
    this.slideFilter.frequency.setValueAtTime(650, this.ctx.currentTime);
    this.slideFilter.Q.setValueAtTime(1.8, this.ctx.currentTime);

    this.slideGain = this.ctx.createGain();
    this.slideGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.slideNoiseSource.connect(this.slideFilter);
    this.slideFilter.connect(this.slideGain);
    this.slideGain.connect(this.masterGain);
    this.slideNoiseSource.start();

    // --- Wind Rush Stream ---
    this.windNoiseSource = this.ctx.createBufferSource();
    this.windNoiseSource.buffer = noiseBuffer;
    this.windNoiseSource.loop = true;

    // Lowpass filter for deep alpine air whoosh
    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.setValueAtTime(350, this.ctx.currentTime);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.windNoiseSource.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);
    this.windNoiseSource.start();
  }

  /**
   * Modulates continuous slide & wind sounds dynamically based on rider speed & carving intensity
   * @param {number} speed - Current rider speed in m/s
   * @param {number} carveIntensity - Absolute turning input (0 to 1)
   * @param {boolean} isGrounded - Whether board is on snow
   */
  updateDynamicSounds(speed, carveIntensity, isGrounded) {
    if (!this.initialized || !this.ctx || this.isMuted) return;

    const t = this.ctx.currentTime;
    const normSpeed = Math.min(speed / 30, 1.5); // normalized speed

    // Wind volume increases smoothly with speed
    const targetWindGain = Math.min(normSpeed * 0.35, 0.5);
    const targetWindFreq = 250 + normSpeed * 700;
    this.windGain.gain.setTargetAtTime(targetWindGain, t, 0.1);
    this.windFilter.frequency.setTargetAtTime(targetWindFreq, t, 0.1);

    // Snow carving sound only when grounded
    if (isGrounded && speed > 1) {
      const baseSlide = normSpeed * 0.22;
      const carveBoost = carveIntensity * 0.35;
      const targetSlideGain = Math.min(baseSlide + carveBoost, 0.55);

      // Carving sharpens the frequency
      const targetSlideFreq = 500 + carveIntensity * 1200 + normSpeed * 300;
      this.slideGain.gain.setTargetAtTime(targetSlideGain, t, 0.05);
      this.slideFilter.frequency.setTargetAtTime(targetSlideFreq, t, 0.05);
    } else {
      // Board in the air: silence snow scraping
      this.slideGain.gain.setTargetAtTime(0, t, 0.08);
    }
  }

  /**
   * Sound effect: Jump launch whoosh
   */
  playJump() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(380, t + 0.22);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.25);
  }

  /**
   * Sound effect: Landing on snow thud
   */
  playLanding(impactStrength = 1) {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Low frequency thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.18);

    const vol = Math.min(0.18 + impactStrength * 0.15, 0.45);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.2);

    // White noise crunch puff
    const noiseBuffer = this.createNoiseBuffer(0.15);
    if (noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.setValueAtTime(500, t);
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.3, t);
      ng.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

      src.connect(f);
      f.connect(ng);
      ng.connect(this.masterGain);
      src.start(t);
      src.stop(t + 0.15);
    }
  }

  /**
   * Sound effect: Crash / Wipeout impact
   */
  playCrash() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Heavy deep boom
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(25, t + 0.6);

    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.6);

    // Hard crunch noise
    const noiseBuffer = this.createNoiseBuffer(0.4);
    if (noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(800, t);
      f.Q.setValueAtTime(2, t);
      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.5, t);
      ng.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

      src.connect(f);
      f.connect(ng);
      ng.connect(this.masterGain);
      src.start(t);
      src.stop(t + 0.4);
    }
  }

  /**
   * Sound effect: Golden coin collection sparkle chime
   */
  playCoinCollect() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Harmonious two-tone chime (B5 -> E6)
    const tones = [987.77, 1318.51];
    tones.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.055);

      gain.gain.setValueAtTime(0.24, t + idx * 0.055);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.055 + 0.28);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t + idx * 0.055);
      osc.stop(t + idx * 0.055 + 0.28);
    });
  }

  /**
   * Sound effect: Glancing obstacle stumble / recovery scrape
   */
  playStumble() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.15);

    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.15);
  }

  /**
   * Sound effect: Supersonic Nitro Boost activation rocket whoosh
   */
  playNitroBoost() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Rising turbine / rocket roar
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(580, t + 0.4);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.45);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.45);

    // Filtered rushing hiss burst
    const noiseBuffer = this.createNoiseBuffer(0.5);
    if (noiseBuffer) {
      const src = this.ctx.createBufferSource();
      src.buffer = noiseBuffer;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(400, t);
      f.frequency.exponentialRampToValueAtTime(2400, t + 0.45);
      f.Q.setValueAtTime(3.0, t);

      const ng = this.ctx.createGain();
      ng.gain.setValueAtTime(0.45, t);
      ng.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

      src.connect(f);
      f.connect(ng);
      ng.connect(this.masterGain);
      src.start(t);
      src.stop(t + 0.5);
    }
  }

  /**
   * Sound effect: Triumphant Checkpoint Reached chime
   */
  playCheckpoint() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    // Ascending majestic arpeggio (C5, G5, C6, E6)
    const chords = [523.25, 783.99, 1046.50, 1318.51];
    chords.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.08);

      gain.gain.setValueAtTime(0.26, t + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.55);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t + idx * 0.08);
      osc.stop(t + idx * 0.08 + 0.55);
    });
  }

  /**
   * Sound effect: Slalom gate clear bonus chime
   */
  playGateBonus() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.05);

      gain.gain.setValueAtTime(0.16, t + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.05 + 0.25);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t + idx * 0.05);
      osc.stop(t + idx * 0.05 + 0.25);
    });
  }

  /**
   * Sound effect: Air-time landing reward chime
   */
  playAirReward() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, t);
    osc.frequency.exponentialRampToValueAtTime(880, t + 0.15);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.28);
  }

  /**
   * Sound effect: UI button click
   */
  playClick() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.06);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(t);
    osc.stop(t + 0.06);
  }

  /**
   * Sound effect: Game start alpine fanfare
   */
  playStartFanfare() {
    if (!this.initialized || !this.ctx || this.isMuted) return;
    const t = this.ctx.currentTime;

    const chords = [392.00, 523.25, 659.25, 783.99]; // G4, C5, E5, G5
    chords.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t + idx * 0.07);

      gain.gain.setValueAtTime(0.18, t + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.07 + 0.45);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(t + idx * 0.07);
      osc.stop(t + idx * 0.07 + 0.45);
    });
  }

  /**
   * Toggles audio mute state
   */
  toggleMute() {
    this.isMuted = !this.isMuted;
    try {
      localStorage.setItem('snowman_muted', this.isMuted ? 'true' : 'false');
    } catch {
      // storage unavailable
    }

    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 1, this.ctx.currentTime);
    }
    return this.isMuted;
  }

  /**
   * Immediately silences looping background audio (on pause or crash)
   */
  silenceLoops() {
    if (!this.ctx || !this.initialized) return;
    const t = this.ctx.currentTime;
    if (this.slideGain) this.slideGain.gain.setTargetAtTime(0, t, 0.05);
    if (this.windGain) this.windGain.gain.setTargetAtTime(0, t, 0.05);
  }
}
