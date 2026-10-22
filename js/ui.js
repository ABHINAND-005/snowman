/**
 * UI Manager for SNOWMAN
 * Controls Heads-Up Display (HUD), Main Menu, How To Play Modal, Pause Overlay,
 * Game Over Screen, High Score & Coin Bank persistence, and notification toasts.
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
    this.newRecordBadge = document.getElementById('new-record-badge');
    this.gameoverCause = document.getElementById('gameover-cause');

    // Load High Scores & Coin Bank from LocalStorage
    this.bestDistance = 0;
    this.bestScore = 0;
    this.totalCoins = 0;
    this.loadHighScores();

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

  /**
   * Loads persistent records and coin bank from LocalStorage
   */
  loadHighScores() {
    try {
      this.bestDistance = parseInt(localStorage.getItem('snowman_best_dist') || '0', 10);
      this.bestScore = parseInt(localStorage.getItem('snowman_best_score') || '0', 10);
      this.totalCoins = parseInt(localStorage.getItem('snowman_total_coins') || '0', 10);
    } catch {
      this.bestDistance = 0;
      this.bestScore = 0;
      this.totalCoins = 0;
    }
    this.updateMenuRecords();
  }

  /**
   * Updates Main Menu record pills
   */
  updateMenuRecords() {
    if (this.menuBestDistance) this.menuBestDistance.textContent = `${this.bestDistance.toLocaleString()} m`;
    if (this.menuBestScore) this.menuBestScore.textContent = `${this.bestScore.toLocaleString()} pts`;
    if (this.menuTotalCoins) this.menuTotalCoins.textContent = `🪙 ${this.totalCoins.toLocaleString()}`;
  }

  /**
   * Trigger pulse visual animation on coin card when collecting coins
   */
  pulseCoinCard() {
    if (!this.coinCard) return;
    this.coinCard.classList.remove('pulse');
    // Force reflow
    void this.coinCard.offsetWidth;
    this.coinCard.classList.add('pulse');
  }

  /**
   * Shows an animated floating toast message in the HUD
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
   * Shows an animated aerial trick banner with points reward
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
   * Updates HUD telemetry during active gameplay
   */
  updateHUD(distance, score, speedKmH, isTucking, coins = 0) {
    if (this.hudDistance) this.hudDistance.textContent = Math.floor(distance).toLocaleString();
    if (this.hudScore) this.hudScore.textContent = Math.floor(score).toLocaleString();
    if (this.hudCoins) this.hudCoins.textContent = coins.toLocaleString();
    if (this.hudSpeed) this.hudSpeed.textContent = speedKmH;

    // Speed bar fill (0 to 110 km/h)
    if (this.speedBarFill) {
      const pct = Math.min((speedKmH / 105) * 100, 100);
      this.speedBarFill.style.width = `${pct}%`;
    }

    // Aerodynamic tuck badge
    if (this.tuckBadge) {
      if (isTucking && speedKmH > 25) {
        this.tuckBadge.classList.remove('hidden');
      } else {
        this.tuckBadge.classList.add('hidden');
      }
    }
  }

  /**
   * Updates Nitro Boost HUD meter and timer
   */
  updateNitro(isNitro, timeLeft, maxDuration = 4.0) {
    if (!this.nitroCard) return;
    if (isNitro && timeLeft > 0) {
      this.nitroCard.classList.remove('hidden');
      if (this.nitroTimer) {
        this.nitroTimer.textContent = `${timeLeft.toFixed(1)}s`;
      }
      if (this.nitroBarFill) {
        const pct = Math.min(100, Math.max(0, (timeLeft / maxDuration) * 100));
        this.nitroBarFill.style.width = `${pct}%`;
      }
    } else {
      this.nitroCard.classList.add('hidden');
    }
  }

  /**
   * Updates Respawn Shield badge
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
   * Toggles visibility of Checkpoint Respawn buttons on Pause & Game Over screens
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
   * Updates real-time in-air trick telemetry (airtime, active spin, grab)
   */
  updateAirTrickHUD(isGrounded, airTime, spinDeg, isGrabbing, grabType) {
    if (!this.trickMeter) return;
    if (!isGrounded && airTime > 0.12) {
      this.trickMeter.classList.remove('hidden');
      if (this.trickAirStatus) {
        this.trickAirStatus.textContent = `AIR ${airTime.toFixed(1)}s`;
      }
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

  /**
   * Screen transition: Show Main Menu
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
   * Screen transition: Start / Resume Active Playing
   */
  showPlaying() {
    this.menuOverlay.classList.add('hidden');
    this.hud.classList.remove('hidden');
    this.pauseOverlay.classList.add('hidden');
    this.gameoverOverlay.classList.add('hidden');
    this.howToPlayModal.classList.add('hidden');
  }

  /**
   * Screen transition: Show Pause Overlay
   */
  showPause(distance, score, coins = 0, hasCheckpoint = false) {
    this.pauseOverlay.classList.remove('hidden');
    this.hud.classList.remove('hidden');
    if (this.pauseDistance) this.pauseDistance.textContent = `${Math.floor(distance).toLocaleString()} m`;
    if (this.pauseScore) this.pauseScore.textContent = `${Math.floor(score).toLocaleString()} pts`;
    if (this.pauseCoins) this.pauseCoins.textContent = `🪙 ${coins.toLocaleString()}`;
    if (this.btnRestartCheckpoint) {
      if (hasCheckpoint) {
        this.btnRestartCheckpoint.classList.remove('hidden');
      } else {
        this.btnRestartCheckpoint.classList.add('hidden');
      }
    }
  }

  /**
   * Screen transition: Hide Pause Overlay
   */
  hidePause() {
    this.pauseOverlay.classList.add('hidden');
  }

  /**
   * Screen transition: Show Game Over Screen
   */
  showGameOver(stats) {
    this.gameoverOverlay.classList.remove('hidden');
    this.hud.classList.add('hidden');

    const dist = Math.floor(stats.distance);
    const score = Math.floor(stats.score);
    const coins = stats.coins || 0;
    const maxSpeed = stats.maxSpeed;
    const airtime = stats.airtime.toFixed(1);
    const cause = stats.cause ? `Wiped out by a ${stats.cause}` : 'Crashed into an obstacle';

    if (this.goDistance) this.goDistance.textContent = dist.toLocaleString();
    if (this.goScore) this.goScore.textContent = score.toLocaleString();
    if (this.goCoins) this.goCoins.textContent = coins.toLocaleString();
    if (this.goSpeed) this.goSpeed.textContent = maxSpeed;
    if (this.goAirtime) this.goAirtime.textContent = airtime;
    if (this.gameoverCause) this.gameoverCause.textContent = cause;

    if (this.btnCheckpointRespawn) {
      if (stats.hasCheckpoint) {
        this.btnCheckpointRespawn.classList.remove('hidden');
      } else {
        this.btnCheckpointRespawn.classList.add('hidden');
      }
    }

    // Add collected coins to total bank
    this.totalCoins += coins;
    if (this.goTotalCoins) this.goTotalCoins.textContent = `🪙 ${this.totalCoins.toLocaleString()}`;

    // Check if new personal record
    let isNewRecord = false;
    if (dist > this.bestDistance) {
      this.bestDistance = dist;
      isNewRecord = true;
    }
    if (score > this.bestScore) {
      this.bestScore = score;
      isNewRecord = true;
    }

    try {
      if (isNewRecord) {
        localStorage.setItem('snowman_best_dist', this.bestDistance.toString());
        localStorage.setItem('snowman_best_score', this.bestScore.toString());
      }
      localStorage.setItem('snowman_total_coins', this.totalCoins.toString());
    } catch {
      // storage disabled
    }

    if (isNewRecord) {
      this.newRecordBadge.classList.remove('hidden');
    } else {
      this.newRecordBadge.classList.add('hidden');
    }
  }

  /**
   * Modal: Show How To Play
   */
  showHowToPlay() {
    this.howToPlayModal.classList.remove('hidden');
  }

  /**
   * Modal: Hide How To Play
   */
  hideHowToPlay() {
    this.howToPlayModal.classList.add('hidden');
  }

  /**
   * Updates audio icon display (sound on / sound off)
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
