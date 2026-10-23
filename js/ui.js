/**
 * UI Manager for SNOWMAN
 * Controls HUD, all screen overlays, persistent progress, settings, and
 * Phase 6 additions: countdown display, mobile controls visibility,
 * Settings modal with sound/graphics controls, high score celebration audio,
 * in-HUD best score + total coins + checkpoint badge.
 */

export class UIManager {
  constructor(soundEngine) {
    this.sound = soundEngine;

    // ── HUD core elements ──────────────────────────────────────────────────────
    this.hud              = document.getElementById('hud');
    this.hudDistance      = document.getElementById('hud-distance');
    this.hudScore         = document.getElementById('hud-score');
    this.hudCoins         = document.getElementById('hud-coins');
    this.hudSpeed         = document.getElementById('hud-speed');
    this.speedBarFill     = document.getElementById('speed-bar-fill');
    this.tuckBadge        = document.getElementById('hud-tuck-badge');
    this.toastContainer   = document.getElementById('hud-toast-container');
    this.coinCard         = document.querySelector('.coin-card');

    // Phase 6: HUD high-score + total coins sub-displays + checkpoint badge
    this.hudBestScore          = document.getElementById('hud-best-score');
    this.hudTotalCoinsDisplay  = document.getElementById('hud-total-coins-display');
    this.hudCheckpointBadge    = document.getElementById('hud-checkpoint-badge');

    // ── Nitro & Shield ────────────────────────────────────────────────────────
    this.nitroCard   = document.getElementById('hud-nitro-card');
    this.nitroTimer  = document.getElementById('hud-nitro-timer');
    this.nitroBarFill = document.getElementById('nitro-bar-fill');
    this.shieldBadge  = document.getElementById('hud-shield-badge');

    // ── Aerial Trick Meter ────────────────────────────────────────────────────
    this.trickMeter    = document.getElementById('hud-trick-meter');
    this.trickAirStatus = document.getElementById('hud-trick-status');
    this.trickSpinTag  = document.getElementById('hud-trick-spin');
    this.trickGrabTag  = document.getElementById('hud-trick-grab');

    // ── Checkpoint respawn buttons ────────────────────────────────────────────
    this.btnRestartCheckpoint = document.getElementById('btn-restart-checkpoint');
    this.btnCheckpointRespawn = document.getElementById('btn-checkpoint-respawn');

    // ── Audio & pause HUD buttons ─────────────────────────────────────────────
    this.iconSoundOn  = document.getElementById('icon-sound-on');
    this.iconSoundOff = document.getElementById('icon-sound-off');

    // ── Screens ───────────────────────────────────────────────────────────────
    this.menuOverlay     = document.getElementById('menu-overlay');
    this.pauseOverlay    = document.getElementById('pause-overlay');
    this.gameoverOverlay = document.getElementById('gameover-overlay');
    this.howToPlayModal  = document.getElementById('how-to-play-modal');
    this.settingsModal   = document.getElementById('settings-modal');   // Phase 6

    // ── Phase 6: Countdown overlay ────────────────────────────────────────────
    this.countdownOverlay = document.getElementById('countdown-overlay');
    this.countdownNumber  = document.getElementById('countdown-number');

    // ── Phase 6: Mobile controls overlay ─────────────────────────────────────
    this.mobileControls = document.getElementById('mobile-controls');
    this.isMobile = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || window.innerWidth <= 768;

    // ── Menu records ──────────────────────────────────────────────────────────
    this.menuBestDistance    = document.getElementById('menu-best-distance');
    this.menuBestScore       = document.getElementById('menu-best-score');
    this.menuTotalCoins      = document.getElementById('menu-total-coins');
    this.menuTotalRuns       = document.getElementById('menu-total-runs');
    this.menuLongestDistance = document.getElementById('menu-longest-distance');

    // ── Pause elements ────────────────────────────────────────────────────────
    this.pauseDistance = document.getElementById('pause-distance');
    this.pauseScore    = document.getElementById('pause-score');
    this.pauseCoins    = document.getElementById('pause-coins');

    // ── Game Over elements ────────────────────────────────────────────────────
    this.goDistance       = document.getElementById('go-distance');
    this.goScore          = document.getElementById('go-score');
    this.goCoins          = document.getElementById('go-coins');
    this.goSpeed          = document.getElementById('go-speed');
    this.goAirtime        = document.getElementById('go-airtime');
    this.goTotalCoins     = document.getElementById('go-total-coins');
    this.goHighScore      = document.getElementById('go-high-score');
    this.goCheckpoints    = document.getElementById('go-checkpoints');
    this.goTricks         = document.getElementById('go-tricks');
    this.goTotalRuns      = document.getElementById('go-total-runs');
    this.newRecordBadge   = document.getElementById('new-record-badge');
    this.newHighScoreBadge = document.getElementById('new-high-score-badge');
    this.gameoverCause    = document.getElementById('gameover-cause');

    // ── Persistent Progress ───────────────────────────────────────────────────
    // LocalStorage keys:
    //   snowman_best_dist    — longest distance (m)
    //   snowman_best_score   — highest run score (pts)
    //   snowman_total_coins  — all-time coin bank
    //   snowman_total_runs   — total completed runs
    //   snowman_muted        — audio mute preference
    //   snowman_quality      — graphics quality: 'low' | 'medium' | 'high'

    this.bestDistance    = 0;
    this.bestScore       = 0;
    this.totalCoins      = 0;
    this.totalRuns       = 0;
    this.graphicsQuality = 'high';

    // Guard: prevents coins / run-count being credited more than once per run
    this._rewardApplied = false;

    // Load saved values
    this.loadPersistentProgress();

    // Initialise audio icon to saved mute state
    this.updateAudioIcon(this.sound.isMuted);

    // Settings modal handlers (Phase 6)
    this.initSettingsHandlers();

    // ── Custom in-game event listeners ────────────────────────────────────────
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
  // PERSISTENT PROGRESS
  // ===========================================================================

  loadPersistentProgress() {
    try {
      this.bestDistance    = parseInt(localStorage.getItem('snowman_best_dist')   || '0', 10) || 0;
      this.bestScore       = parseInt(localStorage.getItem('snowman_best_score')  || '0', 10) || 0;
      this.totalCoins      = parseInt(localStorage.getItem('snowman_total_coins') || '0', 10) || 0;
      this.totalRuns       = parseInt(localStorage.getItem('snowman_total_runs')  || '0', 10) || 0;
      this.graphicsQuality = localStorage.getItem('snowman_quality') || 'high';
    } catch {
      this.bestDistance = 0; this.bestScore = 0;
      this.totalCoins = 0;   this.totalRuns = 0;
      this.graphicsQuality = 'high';
    }
    this.updateMenuRecords();
  }

  savePersistentProgress() {
    try {
      localStorage.setItem('snowman_best_dist',   this.bestDistance.toString());
      localStorage.setItem('snowman_best_score',  this.bestScore.toString());
      localStorage.setItem('snowman_total_coins', this.totalCoins.toString());
      localStorage.setItem('snowman_total_runs',  this.totalRuns.toString());
      localStorage.setItem('snowman_quality',     this.graphicsQuality);
    } catch { /* quota / private browsing */ }
  }

  saveGraphicsQuality(quality) {
    this.graphicsQuality = quality;
    try { localStorage.setItem('snowman_quality', quality); } catch { /* ignore */ }
  }

  // ===========================================================================
  // MENU RECORDS
  // ===========================================================================

  updateMenuRecords() {
    if (this.menuBestDistance)    this.menuBestDistance.textContent    = `${this.bestDistance.toLocaleString()} m`;
    if (this.menuBestScore)       this.menuBestScore.textContent       = `${this.bestScore.toLocaleString()} pts`;
    if (this.menuTotalCoins)      this.menuTotalCoins.textContent      = `🪙 ${this.totalCoins.toLocaleString()}`;
    if (this.menuTotalRuns)       this.menuTotalRuns.textContent       = `${this.totalRuns.toLocaleString()}`;
    if (this.menuLongestDistance) this.menuLongestDistance.textContent = `${this.bestDistance.toLocaleString()} m`;
  }

  // ===========================================================================
  // HUD HELPERS
  // ===========================================================================

  pulseCoinCard() {
    if (!this.coinCard) return;
    this.coinCard.classList.remove('pulse');
    void this.coinCard.offsetWidth;
    this.coinCard.classList.add('pulse');
  }

  showToast(text) {
    if (!this.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = 'hud-toast';
    toast.textContent = text;
    this.toastContainer.appendChild(toast);
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 1800);
  }

  showTrickBanner(trickName, points) {
    if (!this.toastContainer) return;
    const banner = document.createElement('div');
    banner.className = 'hud-trick-toast';
    banner.innerHTML = `<span>✨ ${trickName}</span> <span class="trick-points-badge">+${points.toLocaleString()} PTS</span>`;
    this.toastContainer.appendChild(banner);
    setTimeout(() => { if (banner.parentNode) banner.parentNode.removeChild(banner); }, 2200);
  }

  /**
   * Updates all HUD telemetry during active gameplay.
   * Phase 6: Also updates best-score sub-line and total-coins sub-line.
   */
  updateHUD(distance, score, speedKmH, isTucking, coins = 0) {
    if (this.hudDistance) this.hudDistance.textContent = Math.floor(distance).toLocaleString();
    if (this.hudScore)    this.hudScore.textContent    = Math.floor(score).toLocaleString();
    if (this.hudCoins)    this.hudCoins.textContent    = coins.toLocaleString();
    if (this.hudSpeed)    this.hudSpeed.textContent    = speedKmH;

    // Phase 6: sub-displays
    if (this.hudBestScore)         this.hudBestScore.textContent        = this.bestScore.toLocaleString();
    if (this.hudTotalCoinsDisplay) this.hudTotalCoinsDisplay.textContent = this.totalCoins.toLocaleString();

    if (this.speedBarFill) {
      const pct = Math.min((speedKmH / 105) * 100, 100);
      this.speedBarFill.style.width = `${pct}%`;
    }

    if (this.tuckBadge) {
      this.tuckBadge.classList.toggle('hidden', !(isTucking && speedKmH > 25));
    }
  }

  updateNitro(isNitro, timeLeft, maxDuration = 4.0) {
    if (!this.nitroCard) return;
    if (isNitro && timeLeft > 0) {
      this.nitroCard.classList.remove('hidden');
      if (this.nitroTimer)  this.nitroTimer.textContent = `${timeLeft.toFixed(1)}s`;
      if (this.nitroBarFill) {
        const pct = Math.min(100, Math.max(0, (timeLeft / maxDuration) * 100));
        this.nitroBarFill.style.width = `${pct}%`;
      }
    } else {
      this.nitroCard.classList.add('hidden');
    }
  }

  updateShield(isInvulnerable) {
    if (this.shieldBadge) this.shieldBadge.classList.toggle('hidden', !isInvulnerable);
  }

  /**
   * Phase 6: Toggles the in-HUD "🏁 CHECKPOINT" saved badge.
   */
  updateCheckpointStatus(active) {
    if (this.hudCheckpointBadge) this.hudCheckpointBadge.classList.toggle('hidden', !active);
  }

  setCheckpointAvailable(available) {
    if (this.btnRestartCheckpoint) this.btnRestartCheckpoint.classList.toggle('hidden', !available);
    if (this.btnCheckpointRespawn) this.btnCheckpointRespawn.classList.toggle('hidden', !available);
  }

  updateAirTrickHUD(isGrounded, airTime, spinDeg, isGrabbing, grabType) {
    if (!this.trickMeter) return;
    if (!isGrounded && airTime > 0.12) {
      this.trickMeter.classList.remove('hidden');
      if (this.trickAirStatus) this.trickAirStatus.textContent = `AIR ${airTime.toFixed(1)}s`;
      if (this.trickSpinTag) {
        const vis = spinDeg >= 90;
        this.trickSpinTag.classList.toggle('hidden', !vis);
        if (vis) this.trickSpinTag.textContent = `${Math.floor(spinDeg)}°`;
      }
      if (this.trickGrabTag) {
        this.trickGrabTag.classList.toggle('hidden', !isGrabbing);
        if (isGrabbing) this.trickGrabTag.textContent = grabType || 'METHOD';
      }
    } else {
      this.trickMeter.classList.add('hidden');
    }
  }

  // ===========================================================================
  // PHASE 6: COUNTDOWN OVERLAY
  // ===========================================================================

  /**
   * Shows a countdown number (3, 2, 1) or "GO!" (n === 0).
   * Re-triggers the pop animation on every call.
   */
  showCountdown(n) {
    if (!this.countdownOverlay) return;
    this.countdownOverlay.classList.remove('hidden');

    if (this.countdownNumber) {
      if (n === 0) {
        this.countdownNumber.textContent = 'GO!';
        this.countdownNumber.classList.add('go');
      } else {
        this.countdownNumber.textContent = n.toString();
        this.countdownNumber.classList.remove('go');
      }
      // Re-trigger CSS animation by clone trick
      const el = this.countdownNumber;
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = '';
    }
  }

  hideCountdown() {
    if (this.countdownOverlay) this.countdownOverlay.classList.add('hidden');
  }

  // ===========================================================================
  // PHASE 6: MOBILE CONTROLS SHOW / HIDE
  // ===========================================================================

  showMobileControls() {
    if (this.isMobile && this.mobileControls) {
      this.mobileControls.classList.remove('hidden');
    }
  }

  hideMobileControls() {
    if (this.mobileControls) this.mobileControls.classList.add('hidden');
  }

  // ===========================================================================
  // SCREEN TRANSITIONS
  // ===========================================================================

  showMenu() {
    if (this.menuOverlay)     this.menuOverlay.classList.remove('hidden');
    if (this.hud)             this.hud.classList.add('hidden');
    if (this.pauseOverlay)    this.pauseOverlay.classList.add('hidden');
    if (this.gameoverOverlay) this.gameoverOverlay.classList.add('hidden');
    if (this.howToPlayModal)  this.howToPlayModal.classList.add('hidden');
    if (this.settingsModal)   this.settingsModal.classList.add('hidden');
    this.hideCountdown();
    this.hideMobileControls();
    this.updateNitro(false, 0);
    this.updateShield(false);
    this.setCheckpointAvailable(false);
    this.updateCheckpointStatus(false);
    this.updateMenuRecords();
  }

  /** Called at the start of every new run (including after countdown). */
  showPlaying() {
    if (this.menuOverlay)     this.menuOverlay.classList.add('hidden');
    if (this.hud)             this.hud.classList.remove('hidden');
    if (this.pauseOverlay)    this.pauseOverlay.classList.add('hidden');
    if (this.gameoverOverlay) this.gameoverOverlay.classList.add('hidden');
    if (this.howToPlayModal)  this.howToPlayModal.classList.add('hidden');
    if (this.settingsModal)   this.settingsModal.classList.add('hidden');
    // Reset duplicate-reward guard for this new run
    this._rewardApplied = false;
    this.showMobileControls();
  }

  showPause(distance, score, coins = 0, hasCheckpoint = false) {
    if (this.pauseOverlay) this.pauseOverlay.classList.remove('hidden');
    if (this.pauseDistance) this.pauseDistance.textContent = `${Math.floor(distance).toLocaleString()} m`;
    if (this.pauseScore)    this.pauseScore.textContent    = `${Math.floor(score).toLocaleString()} pts`;
    if (this.pauseCoins)    this.pauseCoins.textContent    = `🪙 ${coins.toLocaleString()}`;
    if (this.btnRestartCheckpoint) this.btnRestartCheckpoint.classList.toggle('hidden', !hasCheckpoint);
  }

  hidePause() {
    if (this.pauseOverlay) this.pauseOverlay.classList.add('hidden');
    this.showMobileControls();
  }

  // ===========================================================================
  // GAME OVER / RESULTS SCREEN  (Phase 5 core, Phase 6 celebration audio)
  // ===========================================================================

  showGameOver(stats) {
    if (this.gameoverOverlay) this.gameoverOverlay.classList.remove('hidden');
    if (this.hud)             this.hud.classList.add('hidden');
    this.hideMobileControls();

    // ── Extract stats ────────────────────────────────────────────────────────
    const dist       = Math.floor(stats.distance  || 0);
    const score      = Math.floor(stats.score     || 0);
    const coins      = Math.floor(stats.coins     || 0);
    const maxSpeed   = Math.floor(stats.maxSpeed  || 0);
    const airtime    = typeof stats.airtime === 'number' ? stats.airtime.toFixed(1) : '0.0';
    const checkpoints = stats.checkpoints || 0;
    const tricks     = stats.tricks || 0;
    const cause      = stats.cause ? `Wiped out by a ${stats.cause}` : 'Crashed into an obstacle';

    // ── Populate result boxes ────────────────────────────────────────────────
    if (this.goDistance)    this.goDistance.textContent    = dist.toLocaleString();
    if (this.goScore)       this.goScore.textContent       = score.toLocaleString();
    if (this.goCoins)       this.goCoins.textContent       = coins.toLocaleString();
    if (this.goSpeed)       this.goSpeed.textContent       = maxSpeed;
    if (this.goAirtime)     this.goAirtime.textContent     = airtime;
    if (this.goCheckpoints) this.goCheckpoints.textContent = checkpoints;
    if (this.goTricks)      this.goTricks.textContent      = tricks;
    if (this.gameoverCause) this.gameoverCause.textContent = cause;

    // Checkpoint respawn button
    if (this.btnCheckpointRespawn) this.btnCheckpointRespawn.classList.toggle('hidden', !stats.hasCheckpoint);

    // ── Apply rewards ONCE per run ──────────────────────────────────────────
    let isNewScoreRecord    = false;
    let isNewDistanceRecord = false;

    if (!this._rewardApplied) {
      this._rewardApplied = true;

      this.totalCoins += coins;          // bank run coins exactly once
      this.totalRuns  += 1;              // count the run

      if (dist  > this.bestDistance) { this.bestDistance = dist;  isNewDistanceRecord = true; }
      if (score > this.bestScore)    { this.bestScore    = score; isNewScoreRecord    = true; }

      this.savePersistentProgress();

      // Phase 6: Celebration audio on new high score
      if (isNewScoreRecord) {
        // Small delay so wipeout sounds finish before fanfare
        setTimeout(() => this.sound.playHighScoreCelebration(), 600);
      }
    } else {
      isNewScoreRecord    = (score >= this.bestScore && score > 0);
      isNewDistanceRecord = (dist  >= this.bestDistance && dist  > 0);
    }

    // ── Update totals display ────────────────────────────────────────────────
    if (this.goTotalCoins) this.goTotalCoins.textContent = `🪙 ${this.totalCoins.toLocaleString()}`;
    if (this.goHighScore)  this.goHighScore.textContent  = this.bestScore.toLocaleString();
    if (this.goTotalRuns)  this.goTotalRuns.textContent  = this.totalRuns.toLocaleString();

    // ── Record badges ────────────────────────────────────────────────────────
    if (this.newHighScoreBadge) this.newHighScoreBadge.classList.toggle('hidden', !isNewScoreRecord);
    if (this.newRecordBadge)    this.newRecordBadge.classList.toggle('hidden', !(isNewDistanceRecord && !isNewScoreRecord));

    this.updateMenuRecords();
  }

  // ===========================================================================
  // PHASE 6: SETTINGS MODAL
  // ===========================================================================

  showSettings() {
    if (this.settingsModal) this.settingsModal.classList.remove('hidden');
    this.syncSettingsUI();
  }

  hideSettings() {
    if (this.settingsModal) this.settingsModal.classList.add('hidden');
  }

  /** Syncs all settings controls to the current state. */
  syncSettingsUI() {
    // Mute toggle button
    const muteBtn = document.getElementById('setting-mute-toggle');
    if (muteBtn) {
      const muted = this.sound.isMuted;
      muteBtn.textContent = muted ? 'OFF' : 'ON';
      muteBtn.classList.toggle('active',   !muted);
      muteBtn.classList.toggle('inactive',  muted);
      muteBtn.setAttribute('aria-pressed', String(muted));
    }

    // Quality buttons
    document.querySelectorAll('.setting-quality-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.quality === this.graphicsQuality);
    });
  }

  /** Wires all settings interactive elements. Called once in constructor. */
  initSettingsHandlers() {
    // ── Mute Toggle ──────────────────────────────────────────────────────────
    const muteBtn = document.getElementById('setting-mute-toggle');
    if (muteBtn) {
      muteBtn.addEventListener('click', () => {
        this.sound.init();
        const isMuted = this.sound.toggleMute();
        this.updateAudioIcon(isMuted);
        this.syncSettingsUI();
      });
    }

    // ── Graphics Quality ─────────────────────────────────────────────────────
    document.querySelectorAll('.setting-quality-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.sound.playClick && this.sound.playClick();
        this.saveGraphicsQuality(btn.dataset.quality);
        this.syncSettingsUI();
        // Notify game.js to apply quality to the renderer
        window.dispatchEvent(new CustomEvent('snowman_quality_change', {
          detail: { quality: btn.dataset.quality }
        }));
      });
    });

    // ── Close / Done buttons ─────────────────────────────────────────────────
    const closeBtn = document.getElementById('btn-close-settings');
    if (closeBtn) closeBtn.addEventListener('click', () => this.hideSettings());

    const doneBtn = document.getElementById('btn-settings-done');
    if (doneBtn) doneBtn.addEventListener('click', () => this.hideSettings());
  }

  // ===========================================================================
  // MODALS
  // ===========================================================================

  showHowToPlay() {
    if (this.howToPlayModal) this.howToPlayModal.classList.remove('hidden');
  }

  hideHowToPlay() {
    if (this.howToPlayModal) this.howToPlayModal.classList.add('hidden');
  }

  // ===========================================================================
  // AUDIO ICON
  // ===========================================================================

  updateAudioIcon(isMuted) {
    if (this.iconSoundOn && this.iconSoundOff) {
      this.iconSoundOn.classList.toggle('hidden',  isMuted);
      this.iconSoundOff.classList.toggle('hidden', !isMuted);
    }
  }
}
