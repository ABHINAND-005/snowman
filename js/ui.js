/**
 * UI Manager for SNOWMAN
 * Controls Heads-Up Display (HUD), Main Menu, How To Play Modal, Pause Overlay,
 * Game Over Screen, High Score persistence, and notification toasts.
 */

export class UIManager {
  constructor(soundEngine) {
    this.sound = soundEngine;

    // Cache DOM Elements
    this.hud = document.getElementById('hud');
    this.hudDistance = document.getElementById('hud-distance');
    this.hudScore = document.getElementById('hud-score');
    this.hudSpeed = document.getElementById('hud-speed');
    this.speedBarFill = document.getElementById('speed-bar-fill');
    this.tuckBadge = document.getElementById('hud-tuck-badge');
    this.toastContainer = document.getElementById('hud-toast-container');

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

    // Pause elements
    this.pauseDistance = document.getElementById('pause-distance');
    this.pauseScore = document.getElementById('pause-score');

    // Game Over elements
    this.goDistance = document.getElementById('go-distance');
    this.goScore = document.getElementById('go-score');
    this.goSpeed = document.getElementById('go-speed');
    this.goAirtime = document.getElementById('go-airtime');
    this.newRecordBadge = document.getElementById('new-record-badge');

    // Load High Scores from LocalStorage
    this.bestDistance = 0;
    this.bestScore = 0;
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
  }

  /**
   * Loads persistent records from LocalStorage
   */
  loadHighScores() {
    try {
      this.bestDistance = parseInt(localStorage.getItem('snowman_best_dist') || '0', 10);
      this.bestScore = parseInt(localStorage.getItem('snowman_best_score') || '0', 10);
    } catch {
      this.bestDistance = 0;
      this.bestScore = 0;
    }
    this.updateMenuRecords();
  }

  /**
   * Updates Main Menu record pills
   */
  updateMenuRecords() {
    if (this.menuBestDistance) this.menuBestDistance.textContent = `${this.bestDistance.toLocaleString()} m`;
    if (this.menuBestScore) this.menuBestScore.textContent = `${this.bestScore.toLocaleString()} pts`;
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
   * Updates HUD telemetry during active gameplay
   */
  updateHUD(distance, score, speedKmH, isTucking) {
    if (this.hudDistance) this.hudDistance.textContent = Math.floor(distance).toLocaleString();
    if (this.hudScore) this.hudScore.textContent = Math.floor(score).toLocaleString();
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
   * Screen transition: Show Main Menu
   */
  showMenu() {
    this.menuOverlay.classList.remove('hidden');
    this.hud.classList.add('hidden');
    this.pauseOverlay.classList.add('hidden');
    this.gameoverOverlay.classList.add('hidden');
    this.howToPlayModal.classList.add('hidden');
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
  showPause(distance, score) {
    this.pauseOverlay.classList.remove('hidden');
    this.hud.classList.remove('hidden');
    if (this.pauseDistance) this.pauseDistance.textContent = `${Math.floor(distance).toLocaleString()} m`;
    if (this.pauseScore) this.pauseScore.textContent = `${Math.floor(score).toLocaleString()} pts`;
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
    const maxSpeed = stats.maxSpeed;
    const airtime = stats.airtime.toFixed(1);

    if (this.goDistance) this.goDistance.textContent = dist.toLocaleString();
    if (this.goScore) this.goScore.textContent = score.toLocaleString();
    if (this.goSpeed) this.goSpeed.textContent = maxSpeed;
    if (this.goAirtime) this.goAirtime.textContent = airtime;

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

    if (isNewRecord) {
      try {
        localStorage.setItem('snowman_best_dist', this.bestDistance.toString());
        localStorage.setItem('snowman_best_score', this.bestScore.toString());
      } catch {
        // storage disabled
      }
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
