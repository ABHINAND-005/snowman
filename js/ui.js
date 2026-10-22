/**
 * UI Manager for SNOWMAN
 * Controls Heads-Up Display (HUD), Main Menu, How To Play Modal, Pause Overlay,
 * Game Over / Results Screen, High Score & Coin Bank persistence, and notification toasts.
 *
 * Phase 5 additions:
 *  - Full LocalStorage persistence: high score, total coins, longest distance,
 *    total runs, sound settings, graphics quality.
 *  - Per-run tracking: checkpoints reached, tricks completed.
 *  - Duplicate-reward prevention via a rewardApplied flag.
 *  - "NEW HIGH SCORE" badge (separate from distance record).
 *  - Enhanced results screen showing all tracked metrics.
 */

export class UIManager {
  constructor(soundEngine) {
    this.sound = soundEngine;

    // Cache DOM Elements
    this.hud = document.getElementById('hud');
    this.hudDistance = document.getElementById('hud-distance');
    this.hudScore = document.getElementById('hud-score');
    this.hudCoins = document.getElementById('hud-coins');
    this.hudSpeed = document.getElementById('hud-speed');
    this.speedBarFill = document.getElementById('speed-bar-fill');
    this.tuckBadge = document.getElementById('hud-tuck-badge');
    this.toastContainer = document.getElementById('hud-toast-container');
    this.coinCard = document.querySelector('.coin-card');

    // Nitro & Shield HUD elements
    this.nitroCard = document.getElementById('hud-nitro-card');
    this.nitroTimer = document.getElementById('hud-nitro-timer');
    this.nitroBarFill = document.getElementById('nitro-bar-fill');
    this.shieldBadge = document.getElementById('hud-shield-badge');

    // Aerial Trick Meter elements
    this.trickMeter = document.getElementById('hud-trick-meter');
    this.trickAirStatus = document.getElementById('hud-trick-status');
    this.trickSpinTag = document.getElementById('hud-trick-spin');
    this.trickGrabTag = document.getElementById('hud-trick-grab');

    // Checkpoint Respawn buttons
    this.btnRestartCheckpoint = document.getElementById('btn-restart-checkpoint');
    this.btnCheckpointRespawn = document.getElementById('btn-checkpoint-respawn');

    // Audio & Pause HUD icons
    this.btnAudioToggle = document.getElementById('btn-audio-toggle');
    this.iconSoundOn = document.getElementById('icon-sound-on');
    this.iconSoundOff = document.getElementById('icon-sound-off');
    this.btnPauseToggle = document.getElementById('btn-pause-toggle');

    // Screens & Modals
    this.menuOverlay = document.getElementById('menu-overlay');
    this.pauseOverlay = document.getElementById('pause-overlay');
    this.gameoverOverlay = document.getElementById('gameover-overlay');
    this.howToPlayModal = document.getElementById('how-to-play-modal');

    // Menu records
    this.menuBestDistance = document.getElementById('menu-best-distance');
    this.menuBestScore = document.getElementById('menu-best-score');
    this.menuTotalCoins = document.getElementById('menu-total-coins');
    this.menuTotalRuns = document.getElementById('menu-total-runs');
    this.menuLongestDistance = document.getElementById('menu-longest-distance');

    // Pause elements
    this.pauseDistance = document.getElementById('pause-distance');
    this.pauseScore = document.getElementById('pause-score');
    this.pauseCoins = document.getElementById('pause-coins');

    // Game Over elements
    this.goDistance = document.getElementById('go-distance');
    this.goScore = document.getElementById('go-score');
    this.goCoins = document.getElementById('go-coins');
    this.goSpeed = document.getElementById('go-speed');
    this.goAirtime = document.getElementById('go-airtime');
    this.goTotalCoins = document.getElementById('go-total-coins');
    this.goHighScore = document.getElementById('go-high-score');
    this.goCheckpoints = document.getElementById('go-checkpoints');
    this.goTricks = document.getElementById('go-tricks');
    this.goTotalRuns = document.getElementById('go-total-runs');
    this.newRecordBadge = document.getElementById('new-record-badge');
    this.newHighScoreBadge = document.getElementById('new-high-score-badge');
    this.gameoverCause = document.getElementById('gameover-cause');

    // -------------------------------------------------------------------------
    // Phase 5: Full Persistent Progress — LocalStorage Keys
    // -------------------------------------------------------------------------
    // snowman_best_dist    — longest distance in one run (metres)
    // snowman_best_score   — highest score in one run (points)
    // snowman_total_coins  — all-time coin bank
    // snowman_total_runs   — total completed runs
    // snowman_muted        — audio muted state (also written by SoundEngine)
    // snowman_quality      — graphics quality: 'low' | 'medium' | 'high'

    this.bestDistance = 0;
    this.bestScore = 0;
    this.totalCoins = 0;
    this.totalRuns = 0;
    this.graphicsQuality = 'high';

    // Guard flag: prevents coins / run-count being credited more than once per
    // run result screen display, even if showGameOver() is somehow called again.
    this._rewardApplied = false;

    // Load all saved values from LocalStorage
    this.loadPersistentProgress();

    // Setup Audio Icon
    this.updateAudioIcon(this.sound.isMuted);

    // Bind custom in-game event listeners
    window.addEventListener('snowman_airbonus', (e) => {
      this.showToast(`🚀 AIR BONUS +${e.detail.bonus}!`);
    });
    window.addEventListener('snowman_gatebonus', (e) => {
      this.showToast(`🎯 SLALOM GATE +${e.detail.bonus}!`);
    });
    window.addEventListener('snowman_coincombo', (e) => {
      this.showToast(`🪙 COIN COMBO +${e.detail.bonus}!`);
    });
    window.addEventListener('snowman_checkpoint', (e) => {
      this.showToast(`⚡ CHECKPOINT REACHED +${e.detail.bonus}!`);
    });
    window.addEventListener('snowman_nitro', () => {
      this.showToast('🚀 NITRO BOOST ENGAGED!');
    });
    window.addEventListener('snowman_trick', (e) => {
      this.showTrickBanner(e.detail.trickName, e.detail.score);
    });
    window.addEventListener('snowman_badlanding', (e) => {
      this.showToast(`💥 FAILED LANDING! ${e.detail.cause.toUpperCase()}`);
    });
  }

  // ===========================================================================
  // PERSISTENT PROGRESS — LocalStorage Load & Save
  // ===========================================================================

  /**
   * Loads all persistent records from LocalStorage.
   * Gracefully falls back to zero if storage is unavailable or values are
   * corrupt/missing.
   */
  loadPersistentProgress() {
    try {
      this.bestDistance = parseInt(localStorage.getItem('snowman_best_dist') || '0', 10) || 0;
      this.bestScore    = parseInt(localStorage.getItem('snowman_best_score') || '0', 10) || 0;
      this.totalCoins   = parseInt(localStorage.getItem('snowman_total_coins') || '0', 10) || 0;
      this.totalRuns    = parseInt(localStorage.getItem('snowman_total_runs') || '0', 10) || 0;
      this.graphicsQuality = localStorage.getItem('snowman_quality') || 'high';
    } catch {
      this.bestDistance = 0;
      this.bestScore = 0;
      this.totalCoins = 0;
      this.totalRuns = 0;
      this.graphicsQuality = 'high';
    }
    this.updateMenuRecords();
  }

  /**
   * Writes all persistent records to LocalStorage.
   * Called once per run, after computing final stats.
   */
  savePersistentProgress() {
    try {
      localStorage.setItem('snowman_best_dist',   this.bestDistance.toString());
      localStorage.setItem('snowman_best_score',  this.bestScore.toString());
      localStorage.setItem('snowman_total_coins', this.totalCoins.toString());
      localStorage.setItem('snowman_total_runs',  this.totalRuns.toString());
      localStorage.setItem('snowman_quality',     this.graphicsQuality);
    } catch {
      // localStorage unavailable (private browsing, quota exceeded, etc.)
    }
  }

  /**
   * Saves the graphics quality preference.
   * @param {'low'|'medium'|'high'} quality
   */
  saveGraphicsQuality(quality) {
    this.graphicsQuality = quality;
    try {
      localStorage.setItem('snowman_quality', quality);
    } catch { /* ignore */ }
  }

  // ===========================================================================
  // MENU RECORDS
  // ===========================================================================

  /**
   * Refreshes the Main Menu record pills with the latest saved values.
   */
  updateMenuRecords() {
    if (this.menuBestDistance)    this.menuBestDistance.textContent   = `${this.bestDistance.toLocaleString()} m`;
    if (this.menuBestScore)       this.menuBestScore.textContent      = `${this.bestScore.toLocaleString()} pts`;
    if (this.menuTotalCoins)      this.menuTotalCoins.textContent     = `🪙 ${this.totalCoins.toLocaleString()}`;
    if (this.menuTotalRuns)       this.menuTotalRuns.textContent      = `${this.totalRuns.toLocaleString()}`;
    if (this.menuLongestDistance) this.menuLongestDistance.textContent = `${this.bestDistance.toLocaleString()} m`;
  }

  // ===========================================================================
  // HUD HELPERS
  // ===========================================================================

  /**
   * Trigger pulse visual animation on coin card when collecting coins.
   */
  pulseCoinCard() {
    if (!this.coinCard) return;
    this.coinCard.classList.remove('pulse');
    void this.coinCard.offsetWidth; // Force reflow
    this.coinCard.classList.add('pulse');
  }

  /**
   * Shows an animated floating toast message in the HUD.
   */
  showToast(text) {
    if (!this.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'hud-toast';
    toast.textContent = text;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 1800);
  }

  /**
   * Shows an animated aerial trick banner with points reward.
   */
  showTrickBanner(trickName, points) {
    if (!this.toastContainer) return;
    const banner = document.createElement('div');
    banner.className = 'hud-trick-toast';
    banner.innerHTML = `<span>✨ ${trickName}</span> <span class="trick-points-badge">+${points.toLocaleString()} PTS</span>`;
    this.toastContainer.appendChild(banner);

    setTimeout(() => {
      if (banner.parentNode) banner.parentNode.removeChild(banner);
    }, 2200);
  }

  /**
   * Updates HUD telemetry during active gameplay.
   */
  updateHUD(distance, score, speedKmH, isTucking, coins = 0) {
    if (this.hudDistance) this.hudDistance.textContent = Math.floor(distance).toLocaleString();
    if (this.hudScore)    this.hudScore.textContent    = Math.floor(score).toLocaleString();
    if (this.hudCoins)    this.hudCoins.textContent    = coins.toLocaleString();
    if (this.hudSpeed)    this.hudSpeed.textContent    = speedKmH;

    if (this.speedBarFill) {
      const pct = Math.min((speedKmH / 105) * 100, 100);
      this.speedBarFill.style.width = `${pct}%`;
    }

    if (this.tuckBadge) {
      if (isTucking && speedKmH > 25) {
        this.tuckBadge.classList.remove('hidden');
      } else {
        this.tuckBadge.classList.add('hidden');
      }
    }
  }

  /**
   * Updates Nitro Boost HUD meter and timer.
   */
  updateNitro(isNitro, timeLeft, maxDuration = 4.0) {
    if (!this.nitroCard) return;
    if (isNitro && timeLeft > 0) {
      this.nitroCard.classList.remove('hidden');
      if (this.nitroTimer) this.nitroTimer.textContent = `${timeLeft.toFixed(1)}s`;
      if (this.nitroBarFill) {
        const pct = Math.min(100, Math.max(0, (timeLeft / maxDuration) * 100));
        this.nitroBarFill.style.width = `${pct}%`;
      }
    } else {
      this.nitroCard.classList.add('hidden');
    }
  }

  /**
   * Updates Respawn Shield badge.
   */
  updateShield(isInvulnerable) {
    if (!this.shieldBadge) return;
    if (isInvulnerable) {
      this.shieldBadge.classList.remove('hidden');
    } else {
      this.shieldBadge.classList.add('hidden');
    }
  }

  /**
   * Toggles visibility of Checkpoint Respawn buttons on Pause & Game Over screens.
   */
  setCheckpointAvailable(available) {
    if (this.btnRestartCheckpoint) {
      if (available) {
        this.btnRestartCheckpoint.classList.remove('hidden');
      } else {
        this.btnRestartCheckpoint.classList.add('hidden');
      }
    }
    if (this.btnCheckpointRespawn) {
      if (available) {
        this.btnCheckpointRespawn.classList.remove('hidden');
      } else {
        this.btnCheckpointRespawn.classList.add('hidden');
      }
    }
  }

  /**
   * Updates real-time in-air trick telemetry (airtime, active spin, grab).
   */
  updateAirTrickHUD(isGrounded, airTime, spinDeg, isGrabbing, grabType) {
    if (!this.trickMeter) return;
    if (!isGrounded && airTime > 0.12) {
      this.trickMeter.classList.remove('hidden');
      if (this.trickAirStatus) this.trickAirStatus.textContent = `AIR ${airTime.toFixed(1)}s`;
      if (this.trickSpinTag) {
        if (spinDeg >= 90) {
          this.trickSpinTag.classList.remove('hidden');
          this.trickSpinTag.textContent = `${Math.floor(spinDeg)}°`;
        } else {
          this.trickSpinTag.classList.add('hidden');
        }
      }
      if (this.trickGrabTag) {
        if (isGrabbing) {
          this.trickGrabTag.classList.remove('hidden');
          this.trickGrabTag.textContent = grabType || 'METHOD';
        } else {
          this.trickGrabTag.classList.add('hidden');
        }
      }
    } else {
      this.trickMeter.classList.add('hidden');
    }
  }

  // ===========================================================================
  // SCREEN TRANSITIONS
  // ===========================================================================

  /**
   * Screen transition: Show Main Menu.
   */
  showMenu() {
    this.menuOverlay.classList.remove('hidden');
    this.hud.classList.add('hidden');
    this.pauseOverlay.classList.add('hidden');
    this.gameoverOverlay.classList.add('hidden');
    this.howToPlayModal.classList.add('hidden');
    this.updateNitro(false, 0);
    this.updateShield(false);
    this.setCheckpointAvailable(false);
    this.updateMenuRecords();
  }

  /**
   * Screen transition: Start / Resume Active Playing.
   * Also resets the per-run reward guard so the next crash credits rewards once.
   */
  showPlaying() {
    this.menuOverlay.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.pauseOverlay.classList.add('hidden');
    this.gameoverOverlay.classList.add('hidden');
    this.howToPlayModal.classList.add('hidden');
    // Reset duplicate-reward guard for the new / resumed run
    this._rewardApplied = false;
  }

  /**
   * Screen transition: Show Pause Overlay.
   */
  showPause(distance, score, coins = 0, hasCheckpoint = false) {
    this.pauseOverlay.classList.remove('hidden');
    this.hud.classList.remove('hidden');
    if (this.pauseDistance) this.pauseDistance.textContent = `${Math.floor(distance).toLocaleString()} m`;
    if (this.pauseScore)    this.pauseScore.textContent    = `${Math.floor(score).toLocaleString()} pts`;
    if (this.pauseCoins)    this.pauseCoins.textContent    = `🪙 ${coins.toLocaleString()}`;
    if (this.btnRestartCheckpoint) {
      if (hasCheckpoint) {
        this.btnRestartCheckpoint.classList.remove('hidden');
      } else {
        this.btnRestartCheckpoint.classList.add('hidden');
      }
    }
  }

  /**
   * Screen transition: Hide Pause Overlay.
   */
  hidePause() {
    this.pauseOverlay.classList.add('hidden');
  }

  // ===========================================================================
  // GAME OVER / RESULTS SCREEN  (Phase 5 Core Feature)
  // ===========================================================================

  /**
   * Displays the full run-results screen after a crash.
   *
   * Phase 5 behaviour:
   *  1. Calculate final statistics for the run.
   *  2. Compare new score against stored high score.
   *  3. Update high score ONLY if the new score is strictly higher.
   *  4. Add current-run coins to the all-time bank EXACTLY ONCE per run
   *     (guarded by `_rewardApplied`).
   *  5. Increment total run count exactly once.
   *  6. Display NEW HIGH SCORE badge if a score record is set.
   *  7. Display NEW RECORD badge if a distance record is set (separate).
   *  8. Persist all updated values to LocalStorage.
   *
   * @param {object} stats
   *   @param {number} stats.distance        — metres travelled this run
   *   @param {number} stats.score           — raw score this run
   *   @param {number} stats.coins           — coins collected this run
   *   @param {number} stats.maxSpeed        — peak speed (km/h)
   *   @param {number} stats.airtime         — total air time (seconds)
   *   @param {string} stats.cause           — crash cause description
   *   @param {boolean} stats.hasCheckpoint  — whether a checkpoint was reached
   *   @param {number} stats.checkpoints     — number of checkpoints passed
   *   @param {number} stats.tricks          — number of tricks landed cleanly
   */
  showGameOver(stats) {
    this.gameoverOverlay.classList.remove('hidden');
    this.hud.classList.add('hidden');

    // ── 1. Extract & format stats ────────────────────────────────────────────
    const dist      = Math.floor(stats.distance || 0);
    const score     = Math.floor(stats.score || 0);
    const coins     = Math.floor(stats.coins || 0);
    const maxSpeed  = Math.floor(stats.maxSpeed || 0);
    const airtime   = typeof stats.airtime === 'number' ? stats.airtime.toFixed(1) : '0.0';
    const checkpoints = stats.checkpoints || 0;
    const tricks    = stats.tricks || 0;
    const cause     = stats.cause ? `Wiped out by a ${stats.cause}` : 'Crashed into an obstacle';

    // ── 2. Populate result boxes ─────────────────────────────────────────────
    if (this.goDistance)  this.goDistance.textContent  = dist.toLocaleString();
    if (this.goScore)     this.goScore.textContent     = score.toLocaleString();
    if (this.goCoins)     this.goCoins.textContent     = coins.toLocaleString();
    if (this.goSpeed)     this.goSpeed.textContent     = maxSpeed;
    if (this.goAirtime)   this.goAirtime.textContent   = airtime;
    if (this.goCheckpoints) this.goCheckpoints.textContent = checkpoints;
    if (this.goTricks)    this.goTricks.textContent    = tricks;
    if (this.gameoverCause) this.gameoverCause.textContent = cause;

    // Checkpoint respawn button
    if (this.btnCheckpointRespawn) {
      if (stats.hasCheckpoint) {
        this.btnCheckpointRespawn.classList.remove('hidden');
      } else {
        this.btnCheckpointRespawn.classList.add('hidden');
      }
    }

    // ── 3 & 4. Apply rewards exactly once per run ────────────────────────────
    let isNewScoreRecord    = false;
    let isNewDistanceRecord = false;

    if (!this._rewardApplied) {
      this._rewardApplied = true; // ← guard set FIRST to prevent re-entry

      // Add coins to permanent bank (only once)
      this.totalCoins += coins;

      // Increment total runs counter
      this.totalRuns += 1;

      // Compare distance — update longest distance record if beaten
      if (dist > this.bestDistance) {
        this.bestDistance    = dist;
        isNewDistanceRecord  = true;
      }

      // Compare score — update high score ONLY if strictly higher
      if (score > this.bestScore) {
        this.bestScore     = score;
        isNewScoreRecord   = true;
      }

      // Persist everything to LocalStorage
      this.savePersistentProgress();
    } else {
      // If rewards were already applied (e.g. screen re-displayed),
      // re-derive record flags from saved state without modifying anything.
      isNewScoreRecord    = (score >= this.bestScore && score > 0);
      isNewDistanceRecord = (dist  >= this.bestDistance && dist  > 0);
    }

    // ── 5. Update result summary displays ───────────────────────────────────
    if (this.goTotalCoins) this.goTotalCoins.textContent = `🪙 ${this.totalCoins.toLocaleString()}`;
    if (this.goHighScore)  this.goHighScore.textContent  = this.bestScore.toLocaleString();
    if (this.goTotalRuns)  this.goTotalRuns.textContent  = this.totalRuns.toLocaleString();

    // ── 6. Show "NEW HIGH SCORE" badge (score record) ────────────────────────
    if (this.newHighScoreBadge) {
      if (isNewScoreRecord) {
        this.newHighScoreBadge.classList.remove('hidden');
      } else {
        this.newHighScoreBadge.classList.add('hidden');
      }
    }

    // ── 7. Show "NEW PERSONAL RECORD" badge (distance record) ────────────────
    if (this.newRecordBadge) {
      if (isNewDistanceRecord && !isNewScoreRecord) {
        // Only show distance record if NOT already showing score badge
        this.newRecordBadge.classList.remove('hidden');
      } else {
        this.newRecordBadge.classList.add('hidden');
      }
    }

    // Refresh menu records in the background so they are current next time
    this.updateMenuRecords();
  }

  // ===========================================================================
  // MODALS
  // ===========================================================================

  /** Modal: Show How To Play */
  showHowToPlay() {
    this.howToPlayModal.classList.remove('hidden');
  }

  /** Modal: Hide How To Play */
  hideHowToPlay() {
    this.howToPlayModal.classList.add('hidden');
  }

  // ===========================================================================
  // AUDIO ICON
  // ===========================================================================

  /**
   * Updates audio icon display (sound on / sound off).
   */
  updateAudioIcon(isMuted) {
    if (this.iconSoundOn && this.iconSoundOff) {
      if (isMuted) {
        this.iconSoundOn.classList.add('hidden');
        this.iconSoundOff.classList.remove('hidden');
      } else {
        this.iconSoundOn.classList.remove('hidden');
        this.iconSoundOff.classList.add('hidden');
      }
    }
  }
}
