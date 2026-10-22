# SNOWMAN — 3D Alpine Freeride Downhill

[![Three.js](https://img.shields.io/badge/Three.js-r160-00f0ff?logo=three.js)](https://threejs.org/)
[![Web Audio API](https://img.shields.io/badge/Audio-Web_Audio_API-ffd166)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![License: MIT](https://img.shields.io/badge/License-MIT-48cae4.svg)](LICENSE)
[![Phase](https://img.shields.io/badge/Status-Phase_5_Complete-00F0FF)](#development-roadmap)

An exhilarating 3D browser-based downhill snowboarding game built with **Three.js** and procedural **Web Audio API**. Carve down endless snowy peaks, dodge mountain obstacles, gather glowing gold coins, rocket through nitro boosts, catch massive air off natural snow kickers, and build a persistent run history tracked across sessions.

---

## Table of Contents

- [Screenshots](#screenshots)
- [Game Concept & Objectives](#game-concept--objectives)
- [Features Implemented](#features-implemented)
  - [Phase 1: Core Playable Engine](#phase-1-core-playable-engine)
  - [Phase 2: Obstacles & Collectible Coins](#phase-2-obstacles--collectible-coins)
  - [Phase 3: Checkpoints & Nitro Boosts](#phase-3-checkpoints--nitro-boosts)
  - [Phase 4: Rider Animations & Aerial Trick System](#phase-4-rider-animations--aerial-trick-system)
- [Controls](#controls)
- [Gameplay Mechanics](#gameplay-mechanics)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Prerequisites & Running Locally](#prerequisites--running-locally)
- [Testing Instructions](#testing-instructions)
- [Development Roadmap](#development-roadmap)
- [Known Limitations](#known-limitations)
- [License](#license)

---

## Screenshots

| Main Menu & Records | Downhill Freeride & Coins | Wipeout Summary Screen |
| :---: | :---: | :---: |
| ![Main Menu](assets/screenshots/menu.png) | ![Gameplay Run](assets/screenshots/gameplay.png) | ![Wipeout Screen](assets/screenshots/wipeout.png) |

---

## Game Concept & Objectives

In **SNOWMAN**, you control an alpine snowboarder descending down an endless procedural mountain run.
- **Survive**: Navigate between hazardous obstacles such as dense pine trees, jagged boulders, fallen logs, translucent ice monoliths, and snowmen.
- **Collect**: Carve through strings of rotating gold coins arranged in straight lines, rainbow kicker jump arcs, and rhythmic carving zig-zags.
- **Speed & Airtime**: Crouch into an aerodynamic tuck to reach speeds exceeding 100 km/h, and launch off kicker ramps for big air-time bonus multipliers.

---

## Features Implemented

### Phase 1: Core Playable Engine
- **Procedural Low-Poly Snowboarder**: Full 3D male rider featuring an insulated winter jacket, baggy snow pants, snowboard boots, mittens, helmet, and curved panoramic visor goggles with metallic reflection.
- **Snowboard Kinematics & Carving**: Automatic downhill acceleration with gravity slope following, board edge rolling up to 25°, body lean, and dynamic board snow carving spray.
- **Aerodynamic Tuck Boost**: Hold `W` or `↑` to drop into a low racing tuck, reducing aerodynamic drag and boosting top speed from ~72 km/h to over 100 km/h.
- **Ollie / Jump Mechanics**: Launch off the ground with vertical impulse, tucking the board up with balance arm flares and landing knee compression.
- **Continuous Mountain Generation**: Seamless 0-gap terrain chunks generated ahead and recycled behind using deterministic mathematical elevation functions.
- **Atmospheric Environment**: 1,800 animated swirling snowflakes, directional winter sunlight with soft PCF shadow maps, distant mountain silhouettes, and speed streaks.
- **Procedural Sound Engine**: Pure Web Audio API synthesis for snow carving hiss, rushing wind, jump launch whoosh, landing thuds, and UI chimes (zero external audio file dependencies).
- **Frosted Glassmorphism UI**: High-tech alpine interface featuring live distance, score, speedometer with tuck indicator, pause overlay, and game over screens.

### Phase 2: Obstacles & Collectible Coins
- **Varied Mountain Obstacles**:
  - **Pine Trees**: Tall evergreen conifers with snowy tips and shadow casting.
  - **Jagged Boulders**: Granite dodecahedron rocks with deformed facets and snow caps.
  - **Fallen Logs**: Horizontal weathered tree trunks lying across the run with curved snow blankets (clearable via jumping or steering).
  - **Ice Blocks**: Translucent glacier cyan crystalline pillars and spikes using physical transmission materials.
  - **Snowmen**: Classic three-sphere snowmen with carrot noses, coal eyes, alpine scarves, top hats, and twig arms.
- **Fair-Path Mountain Carving**: Terrain bands partition the fairway into lanes while systematically reserving clear navigable routes through every obstacle cluster.
- **Distance Difficulty Curve**: Obstacle density scales up smoothly as distance increases from the starting summit.
- **Collision Detection & Feedback**:
  - Real 3D geometric collision detection.
  - Full wipeout ragdoll tumbling, 30-particle snow blast explosion, camera shake, and detailed cause of wipeout (e.g. *"Wiped out by a fallen log"*).
  - Glancing blow stumble recovery with arm windmilling animation.
- **3D Rotating Gold Coins**:
  - Embossed snowflake emblem, specular metallic gold material, and floating hover bob.
  - Pattern generators: Downhill Lines, Rainbow Jump Arcs over ramps, and Carving Zig-Zags.
  - Rewards **+10 in-game coins** and **+50 score points** per coin.
  - Golden sparkle particle explosion and audio chime on collection.
  - Rhythmic coin combo bonus toasts when collecting coins in quick succession.
  - Live HUD coin counter and persistent `localStorage` all-time coin bank.

### Phase 3: Checkpoints & Nitro Boosts
- **Glowing Blue Checkpoint Gates**:
  - 17m wide luminous neon blue arches with translucent energy curtains placed periodically along the descent.
  - Crossing a gate awards **+250 score points**, plays an ascending major-chord chime, triggers a `"⚡ CHECKPOINT REACHED!"` toast, and registers the coordinates as the run's active respawn anchor.
- **Supersonic Nitro Boost Pickups**:
  - Spinning cyan energy crystals surrounded by rotating orbital gyroscopic rings.
  - Grants a **4.0-second speed burst**, boosting top speed to **34 m/s (~122 km/h)** and acceleration to **18 m/s²** while keeping carving agile and responsive.
  - Real-time zero-allocation particle pool emitting azure rocket thruster exhaust behind the snowboard.
  - Dynamic camera FOV widening to 85° for high-velocity rush and procedural turbine/rocket roar audio.
  - Glowing HUD nitro card with animated electric bolt, timer countdown (`4.0s` $\rightarrow$ `0.0s`), and filling energy bar.
- **Checkpoint Respawn & Collision Protection**:
  - **"RESPAWN AT CHECKPOINT"** buttons dynamically appear on both Pause and Game Over menus when a checkpoint has been reached.
  - Respawns the rider at the checkpoint coordinates with forward glide velocity.
  - Grants **3.0 seconds of collision immunity** with an animated glowing cyan wireframe shield sphere and `"🛡️ RESPAWN SHIELD"` HUD badge.

### Phase 4: Rider Animations & Aerial Trick System
- **Smooth Carving & Body Kinematics**:
  - Dynamically responsive board roll (up to 26°), inverse torso counter-lean, knee flexion, and balance arm adjustments.
  - Dynamic snow spray emitted along the carving edge based on lateral velocity and edge sharpness.
- **Aerodynamic Speed Tuck**:
  - Drops rider into an ultra-low racing crouch, arms pulled back along thighs, visor tracking forward, and board nose dipping for speed.
- **Aerial Rotations & Q/E Spins**:
  - Full mid-air yaw spin rotation with `Q` (counter-clockwise) and `E` (clockwise).
  - Progressive trick detection at 180°, 360°, 540°, 720°, 900°, and 1080° milestones with whoosh audio synthesis.
- **Mid-Air Board Grabs (S Key)**:
  - Deep knee compression with hand extending to grab the board edge between bindings (Method & Indy grabs).
  - Dramatic board tweak/tilt and style arm extension into the sky.
  - Sustained grab scoring rewards holding grabs before landing.
- **Real-Time Air Trick HUD**:
  - Animated live HUD meter displays airtime (e.g. `AIR 1.2s`), active spin degrees (`360°`), and grab tag (`METHOD`).
- **Landing Alignment & Wipeout Physics**:
  - Physical landing check: riders must land facing forward ($\le 42^\circ$) or switch ($\ge 138^\circ$) and release grabs before touchdown.
  - Landing sideways ($42^\circ < |\theta| < 138^\circ$) or landing while holding grab catches an edge, triggering a bone-jarring crunch, wipeout ragdoll tumble, snow explosion, and Game Over screen with detailed wipeout cause.
  - Clean landings award trick bonus points, 1.5x Spin+Grab combo multipliers, +250 switch landing bonuses, triumphant fanfare, and heavy radial snow landing spray.
- **Takeoff & Touchdown Particle Bursts**:
  - Explosive upward powder poof at jump takeoff and kicker launches.
  - Radial snow spray fan upon clean touchdowns proportional to impact velocity.

### Phase 5: Scoring, High Score & Persistent Progress

- **Complete Run Statistics**:
  - Tracks 9 metrics per run: distance, score, coins, max speed, air time, checkpoints reached, tricks landed, + all-time totals.
  - All values displayed on the **enhanced Game Over / Results screen** after every crash.
- **High Score Comparison & Record Badges**:
  - 🏆 **NEW HIGH SCORE** (cyan animated badge) — displayed when the current run beats the all-time high score.
  - 🏅 **NEW DISTANCE RECORD** (gold animated badge) — shown when a new longest distance is set (shown only when score record is not also beaten).
  - Score and distance records are tracked and stored independently.
- **Duplicate-Reward Prevention**:
  - A `_rewardApplied` guard in `UIManager` ensures coins and the run counter are credited to the permanent bank **exactly once** per run, no matter how many times the results screen is displayed.
  - The guard is safely cleared by `showPlaying()` when a new run begins.
- **LocalStorage Persistence** — Six keys persist progress across browser sessions:

  | Key | Type | Description |
  |-----|------|-------------|
  | `snowman_best_score` | integer | All-time highest run score (pts) |
  | `snowman_best_dist` | integer | Longest run distance ever (m) |
  | `snowman_total_coins` | integer | All-time coin bank |
  | `snowman_total_runs` | integer | Total completed runs |
  | `snowman_muted` | string | Audio mute preference (`'true'`/`'false'`) |
  | `snowman_quality` | string | Graphics quality preference (`'low'`/`'medium'`/`'high'`) |

- **Main Menu Records Panel** — shows Best Score, Best Distance, Total Coins, and **Total Runs** loaded from `localStorage` on startup.
- **Enhanced Results Screen**:
  - **3 × 3 stats grid**: Distance, Final Score, Coins This Run, Max Speed, Air Time, Total Coin Bank, Checkpoints Reached, Tricks Landed, and All-Time High Score.
  - Total Runs completed footer bar beneath the grid.
  - Action buttons: **PLAY AGAIN**, **MAIN MENU**, **RESPAWN AT CHECKPOINT** (when available).
- **Safe Restart Behaviour**:
  - `startRun()` only resets run-local variables. All saved progress (high score, coin bank, total runs, best distance) is preserved in `localStorage` and `UIManager` memory.
  - Restarting mid-run or via the pause screen never double-counts coins or runs.

---

## Controls

| Keyboard Control | Action |
| :--- | :--- |
| <kbd>A</kbd> / <kbd>D</kbd> or <kbd>←</kbd> / <kbd>→</kbd> | Steer & Carve Left / Right (Air Steering in flight) |
| <kbd>W</kbd> or <kbd>↑</kbd> | Aerodynamic Tuck (Speed & Acceleration Boost) |
| <kbd>Space</kbd> | Ollie / Jump off snow or kicker ramps |
| <kbd>Q</kbd> / <kbd>E</kbd> | Aerial Spin Left / Right (180°, 360°, 540°, 720°) |
| <kbd>S</kbd> or <kbd>↓</kbd> | Mid-Air Board Grab (Method & Indy Grabs) |
| <kbd>P</kbd> or <kbd>Esc</kbd> | Pause / Resume Game |
| <kbd>R</kbd> | Quick Respawn / Restart Run |

*Note: Dedicated touch and tilt mobile controls will be expanded in Phase 6.*

---

## Gameplay Mechanics

### Scoring
$$\text{Score} = \text{Distance Traveled} \times \text{Speed Multiplier} \times \text{Tuck Bonus} + \text{Coin Points} + \text{Airtime Bonuses}$$
- **Coins**: +50 Score Points & +10 Coins each.
- **Slalom Gates**: +500 Bonus Points for passing through red and blue slalom flags.
- **Air Time**: Landing jumps off kicker ramps rewards up to +400 bonus points depending on hang time.
- **Combos**: Gathering multiple coins in rapid succession triggers combo multipliers.

---

## Technology Stack

- **Core**: HTML5, Vanilla JavaScript (ES Modules), CSS3
- **3D Graphics Engine**: [Three.js](https://threejs.org/) (r160 via CDN import map)
- **Audio**: Web Audio API (procedural oscillator and noise synthesis)
- **Styling**: Vanilla CSS with glassmorphism, responsive flex/grid layouts, and Google Fonts (`Outfit`, `Rajdhani`)
- **Storage**: Browser `localStorage` for high scores, max distance, and coin bank

---

## Project Structure

```
snowman/
├── assets/
│   └── screenshots/
│       ├── menu.png
│       ├── gameplay.png
│       └── wipeout.png
├── js/
│   ├── audio.js         # Web Audio API sound synthesis engine
│   ├── environment.js   # Lighting, fog, snow particles, sparkles, speed lines
│   ├── game.js          # Main coordinator, camera, render loop & state machine
│   ├── player.js        # Low-poly snowboarder model, physics & animations
│   ├── terrain.js       # Infinite chunk generation, obstacles, coins & collisions
│   └── ui.js            # HUD updates, modals, notifications & LocalStorage
├── .gitignore
├── index.html           # Main HTML structure, import maps, and UI overlays
├── README.md            # Comprehensive project documentation
└── style.css            # Winter design system and responsive styles
```

---

## Prerequisites & Running Locally

The game runs locally with standard static web hosting and zero build steps.

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ABHINAND-005/snowman.git
   cd snowman
   ```

2. **Start a local HTTP server**:
   Using Python:
   ```bash
   python -m http.server 8080
   ```
   Or using Node (`npx`):
   ```bash
   npx serve .
   ```

3. **Open in Browser**:
   Navigate to `http://localhost:8080/` in Chrome, Firefox, Safari, or Edge.

---

## Testing Instructions

1. **Launch**: Open `http://localhost:8080/` and verify that the main menu renders with 0 console errors.
2. **Free Ride**: Click **RIDE MOUNTAIN** and test steering with `A` and `D`.
3. **Tuck**: Hold `W` and verify that the speed gauge fills and the "TUCK BOOST" badge illuminates.
4. **Coins**: Steer through lines and rainbow arcs of gold coins to confirm +10 coin counter increments and sparkle effects.
5. **Jumping**: Hit a snow kicker ramp with `Space` and observe the airtime reward upon landing.
6. **Collision**: Deliberately ride into a pine tree, rock, fallen log, ice block, or snowman to test the wipeout ragdoll, snow blast explosion, and game-over telemetry.
7. **Pause & Restart**: Press `P` to pause and `R` or `Play Again` to restart smoothly.

### Phase 5 Persistence Tests

8. **Results Screen**: After crashing, verify the Game Over screen shows all 9 stat boxes (Distance, Score, Coins, Speed, Air Time, Total Bank, Checkpoints, Tricks, High Score) and the Total Runs footer.
9. **High Score Badge**: On your second crash with a higher score, confirm the 🏆 **NEW HIGH SCORE** cyan badge appears. On a lower-scoring run, confirm it's absent.
10. **Distance Record Badge**: Achieve a new distance without beating the score — confirm the 🏅 **NEW DISTANCE RECORD** gold badge appears.
11. **Duplicate-Reward Prevention**: Crash, note the Total Coins and Total Runs values. Press PLAY AGAIN and crash immediately. Verify Total Runs incremented by exactly 1, and only coins from the second run were added to the bank.
12. **LocalStorage Persistence**: After crashing and seeing records update, **refresh the browser tab** without closing. Verify the main menu immediately shows the correct saved best score, best distance, total coins, and total runs.
13. **Restart Preserves Progress**: From the pause screen, press RESTART RUN. Verify that on the *next* crash, the previous all-time records are still present and the run counter increases by 1.
14. **Browser DevTools Check**: Open DevTools > Application > Local Storage > `localhost` and confirm all six `snowman_*` keys are present with correct values.

---


## Development Roadmap

- [x] **Phase 1**: Core playable 3D game, character model, downhill kinematics, infinite terrain chunks, falling snow, audio synthesis, HUD.
- [x] **Phase 2**: Obstacle systems (trees, rocks, fallen logs, ice blocks, snowmen), fair path carving, distance difficulty curve, 3D rotating gold coins, collection patterns, and coin counters.
- [x] **Phase 3**: Checkpoint system, glowing gates, respawn protection shield, and nitro boost mechanics.
- [x] **Phase 4**: Expanded trick system (180°–1080° rotations, Method/Indy grabs), trick combos, landing alignment checks, and failed landing wipeouts.
- [x] **Phase 5**: Complete scoring, high score & persistent progress system (see [Phase 5 feature section](#phase-5-scoring-high-score--persistent-progress)).
- [ ] **Phase 6**: On-screen virtual joystick / touch controls for mobile and tablet devices, advanced audio settings.
- [ ] **Phase 7**: Final optimization, performance tuning, and polish.

---

## Known Limitations

- Mobile on-screen touch overlay buttons are scheduled for Phase 6 (keyboard controls are recommended for current phases).

---

## License

This project is licensed under the [MIT License](LICENSE).
