/**
 * Terrain & World Generation Engine for SNOWMAN
 * Generates an endless, seamless downhill ski mountain slope.
 * Features:
 * - Deterministic, zero-seam procedural height & normal calculations
 * - Complete obstacle systems: Pine Trees, Jagged Boulders, Fallen Logs, Ice Blocks, Snowmen
 * - Checkpoint Gates: Glowing blue arches with 17m clearance, respawn tracking & scoring
 * - Nitro Boost Pickups: Floating glowing cyan canisters with spinning electric rings
 * - 3D rotating gold coins with line, arc, and zig-zag patterns
 * - Fair path carving and distance-based difficulty scaling
 */

import * as THREE from 'three';

export class Terrain {
  constructor(scene) {
    this.scene = scene;

    // Slope configuration
    this.SLOPE_GRADE = 0.22; // ~12.5 degree downhill descent
    this.RUN_HALF_WIDTH = 32; // Primary fairway width
    this.CHUNK_LENGTH = 120; // Length of each terrain chunk (meters)
    this.CHUNK_WIDTH = 140; // Total width of terrain mesh
    this.CHUNK_COUNT = 6; // Active chunks in view (covers ~720m)
    this.SEGS_X = 35;
    this.SEGS_Z = 30;

    // Track active world elements
    this.chunks = [];
    this.activeObstacles = [];
    this.activeCoins = [];
    this.activeCheckpoints = [];
    this.activeNitros = [];
    this.checkpointCount = 0;
    this.nextChunkZ = -this.CHUNK_LENGTH; // Starts slightly behind initial player

    // Cached shared materials & geometries for zero garbage collection
    this.initSharedAssets();

    // Generate initial terrain chunks
    for (let i = 0; i < this.CHUNK_COUNT; i++) {
      this.createChunk();
    }
  }

  /**
   * Caches reusable materials and base geometries
   */
  initSharedAssets() {
    // ---------------- Terrain Materials ----------------
    this.snowMaterial = new THREE.MeshStandardMaterial({
      color: 0xf2f7fc,
      roughness: 0.85,
      metalness: 0.05,
      flatShading: false
    });

    // ---------------- Obstacle Materials ----------------
    this.rockMaterial = new THREE.MeshLambertMaterial({
      color: 0x485563,
      flatShading: true
    });
    this.rockCapMaterial = new THREE.MeshLambertMaterial({
      color: 0xf5faff,
      flatShading: true
    });

    this.trunkMaterial = new THREE.MeshLambertMaterial({
      color: 0x3d271d,
      flatShading: true
    });
    this.foliageMaterialDark = new THREE.MeshLambertMaterial({
      color: 0x184e38,
      flatShading: true
    });
    this.foliageMaterialSnow = new THREE.MeshLambertMaterial({
      color: 0xe6f4f8,
      flatShading: true
    });

    this.logBarkMat = new THREE.MeshLambertMaterial({
      color: 0x422817,
      flatShading: true
    });
    this.logCoreMat = new THREE.MeshLambertMaterial({
      color: 0xc89d6b,
      flatShading: true
    });
    this.logSnowMat = new THREE.MeshLambertMaterial({
      color: 0xf0f7fc,
      flatShading: true
    });

    this.iceMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x88e5ff,
      roughness: 0.1,
      metalness: 0.15,
      transmission: 0.65,
      opacity: 0.88,
      transparent: true,
      flatShading: true,
      ior: 1.31
    });

    this.snowmanBodyMat = new THREE.MeshStandardMaterial({
      color: 0xfcfdff,
      roughness: 0.9,
      metalness: 0.02
    });
    this.carrotMat = new THREE.MeshLambertMaterial({ color: 0xff6b35 });
    this.coalMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
    this.hatMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.5 });
    this.hatBandMat = new THREE.MeshLambertMaterial({ color: 0xffd166 });
    this.scarfMat = new THREE.MeshLambertMaterial({ color: 0xe11d48 });
    this.stickArmMat = new THREE.MeshLambertMaterial({ color: 0x4a2e1b });

    this.flagRedMat = new THREE.MeshLambertMaterial({ color: 0xff3b30 });
    this.flagBlueMat = new THREE.MeshLambertMaterial({ color: 0x007aff });
    this.poleMat = new THREE.MeshLambertMaterial({ color: 0xffffff });

    this.rampMat = new THREE.MeshStandardMaterial({
      color: 0xd9eaf7,
      roughness: 0.6
    });

    // ---------------- Coin Materials ----------------
    this.coinMaterial = new THREE.MeshStandardMaterial({
      color: 0xffd166,
      metalness: 0.88,
      roughness: 0.18,
      emissive: 0xb58900,
      emissiveIntensity: 0.4
    });
    this.coinEmblemMat = new THREE.MeshStandardMaterial({
      color: 0xffea85,
      metalness: 0.95,
      roughness: 0.12,
      emissive: 0xffd166,
      emissiveIntensity: 0.5
    });

    // ---------------- Checkpoint Materials ----------------
    this.cpTowerMat = new THREE.MeshStandardMaterial({
      color: 0x0b132b,
      roughness: 0.3,
      metalness: 0.85
    });
    this.cpEnergyMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.95
    });
    this.cpBeamMat = new THREE.MeshBasicMaterial({
      color: 0x00b4d8,
      transparent: true,
      opacity: 0.38,
      side: THREE.DoubleSide
    });

    // ---------------- Nitro Materials ----------------
    this.nitroCoreMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00b4d8,
      emissiveIntensity: 0.85,
      roughness: 0.15,
      metalness: 0.4
    });
    this.nitroRingMat = new THREE.MeshBasicMaterial({
      color: 0x90e0ef,
      wireframe: true
    });
  }

  /**
   * Exact analytical height function of the mountain.
   */
  getHeight(x, z) {
    let y = -z * this.SLOPE_GRADE;
    y += Math.sin(z * 0.035) * 2.8;
    y += Math.cos(x * 0.045) * 2.2;
    y += Math.sin((x + z) * 0.02) * 1.6;

    const absX = Math.abs(x);
    if (absX > this.RUN_HALF_WIDTH) {
      const diff = absX - this.RUN_HALF_WIDTH;
      y += diff * diff * 0.048;
    }

    return y;
  }

  /**
   * Computes surface normal vector at any (x, z) via finite differences
   */
  getNormal(x, z, target = new THREE.Vector3()) {
    const eps = 0.5;
    const hL = this.getHeight(x - eps, z);
    const hR = this.getHeight(x + eps, z);
    const hD = this.getHeight(x, z - eps);
    const hU = this.getHeight(x, z + eps);

    target.set(hL - hR, 2 * eps, hD - hU).normalize();
    return target;
  }

  /**
   * Creates a single terrain chunk mesh and appends to active world
   */
  createChunk() {
    const chunkZStart = this.nextChunkZ;
    this.nextChunkZ += this.CHUNK_LENGTH;

    const geometry = new THREE.PlaneGeometry(
      this.CHUNK_WIDTH,
      this.CHUNK_LENGTH,
      this.SEGS_X,
      this.SEGS_Z
    );
    geometry.rotateX(-Math.PI / 2);

    const chunkMesh = new THREE.Mesh(geometry, this.snowMaterial);
    chunkMesh.receiveShadow = true;
    chunkMesh.castShadow = false;

    const chunkData = {
      mesh: chunkMesh,
      zStart: chunkZStart,
      zEnd: chunkZStart + this.CHUNK_LENGTH,
      obstacles: [],
      coins: [],
      checkpoints: [],
      nitros: []
    };

    this.updateChunkVertices(chunkData);
    this.scene.add(chunkMesh);

    // Spawn world elements
    this.spawnChunkWorld(chunkData);

    this.chunks.push(chunkData);
    return chunkData;
  }

  /**
   * Updates plane vertices using the mathematical height function
   */
  updateChunkVertices(chunkData) {
    const geometry = chunkData.mesh.geometry;
    const pos = geometry.attributes.position;
    const halfLen = this.CHUNK_LENGTH * 0.5;
    const centerZ = chunkData.zStart + halfLen;

    chunkData.mesh.position.set(0, 0, centerZ);

    for (let i = 0; i < pos.count; i++) {
      const vx = pos.getX(i);
      const vzLocal = pos.getZ(i);
      const worldZ = centerZ + vzLocal;
      const worldY = this.getHeight(vx, worldZ);

      pos.setY(i, worldY);
    }

    geometry.computeVertexNormals();
    pos.needsUpdate = true;
  }

  /**
   * Spawns obstacles, coins, checkpoints, and nitro pickups on a chunk
   */
  spawnChunkWorld(chunkData) {
    const zStart = chunkData.zStart;
    const zEnd = chunkData.zEnd;

    if (zStart < 60) return;

    const difficulty = Math.min(Math.max((zStart - 60) / 2200, 0), 1.0);

    // -------------------------------------------------------------------------
    // 1. Checkpoint Gates (Every ~240m along the slope)
    // -------------------------------------------------------------------------
    const chunkIndex = Math.round(zStart / this.CHUNK_LENGTH);
    if (zStart >= 220 && chunkIndex % 2 === 0) {
      this.checkpointCount++;
      const cpZ = zStart + 55;
      const cpY = this.getHeight(0, cpZ);
      const gate = this.createCheckpointGate(0, cpY, cpZ, this.checkpointCount);
      chunkData.checkpoints.push(gate);
      this.activeCheckpoints.push(gate);
    }

    // -------------------------------------------------------------------------
    // 2. Boundary Pine Forests (Side powder banks)
    // -------------------------------------------------------------------------
    const sideTreeCount = 14 + Math.floor(Math.random() * 6);
    for (let i = 0; i < sideTreeCount; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      const x = side * (this.RUN_HALF_WIDTH + 2 + Math.random() * 26);
      const z = zStart + 4 + Math.random() * (this.CHUNK_LENGTH - 8);
      const y = this.getHeight(x, z);

      const tree = this.createPineTree();
      tree.position.set(x, y, z);
      this.scene.add(tree);

      const obs = { type: 'tree', mesh: tree, x, y, z, radius: 1.25 };
      chunkData.obstacles.push(obs);
      this.activeObstacles.push(obs);
    }

    // -------------------------------------------------------------------------
    // 3. Fair-Path Obstacle Bands
    // -------------------------------------------------------------------------
    const bandLength = this.CHUNK_LENGTH / 3;
    for (let b = 0; b < 3; b++) {
      const bandZ = zStart + b * bandLength + bandLength * 0.45;

      // Don't spawn dense obstacles right on top of a checkpoint gate
      if (Math.abs(bandZ - (zStart + 55)) < 16 && chunkIndex % 2 === 0) continue;

      const lanes = [-20, -10, 0, 10, 20];
      const openLaneIdx1 = Math.floor(Math.random() * 5);
      let openLaneIdx2 = (openLaneIdx1 + 2) % 5;
      if (difficulty > 0.6) openLaneIdx2 = -1;

      lanes.forEach((laneX, idx) => {
        if (idx === openLaneIdx1 || idx === openLaneIdx2) {
          // Open lane: chance of coin line
          if (Math.random() < 0.75) {
            this.spawnCoinLine(chunkData, laneX, bandZ - 10, 5, 3.8);
          }
          return;
        }

        const spawnChance = 0.45 + difficulty * 0.45;
        if (Math.random() > spawnChance) return;

        const jitterX = laneX + (Math.random() - 0.5) * 3.5;
        const jitterZ = bandZ + (Math.random() - 0.5) * 8.0;
        const y = this.getHeight(jitterX, jitterZ);

        const roll = Math.random();
        let obs = null;

        if (roll < 0.28) {
          const tree = this.createPineTree();
          tree.position.set(jitterX, y, jitterZ);
          this.scene.add(tree);
          obs = { type: 'tree', mesh: tree, x: jitterX, y, z: jitterZ, radius: 1.2 };
        } else if (roll < 0.50) {
          const rock = this.createRock();
          rock.position.set(jitterX, y, jitterZ);
          this.scene.add(rock);
          obs = { type: 'rock', mesh: rock, x: jitterX, y, z: jitterZ, radius: 1.3 };
        } else if (roll < 0.70) {
          const log = this.createFallenLog();
          log.position.set(jitterX, y + 0.15, jitterZ);
          this.scene.add(log);
          obs = { type: 'log', mesh: log, x: jitterX, y, z: jitterZ, radius: 0.9, width: 4.0 };
        } else if (roll < 0.86) {
          const ice = this.createIceBlock();
          ice.position.set(jitterX, y, jitterZ);
          this.scene.add(ice);
          obs = { type: 'ice', mesh: ice, x: jitterX, y, z: jitterZ, radius: 1.35 };
        } else {
          const snowman = this.createSnowman();
          snowman.position.set(jitterX, y, jitterZ);
          this.scene.add(snowman);
          obs = { type: 'snowman', mesh: snowman, x: jitterX, y, z: jitterZ, radius: 1.15 };
        }

        if (obs) {
          chunkData.obstacles.push(obs);
          this.activeObstacles.push(obs);
        }
      });
    }

    // -------------------------------------------------------------------------
    // 4. Kicker Ramps with Coin Rainbow Arcs & Approach Nitro
    // -------------------------------------------------------------------------
    if (Math.random() < 0.65) {
      const rx = (Math.random() - 0.5) * (this.RUN_HALF_WIDTH * 0.75);
      const rz = zStart + 25 + Math.random() * (this.CHUNK_LENGTH - 55);
      const ry = this.getHeight(rx, rz);

      const rampMesh = this.createKickerRamp();
      rampMesh.position.set(rx, ry + 0.4, rz);
      this.scene.add(rampMesh);

      const obs = {
        type: 'ramp',
        mesh: rampMesh,
        x: rx, y: ry, z: rz,
        radius: 2.2,
        boostVy: 17.5
      };
      chunkData.obstacles.push(obs);
      this.activeObstacles.push(obs);

      // Rainbow coin arc soaring over ramp
      this.spawnCoinArc(chunkData, rx, rz + 1.5, 6, 4.2);

      // Place a Nitro Canister leading up to the ramp
      const nitroZ = rz - 12;
      const nitroY = this.getHeight(rx, nitroZ) + 0.85;
      const nitro = this.createNitroPickup(rx, nitroY, nitroZ);
      chunkData.nitros.push(nitro);
      this.activeNitros.push(nitro);
    } else {
      // Chance of a standalone Nitro pickup along fairway
      if (Math.random() < 0.55) {
        const nx = (Math.random() - 0.5) * (this.RUN_HALF_WIDTH * 0.7);
        const nz = zStart + 40 + Math.random() * 35;
        const ny = this.getHeight(nx, nz) + 0.85;
        const nitro = this.createNitroPickup(nx, ny, nz);
        chunkData.nitros.push(nitro);
        this.activeNitros.push(nitro);
      }
    }

    // -------------------------------------------------------------------------
    // 5. Slalom Gates (Bonus +500 pts)
    // -------------------------------------------------------------------------
    if (Math.random() < 0.7) {
      const gateX = (Math.random() - 0.5) * (this.RUN_HALF_WIDTH * 0.7);
      const gateZ = zStart + 80;
      const isRed = Math.random() < 0.5;

      const gateGroup = this.createSlalomGate(isRed);
      const gateY = this.getHeight(gateX, gateZ);
      gateGroup.position.set(gateX, gateY, gateZ);
      this.scene.add(gateGroup);

      const obs = {
        type: 'gate',
        mesh: gateGroup,
        x: gateX, y: gateY, z: gateZ,
        width: 5.5,
        passed: false,
        isRed
      };
      chunkData.obstacles.push(obs);
      this.activeObstacles.push(obs);
    }

    // -------------------------------------------------------------------------
    // 6. Carving Zig-Zag Coin Formations
    // -------------------------------------------------------------------------
    if (Math.random() < 0.6) {
      const zigzagZ = zStart + 65;
      this.spawnCoinZigzag(chunkData, zigzagZ, 8, 11.0);
    }
  }

  // =========================================================================
  // Checkpoint Gate & Nitro Pickups Builders
  // =========================================================================

  /**
   * Builds an expansive glowing blue Checkpoint Gate
   */
  createCheckpointGate(centerX, centerY, centerZ, id) {
    const group = new THREE.Group();
    const gateWidth = 17.0; // Ample width to ski through
    const towerHeight = 7.5;

    // Left and Right neon towers
    [-gateWidth * 0.5, gateWidth * 0.5].forEach((tx) => {
      // Dark cyber-metal base
      const baseGeom = new THREE.CylinderGeometry(0.75, 0.95, 1.6, 8);
      const baseMesh = new THREE.Mesh(baseGeom, this.cpTowerMat);
      baseMesh.position.set(tx, 0.8, 0);
      baseMesh.castShadow = true;
      group.add(baseMesh);

      // Glowing blue energy column
      const colGeom = new THREE.CylinderGeometry(0.35, 0.45, towerHeight, 8);
      const colMesh = new THREE.Mesh(colGeom, this.cpEnergyMat);
      colMesh.position.set(tx, towerHeight * 0.5 + 1.2, 0);
      colMesh.castShadow = true;
      group.add(colMesh);

      // Crown beacon
      const beaconGeom = new THREE.OctahedronGeometry(0.65, 0);
      const beaconMesh = new THREE.Mesh(beaconGeom, this.cpEnergyMat);
      beaconMesh.position.set(tx, towerHeight + 1.6, 0);
      group.add(beaconMesh);
    });

    // Overhead crossbar arch
    const archGeom = new THREE.BoxGeometry(gateWidth + 1.2, 0.55, 0.7);
    const archMesh = new THREE.Mesh(archGeom, this.cpTowerMat);
    archMesh.position.set(0, towerHeight + 1.0, 0);
    archMesh.castShadow = true;
    group.add(archMesh);

    // Glowing energy strip on arch
    const stripGeom = new THREE.BoxGeometry(gateWidth, 0.2, 0.75);
    const stripMesh = new THREE.Mesh(stripGeom, this.cpEnergyMat);
    stripMesh.position.set(0, towerHeight + 1.0, 0);
    group.add(stripMesh);

    // Holographic energy curtain spanning the gate
    const beamGeom = new THREE.PlaneGeometry(gateWidth - 1.0, towerHeight - 0.5);
    const beamMesh = new THREE.Mesh(beamGeom, this.cpBeamMat);
    beamMesh.position.set(0, (towerHeight - 0.5) * 0.5 + 1.4, 0);
    group.add(beamMesh);

    group.position.set(centerX, centerY, centerZ);
    this.scene.add(group);

    return {
      type: 'checkpoint',
      mesh: group,
      beamMesh,
      id,
      x: centerX,
      y: centerY,
      z: centerZ,
      width: gateWidth,
      passed: false
    };
  }

  /**
   * Builds a glowing cyan spinning Nitro Boost pickup
   */
  createNitroPickup(x, y, z) {
    const group = new THREE.Group();

    // Core energy octahedron crystal
    const crystalGeom = new THREE.OctahedronGeometry(0.65, 0);
    const crystalMesh = new THREE.Mesh(crystalGeom, this.nitroCoreMat);
    crystalMesh.castShadow = true;
    group.add(crystalMesh);

    // Outer spinning electric ring
    const ringGeom = new THREE.TorusGeometry(0.95, 0.06, 6, 16);
    const ringMesh = new THREE.Mesh(ringGeom, this.nitroRingMat);
    group.add(ringMesh);

    group.position.set(x, y, z);
    this.scene.add(group);

    return {
      type: 'nitro',
      mesh: group,
      ringMesh,
      x, y, z,
      baseY: y,
      collected: false,
      phase: Math.random() * Math.PI * 2,
      scaleAnim: 1.0
    };
  }

  // =========================================================================
  // Coin Spawning & Pattern Generators
  // =========================================================================

  createCoin(x, y, z) {
    const group = new THREE.Group();

    const coinGeom = new THREE.CylinderGeometry(0.58, 0.58, 0.14, 18);
    coinGeom.rotateX(Math.PI / 2);
    const body = new THREE.Mesh(coinGeom, this.coinMaterial);
    body.castShadow = true;
    group.add(body);

    const emblemGeom = new THREE.RingGeometry(0.2, 0.42, 6);
    const emblemFront = new THREE.Mesh(emblemGeom, this.coinEmblemMat);
    emblemFront.position.z = 0.08;
    group.add(emblemFront);

    const emblemBack = new THREE.Mesh(emblemGeom, this.coinEmblemMat);
    emblemBack.position.z = -0.08;
    emblemBack.rotation.y = Math.PI;
    group.add(emblemBack);

    group.position.set(x, y, z);
    this.scene.add(group);

    return {
      mesh: group,
      x, y, z,
      baseY: y,
      collected: false,
      phase: Math.random() * Math.PI * 2,
      scaleAnim: 1.0
    };
  }

  spawnCoinLine(chunkData, startX, startZ, count = 5, spacing = 3.5) {
    for (let i = 0; i < count; i++) {
      const z = startZ + i * spacing;
      const x = startX;
      const y = this.getHeight(x, z) + 0.85;

      const coin = this.createCoin(x, y, z);
      chunkData.coins.push(coin);
      this.activeCoins.push(coin);
    }
  }

  spawnCoinArc(chunkData, centerX, startZ, count = 6, peakHeight = 4.0) {
    const arcLength = 24.0;
    const spacing = arcLength / count;

    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count;
      const z = startZ + i * spacing;
      const x = centerX;

      const arcY = 4 * peakHeight * t * (1 - t);
      const groundY = this.getHeight(x, z);
      const y = groundY + 1.2 + arcY;

      const coin = this.createCoin(x, y, z);
      chunkData.coins.push(coin);
      this.activeCoins.push(coin);
    }
  }

  spawnCoinZigzag(chunkData, startZ, count = 8, amplitude = 10.0) {
    const spacing = 4.2;
    for (let i = 0; i < count; i++) {
      const z = startZ + i * spacing;
      const x = Math.sin((i / count) * Math.PI * 2) * amplitude;
      const y = this.getHeight(x, z) + 0.85;

      const coin = this.createCoin(x, y, z);
      chunkData.coins.push(coin);
      this.activeCoins.push(coin);
    }
  }

  // =========================================================================
  // Obstacle Model Generators
  // =========================================================================

  createPineTree() {
    const group = new THREE.Group();

    const trunkGeom = new THREE.CylinderGeometry(0.3, 0.45, 2.4, 6);
    const trunk = new THREE.Mesh(trunkGeom, this.trunkMaterial);
    trunk.position.y = 1.2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    const layerSizes = [
      { r: 2.3, h: 2.6, y: 2.8 },
      { r: 1.8, h: 2.2, y: 4.4 },
      { r: 1.2, h: 1.8, y: 5.8 }
    ];

    layerSizes.forEach((layer) => {
      const coneGeom = new THREE.ConeGeometry(layer.r, layer.h, 6);
      const cone = new THREE.Mesh(coneGeom, this.foliageMaterialDark);
      cone.position.y = layer.y;
      cone.castShadow = true;
      cone.receiveShadow = true;
      group.add(cone);

      const capGeom = new THREE.ConeGeometry(layer.r * 0.55, layer.h * 0.45, 6);
      const cap = new THREE.Mesh(capGeom, this.foliageMaterialSnow);
      cap.position.y = layer.y + layer.h * 0.32;
      group.add(cap);
    });

    const scale = 0.85 + Math.random() * 0.4;
    group.scale.set(scale, scale, scale);
    group.rotation.y = Math.random() * Math.PI * 2;
    return group;
  }

  createRock() {
    const group = new THREE.Group();

    const radius = 1.3 + Math.random() * 0.8;
    const rockGeom = new THREE.DodecahedronGeometry(radius, 0);

    const pos = rockGeom.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const rx = pos.getX(i) * (0.8 + Math.random() * 0.4);
      const ry = pos.getY(i) * (0.7 + Math.random() * 0.5);
      const rz = pos.getZ(i) * (0.8 + Math.random() * 0.4);
      pos.setXYZ(i, rx, ry, rz);
    }
    rockGeom.computeVertexNormals();

    const rockMesh = new THREE.Mesh(rockGeom, this.rockMaterial);
    rockMesh.position.y = radius * 0.55;
    rockMesh.castShadow = true;
    rockMesh.receiveShadow = true;
    group.add(rockMesh);

    const capGeom = new THREE.ConeGeometry(radius * 0.85, radius * 0.6, 5);
    const cap = new THREE.Mesh(capGeom, this.rockCapMaterial);
    cap.position.y = radius * 0.95;
    group.add(cap);

    group.rotation.set(
      Math.random() * 0.3,
      Math.random() * Math.PI * 2,
      Math.random() * 0.3
    );
    return group;
  }

  createFallenLog() {
    const group = new THREE.Group();

    const logLength = 3.8 + Math.random() * 1.2;
    const logRadius = 0.38 + Math.random() * 0.1;

    const logGeom = new THREE.CylinderGeometry(logRadius * 0.9, logRadius, logLength, 7);
    logGeom.rotateZ(Math.PI / 2);
    const logMesh = new THREE.Mesh(logGeom, this.logBarkMat);
    logMesh.castShadow = true;
    logMesh.receiveShadow = true;
    group.add(logMesh);

    const snowGeom = new THREE.CylinderGeometry(
      logRadius * 0.95,
      logRadius * 1.05,
      logLength * 0.92,
      7, 1, false,
      0, Math.PI
    );
    snowGeom.rotateZ(Math.PI / 2);
    snowGeom.rotateX(-Math.PI / 2);
    const snowMesh = new THREE.Mesh(snowGeom, this.logSnowMat);
    snowMesh.position.y = 0.08;
    group.add(snowMesh);

    group.rotation.y = (Math.random() - 0.5) * 0.6;
    return group;
  }

  createIceBlock() {
    const group = new THREE.Group();

    const crystalGeom = new THREE.ConeGeometry(1.2, 3.4, 5);
    const crystalMesh = new THREE.Mesh(crystalGeom, this.iceMaterial);
    crystalMesh.position.y = 1.7;
    crystalMesh.castShadow = true;
    group.add(crystalMesh);

    [-0.6, 0.6].forEach((offset, idx) => {
      const shardGeom = new THREE.ConeGeometry(0.7, 2.2, 5);
      const shard = new THREE.Mesh(shardGeom, this.iceMaterial);
      shard.position.set(offset, 1.1, (idx === 0 ? -0.4 : 0.4));
      shard.rotation.z = (offset > 0 ? 0.25 : -0.25);
      shard.castShadow = true;
      group.add(shard);
    });

    group.rotation.y = Math.random() * Math.PI * 2;
    return group;
  }

  createSnowman() {
    const group = new THREE.Group();

    const baseSphere = new THREE.Mesh(new THREE.SphereGeometry(0.95, 8, 8), this.snowmanBodyMat);
    baseSphere.position.y = 0.95;
    baseSphere.castShadow = true;
    group.add(baseSphere);

    const midSphere = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), this.snowmanBodyMat);
    midSphere.position.y = 2.1;
    midSphere.castShadow = true;
    group.add(midSphere);

    const headSphere = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), this.snowmanBodyMat);
    headSphere.position.y = 3.05;
    headSphere.castShadow = true;
    group.add(headSphere);

    const carrotGeom = new THREE.ConeGeometry(0.1, 0.45, 6);
    carrotGeom.rotateX(Math.PI / 2);
    const carrot = new THREE.Mesh(carrotGeom, this.carrotMat);
    carrot.position.set(0, 3.05, 0.55);
    group.add(carrot);

    [-0.16, 0.16].forEach((ex) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 4, 4), this.coalMat);
      eye.position.set(ex, 3.2, 0.46);
      group.add(eye);
    });

    const scarfGeom = new THREE.TorusGeometry(0.52, 0.12, 6, 12);
    scarfGeom.rotateX(Math.PI / 2);
    const scarf = new THREE.Mesh(scarfGeom, this.scarfMat);
    scarf.position.y = 2.65;
    group.add(scarf);

    const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.08, 10), this.hatMat);
    hatBrim.position.y = 3.52;
    group.add(hatBrim);

    const hatCrown = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.55, 10), this.hatMat);
    hatCrown.position.y = 3.82;
    hatCrown.castShadow = true;
    group.add(hatCrown);

    const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.12, 10), this.hatBandMat);
    hatBand.position.y = 3.62;
    group.add(hatBand);

    [-1, 1].forEach((dir) => {
      const armGeom = new THREE.CylinderGeometry(0.04, 0.05, 1.1, 4);
      armGeom.rotateZ(dir * (Math.PI / 3));
      const arm = new THREE.Mesh(armGeom, this.stickArmMat);
      arm.position.set(dir * 0.95, 2.2, 0);
      group.add(arm);
    });

    const scale = 0.85 + Math.random() * 0.25;
    group.scale.set(scale, scale, scale);
    return group;
  }

  createKickerRamp() {
    const rampGeom = new THREE.BoxGeometry(4.2, 0.9, 3.5);
    const mesh = new THREE.Mesh(rampGeom, this.rampMat);
    mesh.rotation.x = 0.28;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  createSlalomGate(isRed) {
    const group = new THREE.Group();
    const flagMat = isRed ? this.flagRedMat : this.flagBlueMat;
    const gateWidth = 5.5;

    [-gateWidth * 0.5, gateWidth * 0.5].forEach((px) => {
      const poleGeom = new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6);
      const pole = new THREE.Mesh(poleGeom, this.poleMat);
      pole.position.set(px, 1.3, 0);
      pole.castShadow = true;
      group.add(pole);

      const flagGeom = new THREE.PlaneGeometry(0.8, 0.5);
      const flag = new THREE.Mesh(flagGeom, flagMat);
      flag.position.set(px + 0.4, 2.1, 0);
      flag.rotation.y = Math.PI * 0.15;
      group.add(flag);
    });

    return group;
  }

  // =========================================================================
  // Per-Frame Update, Recycling & Collisions
  // =========================================================================

  /**
   * Recycles oldest terrain chunk when rider progresses forward.
   * Updates coin, nitro, and checkpoint animations.
   */
  update(delta, playerZ) {
    const time = Date.now() * 0.003;

    // 1. Animate active coins (Spin & Bob)
    for (let i = 0; i < this.activeCoins.length; i++) {
      const coin = this.activeCoins[i];
      if (!coin.collected) {
        coin.mesh.rotation.y += 3.6 * delta;
        coin.mesh.position.y = coin.baseY + Math.sin(time + coin.phase) * 0.18;
      } else if (coin.scaleAnim > 0.05) {
        coin.scaleAnim -= 5.0 * delta;
        coin.mesh.scale.setScalar(Math.max(0.01, coin.scaleAnim * 1.5));
        coin.mesh.position.y += 3.5 * delta;
      }
    }

    // 2. Animate active nitro pickups (Fast spin & ring orbit)
    for (let i = 0; i < this.activeNitros.length; i++) {
      const nitro = this.activeNitros[i];
      if (!nitro.collected) {
        nitro.mesh.rotation.y += 4.5 * delta;
        nitro.ringMesh.rotation.x += 3.2 * delta;
        nitro.ringMesh.rotation.z += 2.0 * delta;
        nitro.mesh.position.y = nitro.baseY + Math.sin(time * 1.5 + nitro.phase) * 0.22;
      } else if (nitro.scaleAnim > 0.05) {
        nitro.scaleAnim -= 5.0 * delta;
        nitro.mesh.scale.setScalar(Math.max(0.01, nitro.scaleAnim * 1.8));
        nitro.mesh.position.y += 4.5 * delta;
      }
    }

    // 3. Animate checkpoint gates (curtain beam pulse)
    for (let i = 0; i < this.activeCheckpoints.length; i++) {
      const cp = this.activeCheckpoints[i];
      if (cp.beamMesh) {
        cp.beamMesh.material.opacity = 0.28 + Math.sin(time * 2.5) * 0.15;
      }
    }

    // 4. Chunk recycling
    if (this.chunks.length > 0) {
      const firstChunk = this.chunks[0];
      if (playerZ > firstChunk.zEnd + 30) {
        // Clean up obstacles
        firstChunk.obstacles.forEach((obs) => {
          if (obs.mesh) this.scene.remove(obs.mesh);
          const idx = this.activeObstacles.indexOf(obs);
          if (idx !== -1) this.activeObstacles.splice(idx, 1);
        });
        firstChunk.obstacles = [];

        // Clean up coins
        firstChunk.coins.forEach((coin) => {
          if (coin.mesh) this.scene.remove(coin.mesh);
          const cIdx = this.activeCoins.indexOf(coin);
          if (cIdx !== -1) this.activeCoins.splice(cIdx, 1);
        });
        firstChunk.coins = [];

        // Clean up checkpoints
        firstChunk.checkpoints.forEach((cp) => {
          if (cp.mesh) this.scene.remove(cp.mesh);
          const pIdx = this.activeCheckpoints.indexOf(cp);
          if (pIdx !== -1) this.activeCheckpoints.splice(pIdx, 1);
        });
        firstChunk.checkpoints = [];

        // Clean up nitro pickups
        firstChunk.nitros.forEach((nitro) => {
          if (nitro.mesh) this.scene.remove(nitro.mesh);
          const nIdx = this.activeNitros.indexOf(nitro);
          if (nIdx !== -1) this.activeNitros.splice(nIdx, 1);
        });
        firstChunk.nitros = [];

        // Reposition chunk to front
        firstChunk.zStart = this.nextChunkZ;
        firstChunk.zEnd = this.nextChunkZ + this.CHUNK_LENGTH;
        this.nextChunkZ += this.CHUNK_LENGTH;

        this.updateChunkVertices(firstChunk);
        this.spawnChunkWorld(firstChunk);

        this.chunks.shift();
        this.chunks.push(firstChunk);
      }
    }
  }

  /**
   * Checks coin collection around player
   */
  checkCoinCollisions(playerPos, collectionRadius = 1.35) {
    const px = playerPos.x;
    const py = playerPos.y;
    const pz = playerPos.z;

    for (let i = 0; i < this.activeCoins.length; i++) {
      const coin = this.activeCoins[i];
      if (coin.collected) continue;

      const dz = coin.z - pz;
      if (Math.abs(dz) > 2.5) continue;

      const dx = coin.x - px;
      const dy = coin.mesh.position.y - py;
      const distSq = dx * dx + dy * dy + dz * dz;

      const hitDist = collectionRadius + 0.6;
      if (distSq < hitDist * hitDist) {
        coin.collected = true;
        return {
          collected: true,
          coin,
          coins: 10,
          points: 50,
          position: coin.mesh.position.clone()
        };
      }
    }

    return { collected: false };
  }

  /**
   * Checks Nitro pickup collection around player
   */
  checkNitroCollisions(playerPos, collectionRadius = 1.45) {
    const px = playerPos.x;
    const py = playerPos.y;
    const pz = playerPos.z;

    for (let i = 0; i < this.activeNitros.length; i++) {
      const nitro = this.activeNitros[i];
      if (nitro.collected) continue;

      const dz = nitro.z - pz;
      if (Math.abs(dz) > 2.5) continue;

      const dx = nitro.x - px;
      const dy = nitro.mesh.position.y - py;
      const distSq = dx * dx + dy * dy + dz * dz;

      const hitDist = collectionRadius + 0.7;
      if (distSq < hitDist * hitDist) {
        nitro.collected = true;
        return {
          collected: true,
          nitro,
          duration: 4.0,
          position: nitro.mesh.position.clone()
        };
      }
    }

    return { collected: false };
  }

  /**
   * Checks if player passed through a Checkpoint Gate
   */
  checkCheckpointCollisions(playerPos) {
    const px = playerPos.x;
    const pz = playerPos.z;

    for (let i = 0; i < this.activeCheckpoints.length; i++) {
      const cp = this.activeCheckpoints[i];
      if (cp.passed) continue;

      const dz = cp.z - pz;
      if (Math.abs(dz) < 1.8) {
        const dx = Math.abs(px - cp.x);
        if (dx < cp.width * 0.5) {
          cp.passed = true;
          return {
            passed: true,
            checkpoint: cp,
            points: 250,
            x: cp.x,
            y: cp.y,
            z: cp.z
          };
        }
      }
    }

    return { passed: false };
  }

  /**
   * Collision check against nearby obstacles
   */
  checkCollisions(playerPos, playerRadius = 0.55) {
    const px = playerPos.x;
    const pz = playerPos.z;
    const py = playerPos.y;

    for (let i = 0; i < this.activeObstacles.length; i++) {
      const obs = this.activeObstacles[i];
      const dz = obs.z - pz;

      if (Math.abs(dz) > 5) continue;

      const dx = obs.x - px;
      const distSq = dx * dx + dz * dz;

      // 1. Solid obstacles
      if (obs.type === 'tree' || obs.type === 'rock' || obs.type === 'ice' || obs.type === 'snowman') {
        const minRadius = obs.radius + playerRadius;
        if (distSq < minRadius * minRadius) {
          return { hit: true, type: 'crash', obstacle: obs, cause: obs.type };
        }
      }

      // 2. Fallen Log
      if (obs.type === 'log') {
        const halfW = obs.width * 0.5;
        if (Math.abs(dx) < (halfW + playerRadius) && Math.abs(dz) < (obs.radius + playerRadius)) {
          if (py > obs.y + 0.9) {
            // Cleared log by jumping
          } else {
            return { hit: true, type: 'crash', obstacle: obs, cause: 'fallen log' };
          }
        }
      }

      // 3. Snow kicker ramp
      if (obs.type === 'ramp') {
        const rampDist = obs.radius + playerRadius;
        if (distSq < rampDist * rampDist) {
          return { hit: true, type: 'ramp', obstacle: obs, boostVy: obs.boostVy };
        }
      }

      // 4. Slalom gate
      if (obs.type === 'gate' && !obs.passed) {
        if (Math.abs(dz) < 1.2 && Math.abs(dx) < (obs.width * 0.5)) {
          obs.passed = true;
          return { hit: true, type: 'gate', obstacle: obs };
        }
      }
    }

    return { hit: false };
  }

  /**
   * Resets terrain to clean initial state for fresh run
   */
  reset() {
    this.activeObstacles.forEach((obs) => {
      if (obs.mesh) this.scene.remove(obs.mesh);
    });
    this.activeObstacles = [];

    this.activeCoins.forEach((coin) => {
      if (coin.mesh) this.scene.remove(coin.mesh);
    });
    this.activeCoins = [];

    this.activeCheckpoints.forEach((cp) => {
      if (cp.mesh) this.scene.remove(cp.mesh);
    });
    this.activeCheckpoints = [];

    this.activeNitros.forEach((nitro) => {
      if (nitro.mesh) this.scene.remove(nitro.mesh);
    });
    this.activeNitros = [];

    this.chunks.forEach((chunk) => {
      if (chunk.mesh) this.scene.remove(chunk.mesh);
    });
    this.chunks = [];

    this.checkpointCount = 0;
    this.nextChunkZ = -this.CHUNK_LENGTH;
    for (let i = 0; i < this.CHUNK_COUNT; i++) {
      this.createChunk();
    }
  }
}
