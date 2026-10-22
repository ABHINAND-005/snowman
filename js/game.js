/**
 * SNOWMAN — Alpine Freeride 3D
 * Main Game Controller & Render Engine
 * Coordinates Three.js scene, camera, input, physics, game states, and UI.
 */

import * as THREE from 'three';
import { SoundEngine } from './audio.js';
import { Environment } from './environment.js';
import { Terrain } from './terrain.js';
import { Player } from './player.js';
import { UIManager } from './ui.js';

// Game State Enum
const GameState = {
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAMEOVER: 'GAMEOVER'
};

class Game {
  constructor() {
    this.state = GameState.MENU;

    // Game Metrics & Scoring (run-local, reset each run)
    this.distance = 0;
    this.score = 0;
    this.coins = 0;
    this.coinsCombo = 0;
    this.lastCoinTime = 0;
    this.maxSpeed = 0;
    this.scoreMultiplier = 1.0;
    this.latestCheckpoint = null;

    // Phase 5: Per-run counters (reset each run, not persisted directly)
    this.checkpointsReached = 0;  // gates passed this run
    this.tricksCompleted    = 0;  // clean trick landings this run

    // Three.js Core Components
    this.canvas = document.getElementById('webgl-canvas');
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 800);
    this.clock = new THREE.Clock();

    // Setup WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    // Camera follow lag variables
    this.cameraPos = new THREE.Vector3(0, 5, -8);
    this.cameraLookAt = new THREE.Vector3(0, 1.5, 6);
    this.cameraShake = 0;

    // Input tracker
    this.keys = {
      left: false,
      right: false,
      tuck: false,
      jump: false,
      spinLeft: false,
      spinRight: false,
      grab: false
    };

    // Instantiate Subsystems
    this.sound = new SoundEngine();
    this.ui = new UIManager(this.sound);
    this.environment = new Environment(this.scene);
    this.terrain = new Terrain(this.scene);
    this.player = new Player(this.scene, this.terrain, this.sound, this.environment);

    // Bind event listeners
    this.initEventListeners();
    this.initUIButtons();

    // Initial camera position for menu
    this.resetCameraForMenu();

    // Start single continuous animation loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  /**
   * Sets up cinematic camera angle for main menu
   */
  resetCameraForMenu() {
    const pPos = this.player.position;
    this.camera.position.set(pPos.x + 3.2, pPos.y + 2.2, pPos.z - 4.5);
    this.camera.lookAt(pPos.x, pPos.y + 0.8, pPos.z + 1.2);
  }

  /**
   * Keyboard and window resize listeners
   */
  initEventListeners() {
    window.addEventListener('resize', () => this.onWindowResize());

    window.addEventListener('keydown', (e) => {
      // Initialize audio on first keypress
      this.sound.init();

      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        this.keys.left = true;
        e.preventDefault();
      } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        this.keys.right = true;
        e.preventDefault();
      } else if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        this.keys.tuck = true;
        e.preventDefault();
      } else if (e.code === 'KeyQ') {
        this.keys.spinLeft = true;
        e.preventDefault();
      } else if (e.code === 'KeyE') {
        this.keys.spinRight = true;
        e.preventDefault();
      } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        this.keys.grab = true;
        e.preventDefault();
      } else if (e.code === 'Space') {
        this.keys.jump = true;
        if (this.state === GameState.GAMEOVER) {
          this.startRun();
        }
        e.preventDefault();
      } else if (e.code === 'KeyP' || e.code === 'Escape') {
        this.togglePause();
        e.preventDefault();
      } else if (e.code === 'KeyR') {
        if (this.state === GameState.GAMEOVER && this.latestCheckpoint) {
          this.respawnAtCheckpoint();
        } else {
          this.startRun();
        }
        e.preventDefault();
      }

      this.player.setInputs(
        this.keys.left,
        this.keys.right,
        this.keys.tuck,
        this.keys.jump,
        this.keys.spinLeft,
        this.keys.spinRight,
        this.keys.grab
      );
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') {
        this.keys.left = false;
      } else if (e.code === 'KeyD' || e.code === 'ArrowRight') {
        this.keys.right = false;
      } else if (e.code === 'KeyW' || e.code === 'ArrowUp') {
        this.keys.tuck = false;
      } else if (e.code === 'KeyQ') {
        this.keys.spinLeft = false;
      } else if (e.code === 'KeyE') {
        this.keys.spinRight = false;
      } else if (e.code === 'KeyS' || e.code === 'ArrowDown') {
        this.keys.grab = false;
      } else if (e.code === 'Space') {
        this.keys.jump = false;
      }
      this.player.setInputs(
        this.keys.left,
        this.keys.right,
        this.keys.tuck,
        this.keys.jump,
        this.keys.spinLeft,
        this.keys.spinRight,
        this.keys.grab
      );
    });

    // Listen for custom scoring events from player jump landings & tricks
    window.addEventListener('snowman_airbonus', (e) => {
      this.score += e.detail.bonus;
    });
    window.addEventListener('snowman_trick', (e) => {
      this.score += e.detail.score;
      // Phase 5: count each clean trick landing
      this.tricksCompleted++;
    });
    window.addEventListener('snowman_badlanding', (e) => {
      this.handleCrash(null, e.detail.cause || 'bad landing');
    });
  }

  /**
   * Connects DOM UI action buttons
   */
  initUIButtons() {
    // Play Button
    const btnPlay = document.getElementById('btn-play');
    if (btnPlay) {
      btnPlay.addEventListener('click', () => {
        this.sound.init();
        this.sound.playClick();
        this.startRun();
      });
    }

    // How to Play Modal
    const btnHowToPlay = document.getElementById('btn-how-to-play');
    if (btnHowToPlay) {
      btnHowToPlay.addEventListener('click', () => {
        this.sound.init();
        this.sound.playClick();
        this.ui.showHowToPlay();
      });
    }

    const btnCloseModal = document.getElementById('btn-close-modal');
    if (btnCloseModal) {
      btnCloseModal.addEventListener('click', () => {
        this.sound.playClick();
        this.ui.hideHowToPlay();
      });
    }

    const btnModalGotIt = document.getElementById('btn-modal-got-it');
    if (btnModalGotIt) {
      btnModalGotIt.addEventListener('click', () => {
        this.sound.playClick();
        this.ui.hideHowToPlay();
        this.startRun();
      });
    }

    // Pause Controls
    const btnPauseToggle = document.getElementById('btn-pause-toggle');
    if (btnPauseToggle) {
      btnPauseToggle.addEventListener('click', () => {
        this.sound.playClick();
        this.togglePause();
      });
    }

    const btnResume = document.getElementById('btn-resume');
    if (btnResume) {
      btnResume.addEventListener('click', () => {
        this.sound.playClick();
        this.togglePause();
      });
    }

    const btnRestartPause = document.getElementById('btn-restart-pause');
    if (btnRestartPause) {
      btnRestartPause.addEventListener('click', () => {
        this.sound.playClick();
        this.startRun();
      });
    }

    // Game Over Buttons
    const btnRetry = document.getElementById('btn-retry');
    if (btnRetry) {
      btnRetry.addEventListener('click', () => {
        this.sound.playClick();
        this.startRun();
      });
    }

    const btnMenuReturn = document.getElementById('btn-menu-return');
    if (btnMenuReturn) {
      btnMenuReturn.addEventListener('click', () => {
        this.sound.playClick();
        this.returnToMenu();
      });
    }

    // Checkpoint Respawn Buttons
    const btnRestartCheckpoint = document.getElementById('btn-restart-checkpoint');
    if (btnRestartCheckpoint) {
      btnRestartCheckpoint.addEventListener('click', () => {
        this.sound.playClick();
        this.respawnAtCheckpoint();
      });
    }

    const btnCheckpointRespawn = document.getElementById('btn-checkpoint-respawn');
    if (btnCheckpointRespawn) {
      btnCheckpointRespawn.addEventListener('click', () => {
        this.sound.playClick();
        this.respawnAtCheckpoint();
      });
    }

    // Audio Mute Toggle
    const btnAudio = document.getElementById('btn-audio-toggle');
    if (btnAudio) {
      btnAudio.addEventListener('click', () => {
        this.sound.init();
        const isMuted = this.sound.toggleMute();
        this.ui.updateAudioIcon(isMuted);
      });
    }
  }

  /**
   * Starts a brand new downhill freeride run
   */
  startRun() {
    this.state = GameState.PLAYING;

    // Reset run-local metrics (saved progress in ui.js is NOT touched here)
    this.distance = 0;
    this.score = 0;
    this.coins = 0;
    this.coinsCombo = 0;
    this.lastCoinTime = 0;
    this.maxSpeed = 0;
    this.cameraShake = 0;
    this.latestCheckpoint = null;

    // Phase 5: reset per-run counters
    this.checkpointsReached = 0;
    this.tricksCompleted    = 0;

    // Reset terrain and player position to mountain summit
    this.terrain.reset();
    this.player.reset(0, 0);

    // Audio cue
    this.sound.playStartFanfare();

    // Show HUD & reset overlays
    this.ui.setCheckpointAvailable(false);
    this.ui.updateNitro(false, 0);
    this.ui.updateShield(false);
    this.ui.showPlaying(); // also resets _rewardApplied guard in UIManager
  }

  /**
   * Respawns rider at the latest reached checkpoint gate with collision protection
   */
  respawnAtCheckpoint() {
    if (!this.latestCheckpoint) {
      this.startRun();
      return;
    }
    this.state = GameState.PLAYING;
    this.player.respawnAt(this.latestCheckpoint);
    this.distance = Math.max(0, this.player.position.z);
    this.sound.playCheckpoint();
    this.ui.showPlaying();
    this.ui.updateShield(true);
    this.clock.getDelta(); // Clear delta accumulator
  }

  /**
   * Toggles game pause state
   */
  togglePause() {
    if (this.state === GameState.PLAYING) {
      this.state = GameState.PAUSED;
      this.sound.silenceLoops();
      this.ui.showPause(this.distance, this.score, this.coins, Boolean(this.latestCheckpoint));
    } else if (this.state === GameState.PAUSED) {
      this.state = GameState.PLAYING;
      this.ui.hidePause();
      this.clock.getDelta(); // Clear delta accumulator
    }
  }

  /**
   * Returns to main menu screen
   */
  returnToMenu() {
    this.state = GameState.MENU;
    this.sound.silenceLoops();
    this.terrain.reset();
    this.player.reset(0, 0);
    this.resetCameraForMenu();
    this.ui.showMenu();
  }

  /**
   * Handles player wipeout with snow blast and camera shake
   */
  handleCrash(obstacle, cause = 'obstacle') {
    if (this.state !== GameState.PLAYING) return;

    this.player.crash();
    this.cameraShake = 1.8;
    this.environment.emitCrashBlast(this.player.position);

    // Short delay to watch the wipeout animation before displaying Game Over screen
    setTimeout(() => {
      if (this.state === GameState.PLAYING) {
        this.state = GameState.GAMEOVER;
        // Phase 5: pass full stats including per-run counters
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

  /**
   * Window resize handler
   */
  onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * Dynamic 3rd person chase camera with speed FOV and screen shake
   */
  updateCamera(delta) {
    const pPos = this.player.position;
    const pSpeed = this.player.velocity.z;

    if (this.state === GameState.MENU) {
      // Gentle floating showcase camera in menu
      const time = Date.now() * 0.0008;
      this.camera.position.x = pPos.x + Math.sin(time) * 3.5;
      this.camera.position.y = pPos.y + 2.0 + Math.cos(time * 0.7) * 0.4;
      this.camera.position.z = pPos.z - 5.0;
      this.camera.lookAt(pPos.x, pPos.y + 0.9, pPos.z + 1.2);
      return;
    }

    // Dynamic FOV based on speed and nitro boost (widens for rush feeling)
    const nitroBonusFOV = this.player.isNitro ? 14 : 0;
    const targetFOV = 62 + Math.min((pSpeed / 28) * 12, 14) + nitroBonusFOV;
    this.camera.fov += (targetFOV - this.camera.fov) * 5.0 * delta;
    this.camera.updateProjectionMatrix();

    // Target camera location behind and above rider
    const targetCamX = pPos.x * 0.75;
    const targetCamY = pPos.y + 3.8;
    const targetCamZ = pPos.z - 7.2;

    // Smooth lerp to target
    this.cameraPos.x += (targetCamX - this.cameraPos.x) * 9.0 * delta;
    this.cameraPos.y += (targetCamY - this.cameraPos.y) * 12.0 * delta;
    this.cameraPos.z += (targetCamZ - this.cameraPos.z) * 15.0 * delta;

    // LookAt target ahead of rider
    const targetLookX = pPos.x * 0.55;
    const targetLookY = pPos.y + 1.3;
    const targetLookZ = pPos.z + 6.0;

    this.cameraLookAt.x += (targetLookX - this.cameraLookAt.x) * 10.0 * delta;
    this.cameraLookAt.y += (targetLookY - this.cameraLookAt.y) * 10.0 * delta;
    this.cameraLookAt.z += (targetLookZ - this.cameraLookAt.z) * 15.0 * delta;

    // Apply screen shake
    let shakeX = 0;
    let shakeY = 0;
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

  /**
   * Main game update logic
   */
  update(delta) {
    const isPlaying = this.state === GameState.PLAYING;

    // 1. Update Player Physics & Kinematics
    if (isPlaying || this.player.isCrashed) {
      this.player.update(delta);
    }

    // 2. Update Metrics & Score
    if (isPlaying && !this.player.isCrashed) {
      this.distance = Math.max(0, this.player.position.z);
      const speedKmH = this.player.getSpeedKmH();
      if (speedKmH > this.maxSpeed) this.maxSpeed = speedKmH;

      // Score builds from distance traveled + speed multiplier + tuck bonus
      const speedBonus = (this.player.velocity.z / 15);
      const tuckMultiplier = this.player.isTucking ? 1.5 : 1.0;
      this.score += delta * 18 * speedBonus * tuckMultiplier;

      // Update HUD telemetry
      this.ui.updateHUD(this.distance, this.score, speedKmH, this.player.isTucking, this.coins);
      this.ui.updateNitro(this.player.isNitro, this.player.nitroTimer, 4.0);
      this.ui.updateShield(this.player.isInvulnerable);

      // Real-time air trick HUD telemetry (air time, spin angle, grab type)
      const spinDeg = Math.floor(Math.abs(this.player.spinAngle) * (180 / Math.PI));
      const grabType = this.player.isGrabbing
        ? (this.player.highestSpinMilestone > 0 ? 'METHOD' : 'INDY')
        : null;
      this.ui.updateAirTrickHUD(
        this.player.isGrounded,
        this.player.airTime,
        spinDeg,
        this.player.isGrabbing,
        grabType
      );

      // Emit snow spray particles when carving or sliding
      if (this.player.isGrounded) {
        const lateralSpeed = Math.abs(this.player.lateralVelocity);
        if (lateralSpeed > 2.0) {
          this.environment.emitSpray(
            this.player.position,
            this.player.lateralVelocity,
            lateralSpeed / this.player.turnSpeed
          );
        }
      }

      // Emit supersonic rocket flame particles during nitro boost
      if (this.player.isNitro) {
        this.environment.emitNitroThruster(this.player.position, this.player.lateralVelocity);
      }

      // 3. Coin Collection Check
      const coinHit = this.terrain.checkCoinCollisions(this.player.position, 1.4);
      if (coinHit.collected) {
        this.coins += coinHit.coins;
        this.score += coinHit.points;
        this.sound.playCoinCollect();
        this.environment.emitCoinSparkles(coinHit.position);
        this.ui.pulseCoinCard();

        // Rhythmic coin combo bonus
        const now = performance.now();
        if (now - this.lastCoinTime < 1800) {
          this.coinsCombo++;
          if (this.coinsCombo % 5 === 0) {
            const comboBonus = this.coinsCombo * 20;
            this.score += comboBonus;
            window.dispatchEvent(new CustomEvent('snowman_coincombo', {
              detail: { bonus: comboBonus }
            }));
          }
        } else {
          this.coinsCombo = 1;
        }
        this.lastCoinTime = now;
      }

      // 3b. Nitro Boost Pickup Collection Check
      const nitroHit = this.terrain.checkNitroCollisions(this.player.position, 1.45);
      if (nitroHit.collected) {
        this.player.activateNitro(nitroHit.duration || 4.0);
        this.sound.playNitroBoost();
        this.environment.emitCoinSparkles(nitroHit.position);
        window.dispatchEvent(new CustomEvent('snowman_nitro'));
      }

      // 3c. Checkpoint Gate Collision Check
      const cpHit = this.terrain.checkCheckpointCollisions(this.player.position);
      if (cpHit.passed) {
        this.latestCheckpoint = {
          x: cpHit.x,
          y: cpHit.y,
          z: cpHit.z
        };
        this.score += cpHit.points;
        this.sound.playCheckpoint();
        this.ui.setCheckpointAvailable(true);
        // Phase 5: count the gate
        this.checkpointsReached++;
        window.dispatchEvent(new CustomEvent('snowman_checkpoint', {
          detail: { bonus: cpHit.points }
        }));
      }

      // 4. Collision Detection with obstacles (Bypassed if invulnerable)
      const collision = this.terrain.checkCollisions(this.player.position, 0.55);
      if (collision.hit) {
        if (collision.type === 'crash') {
          if (!this.player.isInvulnerable) {
            this.handleCrash(collision.obstacle, collision.cause);
          }
        } else if (collision.type === 'ramp') {
          // Launch rider off snow kicker ramp
          this.player.launchRamp(collision.boostVy);
        } else if (collision.type === 'gate') {
          // Slalom gate bonus
          this.score += 500;
          this.sound.playGateBonus();
          window.dispatchEvent(new CustomEvent('snowman_gatebonus', {
            detail: { bonus: 500 }
          }));
        }
      }
    }

    // 5. Update Infinite Terrain Chunks, Obstacles & Coins (Recycling)
    this.terrain.update(delta, this.player.position.z);

    // 6. Update Atmospheric Environment (Snowflakes, Sun, Mountain Silhouettes)
    this.environment.update(
      delta,
      this.player.position,
      this.player.velocity.z,
      this.player.isTucking
    );

    // 6. Update Camera
    this.updateCamera(delta);
  }

  /**
   * Single animation render loop
   */
  animate() {
    requestAnimationFrame(this.animate);

    // Delta time clamped to 0.1s to avoid physics skips on lag spikes
    const delta = Math.min(this.clock.getDelta(), 0.1);

    if (this.state !== GameState.PAUSED) {
      this.update(delta);
    }

    this.renderer.render(this.scene, this.camera);
  }
}

// Instantiate game when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  window.game = new Game();
});
