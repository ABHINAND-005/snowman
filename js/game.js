/**
 * SNOWMAN — Alpine Freeride 3D
 * Main Game Controller & Render Engine
 *
 * Phase 6 additions:
 *  - COUNTDOWN game state (3-2-1-GO! overlay before every run)
 *  - Shift key mapped to tuck boost (same as W/↑)
 *  - Mobile touch controls (mirrors keyboard keys exactly)
 *  - Graphics quality applied to renderer based on saved setting
 *  - Settings button wiring (menu + pause screens)
 *  - Main-menu-from-pause button wiring
 *  - Checkpoint status badge in HUD
 */

import * as THREE from 'three';
import { SoundEngine }  from './audio.js';
import { Environment }  from './environment.js';
import { Terrain }      from './terrain.js';
import { Player }       from './player.js';
import { UIManager }    from './ui.js';

// ── Game State Enum ───────────────────────────────────────────────────────────
const GameState = {
  MENU:      'MENU',
  COUNTDOWN: 'COUNTDOWN',   // Phase 6: 3-2-1-GO! before a run starts
  PLAYING:   'PLAYING',
  PAUSED:    'PAUSED',
  GAMEOVER:  'GAMEOVER'
};

// ── Game Class ────────────────────────────────────────────────────────────────
class Game {
  constructor() {
    this.state = GameState.MENU;

    // Phase 6: Countdown timer
    this.countdownTimer = 0;
    this.countdownValue = 3;  // currently displayed number (3, 2, 1, 0 = GO!)

    // Run-local metrics — reset on each startRun()
    this.distance         = 0;
    this.score            = 0;
    this.coins            = 0;
    this.coinsCombo       = 0;
    this.lastCoinTime     = 0;
    this.maxSpeed         = 0;
    this.scoreMultiplier  = 1.0;
    this.latestCheckpoint = null;

    // Phase 5: per-run counters
    this.checkpointsReached = 0;
    this.tricksCompleted    = 0;

    // ── Three.js Core ─────────────────────────────────────────────────────────
    this.canvas = document.getElementById('webgl-canvas');
    this.scene  = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 800);
    this.clock  = new THREE.Clock();

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping       = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    // Camera follow lag
    this.cameraPos    = new THREE.Vector3(0, 5, -8);
    this.cameraLookAt = new THREE.Vector3(0, 1.5, 6);
    this.cameraShake  = 0;

    // ── Input State ───────────────────────────────────────────────────────────
    this.keys = {
      left: false, right: false, tuck: false, jump: false,
      spinLeft: false, spinRight: false, grab: false
    };
    this.inputSources = new Map();

    // ── Subsystems ────────────────────────────────────────────────────────────
    this.sound       = new SoundEngine();
    this.ui          = new UIManager(this.sound);
    this.environment = new Environment(this.scene);
    this.terrain     = new Terrain(this.scene);
    this.player      = new Player(this.scene, this.terrain, this.sound, this.environment);

    // ── Phase 6: Apply saved graphics quality to renderer ─────────────────────
    this.applyGraphicsQuality(this.ui.graphicsQuality);

    // Listen for quality change events fired by the Settings modal
    window.addEventListener('snowman_quality_change', (e) => {
      this.applyGraphicsQuality(e.detail.quality);
    });

    // ── Initialise Controls & UI ──────────────────────────────────────────────
    this.initEventListeners();
    this.initUIButtons();
    this.initMobileControls();   // Phase 6

    // Cinematic camera for main menu
    this.resetCameraForMenu();

    // Start render loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  // ===========================================================================
  // CAMERA
  // ===========================================================================

  resetCameraForMenu() {
    const p = this.player.position;
    this.camera.position.set(p.x + 3.2, p.y + 2.2, p.z - 4.5);
    this.camera.lookAt(p.x, p.y + 0.8, p.z + 1.2);
  }

  updateCamera(delta) {
    const pPos  = this.player.position;
    const pSpeed = this.player.velocity.z;

    // Cinematic floating camera on menu / gameover
    if (this.state === GameState.MENU || this.state === GameState.GAMEOVER) {
      const time = Date.now() * 0.0008;
      this.camera.position.x = pPos.x + Math.sin(time) * 3.5;
      this.camera.position.y = pPos.y + 2.0 + Math.cos(time * 0.7) * 0.4;
      this.camera.position.z = pPos.z - 5.0;
      this.camera.lookAt(pPos.x, pPos.y + 0.9, pPos.z + 1.2);
      return;
    }

    // During countdown, use a dramatic pull-back shot
    if (this.state === GameState.COUNTDOWN) {
      const time = Date.now() * 0.0005;
      this.camera.position.x = pPos.x + Math.sin(time) * 2.0;
      this.camera.position.y = pPos.y + 4.5;
      this.camera.position.z = pPos.z - 10.0;
      this.camera.lookAt(pPos.x, pPos.y + 0.5, pPos.z + 4.0);
      return;
    }

    // Dynamic FOV based on speed and nitro
    const nitroBonusFOV = this.player.isNitro ? 14 : 0;
    const targetFOV = 62 + Math.min((pSpeed / 28) * 12, 14) + nitroBonusFOV;
    this.camera.fov += (targetFOV - this.camera.fov) * 5.0 * delta;
    this.camera.updateProjectionMatrix();

    const targetCamX = pPos.x * 0.75;
    const targetCamY = pPos.y + 3.8;
    const targetCamZ = pPos.z - 7.2;

    this.cameraPos.x += (targetCamX - this.cameraPos.x) * 9.0  * delta;
    this.cameraPos.y += (targetCamY - this.cameraPos.y) * 12.0 * delta;
    this.cameraPos.z += (targetCamZ - this.cameraPos.z) * 15.0 * delta;

    const targetLookX = pPos.x * 0.55;
    const targetLookY = pPos.y + 1.3;
    const targetLookZ = pPos.z + 6.0;

    this.cameraLookAt.x += (targetLookX - this.cameraLookAt.x) * 10.0 * delta;
    this.cameraLookAt.y += (targetLookY - this.cameraLookAt.y) * 10.0 * delta;
    this.cameraLookAt.z += (targetLookZ - this.cameraLookAt.z) * 15.0 * delta;

    let shakeX = 0, shakeY = 0;
    if (this.cameraShake > 0.01) {
      shakeX = (Math.random() - 0.5) * this.cameraShake;
      shakeY = (Math.random() - 0.5) * this.cameraShake;
      this.cameraShake = Math.max(0, this.cameraShake - 3.5 * delta);
    }

    this.camera.position.set(
      this.cameraPos.x + shakeX,
      this.cameraPos.y + shakeY,
      this.cameraPos.z
    );
    this.camera.lookAt(this.cameraLookAt);
  }

  // ===========================================================================
  // GRAPHICS QUALITY  (Phase 6)
  // ===========================================================================

  /**
   * Adjusts renderer settings based on quality tier.
   * @param {'low'|'medium'|'high'} quality
   */
  applyGraphicsQuality(quality) {
    switch (quality) {
      case 'low':
        this.renderer.setPixelRatio(0.75);
        this.renderer.shadowMap.enabled = false;
        break;
      case 'medium':
        this.renderer.setPixelRatio(1.0);
        this.renderer.shadowMap.enabled = true;
        break;
      case 'high':
      default:
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        break;
    }
  }

  // ===========================================================================
  // KEYBOARD & WINDOW EVENTS
  // ===========================================================================

  _pushInputs() {
    this.player.setInputs(
      this.keys.left, this.keys.right, this.keys.tuck, this.keys.jump,
      this.keys.spinLeft, this.keys.spinRight, this.keys.grab
    );
  }

  _setInputSource(key, source, pressed) {
    if (!this.inputSources.has(key)) this.inputSources.set(key, new Set());
    const sources = this.inputSources.get(key);
    if (pressed) sources.add(source);
    else sources.delete(source);
    this.keys[key] = sources.size > 0;
    this._pushInputs();
  }

  initEventListeners() {
    window.addEventListener('resize', () => this.onWindowResize());
    window.addEventListener('blur', () => {
      for (const key of this.inputSources.keys()) {
        this.inputSources.get(key).delete('keyboard');
        this.keys[key] = this.inputSources.get(key).size > 0;
      }
      this._pushInputs();
    });

    window.addEventListener('keydown', (e) => {
      this.sound.init();   // Unlock audio on first interaction

      switch (e.code) {
        case 'KeyA':      case 'ArrowLeft':  this._setInputSource('left', 'keyboard', true);  break;
        case 'KeyD':      case 'ArrowRight': this._setInputSource('right', 'keyboard', true); break;
        case 'KeyW':      case 'ArrowUp':    this._setInputSource('tuck', 'keyboard', true);  break;
        case 'ShiftLeft': case 'ShiftRight': this._setInputSource('tuck', 'keyboard', true);  break;
        case 'KeyQ':                         this._setInputSource('spinLeft', 'keyboard', true); break;
        case 'KeyE':                         this._setInputSource('spinRight', 'keyboard', true); break;
        case 'KeyS':      case 'ArrowDown':  this._setInputSource('grab', 'keyboard', true);  break;
        case 'Space':
          this._setInputSource('jump', 'keyboard', true);
          if (this.state === GameState.GAMEOVER) this.startRun();
          e.preventDefault();
          return;
        case 'KeyP': case 'Escape':
          if (this.state === GameState.COUNTDOWN) {
            // Pressing Esc/P during countdown cancels it and returns to menu
            this.ui.hideCountdown();
            this.returnToMenu();
          } else {
            this.togglePause();
          }
          e.preventDefault();
          return;
        case 'KeyR':
          if (this.state === GameState.GAMEOVER && this.latestCheckpoint) {
            this.respawnAtCheckpoint();
          } else if (this.state !== GameState.COUNTDOWN) {
            this.startRun();
          }
          e.preventDefault();
          return;
        default:
          return; // Don't prevent default for other keys
      }

      e.preventDefault();
    });

    window.addEventListener('keyup', (e) => {
      switch (e.code) {
        case 'KeyA':      case 'ArrowLeft':  this._setInputSource('left', 'keyboard', false); break;
        case 'KeyD':      case 'ArrowRight': this._setInputSource('right', 'keyboard', false); break;
        case 'KeyW':      case 'ArrowUp':    this._setInputSource('tuck', 'keyboard', false); break;
        case 'ShiftLeft': case 'ShiftRight': this._setInputSource('tuck', 'keyboard', false); break;
        case 'KeyQ':                         this._setInputSource('spinLeft', 'keyboard', false); break;
        case 'KeyE':                         this._setInputSource('spinRight', 'keyboard', false); break;
        case 'KeyS':      case 'ArrowDown':  this._setInputSource('grab', 'keyboard', false); break;
        case 'Space':                        this._setInputSource('jump', 'keyboard', false); break;
      }
    });

    // Scoring events from player physics
    window.addEventListener('snowman_airbonus', (e) => {
      this.score += e.detail.bonus;
    });
    window.addEventListener('snowman_trick', (e) => {
      this.score += e.detail.score;
      this.tricksCompleted++;
    });
    window.addEventListener('snowman_badlanding', (e) => {
      this.handleCrash(null, e.detail.cause || 'bad landing');
    });
  }

  // ===========================================================================
  // UI BUTTON WIRING
  // ===========================================================================

  initUIButtons() {
    const wire = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', fn);
    };

    // ── Main Menu ─────────────────────────────────────────────────────────────
    wire('btn-play', () => {
      this.sound.init(); this.sound.playClick(); this.startRun();
    });
    wire('btn-how-to-play', () => {
      this.sound.init(); this.sound.playClick(); this.ui.showHowToPlay();
    });
    wire('btn-settings', () => {
      this.sound.init(); this.sound.playClick(); this.ui.showSettings();  // Phase 6
    });

    // ── How To Play Modal ─────────────────────────────────────────────────────
    wire('btn-close-modal',   () => { this.sound.playClick(); this.ui.hideHowToPlay(); });
    wire('btn-modal-got-it',  () => { this.sound.playClick(); this.ui.hideHowToPlay(); this.startRun(); });

    // ── HUD ───────────────────────────────────────────────────────────────────
    wire('btn-pause-toggle',  () => { this.sound.playClick(); this.togglePause(); });
    wire('btn-audio-toggle',  () => {
      this.sound.init();
      const muted = this.sound.toggleMute();
      this.ui.updateAudioIcon(muted);
    });

    // ── Pause Screen ──────────────────────────────────────────────────────────
    wire('btn-resume',            () => { this.sound.playClick(); this.togglePause(); });
    wire('btn-restart-pause',     () => { this.sound.playClick(); this.startRun(); });
    wire('btn-restart-checkpoint',() => { this.sound.playClick(); this.respawnAtCheckpoint(); });
    wire('btn-settings-pause',    () => { this.sound.playClick(); this.ui.showSettings(); }); // Phase 6
    wire('btn-menu-from-pause',   () => { this.sound.playClick(); this.returnToMenu(); });    // Phase 6

    // ── Game Over Screen ──────────────────────────────────────────────────────
    wire('btn-retry',             () => { this.sound.playClick(); this.startRun(); });
    wire('btn-menu-return',       () => { this.sound.playClick(); this.returnToMenu(); });
    wire('btn-checkpoint-respawn',() => { this.sound.playClick(); this.respawnAtCheckpoint(); });
  }

  // ===========================================================================
  // PHASE 6: MOBILE TOUCH CONTROLS
  // ===========================================================================

  /**
   * Registers touchstart / touchend / touchcancel listeners on each mobile
   * control button. Each button maps to the same this.keys flag that keyboard
   * events use, so all gameplay logic is identical.
   */
  initMobileControls() {
    // Only register if the device has touch support or small screen
    if (!this.ui.isMobile) return;

    /**
     * Pointer events support touch and stylus, and pointer capture makes a
     * release outside the button reliable. Each pointer is an independent input source.
     * @param {string} id   — DOM element id
     * @param {string} key  — key name in this.keys
     */
    const touch = (id, key) => {
      const btn = document.getElementById(id);
      if (!btn) return;

      const press = (e) => {
        e.preventDefault();
        this.sound.init();   // Unlock audio on first touch
        if (btn.setPointerCapture && e.pointerId !== undefined) {
          try { btn.setPointerCapture(e.pointerId); } catch { /* pointer may have ended */ }
        }
        this._setInputSource(key, `pointer-${e.pointerId}`, true);
      };
      const release = (e) => {
        e.preventDefault();
        this._setInputSource(key, `pointer-${e.pointerId}`, false);
      };

      btn.addEventListener('pointerdown', press);
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('lostpointercapture', release);
    };

    // Map each button to its corresponding key
    touch('mc-left',       'left');
    touch('mc-right',      'right');
    touch('mc-tuck',       'tuck');
    touch('mc-nitro',      'tuck');      // Nitro btn also activates tuck boost
    touch('mc-jump',       'jump');
    touch('mc-spin-left',  'spinLeft');
    touch('mc-spin-right', 'spinRight');
    touch('mc-grab',       'grab');

    // Jump also needs to handle the GAMEOVER restart
    const jumpBtn = document.getElementById('mc-jump');
    if (jumpBtn) {
      jumpBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (this.state === GameState.GAMEOVER) this.startRun();
      }, { passive: false });
    }
  }

  // ===========================================================================
  // GAME STATE TRANSITIONS
  // ===========================================================================

  /**
   * Initiates a new run — shows the 3-2-1 countdown then transitions to PLAYING.
   * All run-local state is reset here immediately (before the countdown ends).
   */
  startRun() {
    // Reset run-local state
    this.distance         = 0;
    this.score            = 0;
    this.coins            = 0;
    this.coinsCombo       = 0;
    this.lastCoinTime     = 0;
    this.maxSpeed         = 0;
    this.cameraShake      = 0;
    this.latestCheckpoint = null;
    this.checkpointsReached = 0;
    this.tricksCompleted    = 0;

    // Reset terrain and player
    this.terrain.reset();
    this.player.reset(0, 0);

    // Start countdown state (Phase 6)
    this.state          = GameState.COUNTDOWN;
    this.countdownTimer  = 0;
    this.countdownValue  = 3;

    // Show HUD with zeros (behind the countdown overlay)
    this.ui.setCheckpointAvailable(false);
    this.ui.updateCheckpointStatus(false);
    this.ui.updateNitro(false, 0);
    this.ui.updateShield(false);
    this.ui.showPlaying();     // shows HUD, hides overlays, resets _rewardApplied
    this.ui.showCountdown(3);  // show first number immediately
  }

  /**
   * Called when countdown reaches zero — transitions to active gameplay.
   */
  _beginPlaying() {
    this.state = GameState.PLAYING;
    this.ui.hideCountdown();
    this.sound.playCountdownGo();
    this.sound.playStartFanfare();
    this.clock.getDelta(); // clear any delta accumulation during countdown
  }

  respawnAtCheckpoint() {
    if (!this.latestCheckpoint) { this.startRun(); return; }
    this.state = GameState.PLAYING;
    this.player.respawnAt(this.latestCheckpoint);
    this.distance = Math.max(0, this.player.position.z);
    this.sound.playCheckpoint();
    this.ui.showPlaying();
    this.ui.updateShield(true);
    this.clock.getDelta();
  }

  togglePause() {
    if (this.state === GameState.PLAYING) {
      this.state = GameState.PAUSED;
      this.sound.silenceLoops();
      this.ui.showPause(this.distance, this.score, this.coins, Boolean(this.latestCheckpoint));
      this.ui.hideMobileControls();
    } else if (this.state === GameState.PAUSED) {
      this.state = GameState.PLAYING;
      this.ui.hidePause(); // hidePause also calls showMobileControls
      this.clock.getDelta();
    }
  }

  returnToMenu() {
    this.state = GameState.MENU;
    this.sound.silenceLoops();
    this.terrain.reset();
    this.player.reset(0, 0);
    this.ui.hideCountdown();
    this.resetCameraForMenu();
    this.ui.showMenu();
  }

  handleCrash(obstacle, cause = 'obstacle') {
    if (this.state !== GameState.PLAYING) return;

    this.player.crash();
    this.cameraShake = 1.8;
    this.environment.emitCrashBlast(this.player.position);

    setTimeout(() => {
      if (this.state === GameState.PLAYING) {
        this.state = GameState.GAMEOVER;
        this.ui.showGameOver({
          distance:     this.distance,
          score:        this.score,
          coins:        this.coins,
          maxSpeed:     this.maxSpeed,
          airtime:      this.player.totalAirTime,
          cause,
          hasCheckpoint: Boolean(this.latestCheckpoint),
          checkpoints:  this.checkpointsReached,
          tricks:       this.tricksCompleted
        });
      }
    }, 1100);
  }

  onWindowResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // ===========================================================================
  // UPDATE LOOP
  // ===========================================================================

  update(delta) {
    // ── COUNTDOWN state ───────────────────────────────────────────────────────
    if (this.state === GameState.COUNTDOWN) {
      this.countdownTimer += delta;

      // Which number should be showing? (3 → 2 → 1 → 0="GO!")
      const newValue = Math.max(0, 3 - Math.floor(this.countdownTimer));
      if (newValue !== this.countdownValue) {
        this.countdownValue = newValue;
        if (newValue > 0) {
          this.ui.showCountdown(newValue);
          this.sound.playCountdownBeep(newValue);
        } else {
          this.ui.showCountdown(0); // displays "GO!"
        }
      }

      // After 3.5s total, begin playing
      if (this.countdownTimer >= 3.5) {
        this._beginPlaying();
      }

      // Keep environment + camera animated during countdown
      this.updateCamera(delta);
      this.environment.update(delta, this.player.position, 0, false);
      return;
    }

    // ── PAUSED / MENU / GAMEOVER — no physics ─────────────────────────────────
    if (this.state !== GameState.PLAYING && !this.player.isCrashed) {
      this.updateCamera(delta);
      return;
    }

    // ── Player physics ────────────────────────────────────────────────────────
    if (this.state === GameState.PLAYING || this.player.isCrashed) {
      this.player.update(delta);
    }

    // ── Score & metrics (only while actively playing and alive) ───────────────
    if (this.state === GameState.PLAYING && !this.player.isCrashed) {
      this.distance = Math.max(0, this.player.position.z);
      const speedKmH = this.player.getSpeedKmH();
      if (speedKmH > this.maxSpeed) this.maxSpeed = speedKmH;

      // Score accrual
      const speedBonus    = this.player.velocity.z / 15;
      const tuckMultiplier = this.player.isTucking ? 1.5 : 1.0;
      this.score += delta * 18 * speedBonus * tuckMultiplier;

      // HUD update (Phase 6: also pushes bestScore + totalCoins sub-displays)
      this.ui.updateHUD(this.distance, this.score, speedKmH, this.player.isTucking, this.coins);
      this.ui.updateNitro(this.player.isNitro, this.player.nitroTimer, 4.0);
      this.ui.updateShield(this.player.isInvulnerable);

      // Air trick HUD
      const spinDeg = Math.floor(Math.abs(this.player.spinAngle) * (180 / Math.PI));
      const grabType = this.player.isGrabbing
        ? (this.player.highestSpinMilestone > 0 ? 'METHOD' : 'INDY')
        : null;
      this.ui.updateAirTrickHUD(
        this.player.isGrounded, this.player.airTime, spinDeg,
        this.player.isGrabbing, grabType
      );

      // Snow spray particles
      if (this.player.isGrounded) {
        const lateralSpeed = Math.abs(this.player.lateralVelocity);
        if (lateralSpeed > 2.0) {
          this.environment.emitSpray(
            this.player.position, this.player.lateralVelocity,
            lateralSpeed / this.player.turnSpeed
          );
        }
      }

      // Nitro thruster particles
      if (this.player.isNitro) {
        this.environment.emitNitroThruster(this.player.position, this.player.lateralVelocity);
      }

      // ── Coin collection ─────────────────────────────────────────────────────
      const coinHit = this.terrain.checkCoinCollisions(this.player.position, 1.4);
      if (coinHit.collected) {
        this.coins += coinHit.coins;
        this.score += coinHit.points;
        this.sound.playCoinCollect();
        this.environment.emitCoinSparkles(coinHit.position);
        this.ui.pulseCoinCard();

        const now = performance.now();
        if (now - this.lastCoinTime < 1800) {
          this.coinsCombo++;
          if (this.coinsCombo % 5 === 0) {
            const bonus = this.coinsCombo * 20;
            this.score += bonus;
            window.dispatchEvent(new CustomEvent('snowman_coincombo', { detail: { bonus } }));
          }
        } else {
          this.coinsCombo = 1;
        }
        this.lastCoinTime = now;
      }

      // ── Nitro pickup ────────────────────────────────────────────────────────
      const nitroHit = this.terrain.checkNitroCollisions(this.player.position, 1.45);
      if (nitroHit.collected) {
        this.player.activateNitro(nitroHit.duration || 4.0);
        this.sound.playNitroBoost();
        this.environment.emitCoinSparkles(nitroHit.position);
        window.dispatchEvent(new CustomEvent('snowman_nitro'));
      }

      // ── Checkpoint gates ────────────────────────────────────────────────────
      const cpHit = this.terrain.checkCheckpointCollisions(this.player.position);
      if (cpHit.passed) {
        this.latestCheckpoint = { x: cpHit.x, y: cpHit.y, z: cpHit.z };
        this.score += cpHit.points;
        this.sound.playCheckpoint();
        this.ui.setCheckpointAvailable(true);
        this.ui.updateCheckpointStatus(true);   // Phase 6: HUD badge
        this.checkpointsReached++;
        window.dispatchEvent(new CustomEvent('snowman_checkpoint', { detail: { bonus: cpHit.points } }));
      }

      // ── Obstacle collisions ─────────────────────────────────────────────────
      const collision = this.terrain.checkCollisions(this.player.position, 0.55);
      if (collision.hit) {
        if (collision.type === 'crash') {
          if (!this.player.isInvulnerable) this.handleCrash(collision.obstacle, collision.cause);
        } else if (collision.type === 'ramp') {
          this.player.launchRamp(collision.boostVy);
        } else if (collision.type === 'gate') {
          this.score += 500;
          this.sound.playGateBonus();
          window.dispatchEvent(new CustomEvent('snowman_gatebonus', { detail: { bonus: 500 } }));
        }
      }
    }

    // ── Terrain, Environment, Camera ──────────────────────────────────────────
    this.terrain.update(delta, this.player.position.z);
    this.environment.update(delta, this.player.position, this.player.velocity.z, this.player.isTucking);
    this.updateCamera(delta);
  }

  // ===========================================================================
  // RENDER LOOP
  // ===========================================================================

  animate() {
    requestAnimationFrame(this.animate);
    const delta = Math.min(this.clock.getDelta(), 0.1);

    // Physics paused while game is paused (but camera still animates in MENU/GAMEOVER)
    if (this.state !== GameState.PAUSED) {
      this.update(delta);
    }

    this.renderer.render(this.scene, this.camera);
  }
}

// Instantiate when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
