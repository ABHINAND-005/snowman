/**
 * Terrain & World Generation Engine for SNOWMAN
 * Generates an endless, seamless downhill ski mountain slope.
 * Features:
 * - Deterministic, zero-seam procedural height & normal calculations
 * - Complete obstacle systems: Pine Trees, Jagged Boulders, Fallen Logs, Ice Blocks, Snowmen
 * - Gradual distance-based difficulty scaling with fair path carving
 * - Rotating, glowing 3D gold coins in lines, rainbow jump arcs, and zig-zag carving patterns
 * - Collision detection and collection mechanics
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
    // Rock materials
    this.rockMaterial = new THREE.MeshLambertMaterial({
      color: 0x485563,
      flatShading: true
    });
    this.rockCapMaterial = new THREE.MeshLambertMaterial({
      color: 0xf5faff,
      flatShading: true
    });

    // Pine tree materials
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

    // Fallen log materials
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

    // Ice block material (translucent glacier crystal)
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

    // Snowman materials
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

    // Slalom flag materials
    this.flagRedMat = new THREE.MeshLambertMaterial({ color: 0xff3b30 });
    this.flagBlueMat = new THREE.MeshLambertMaterial({ color: 0x007aff });
    this.poleMat = new THREE.MeshLambertMaterial({ color: 0xffffff });

    // Kicker ramp material
    this.rampMat = new THREE.MeshStandardMaterial({
      color: 0xd9eaf7,
      roughness: 0.6
    });

    // ---------------- Coin Assets ----------------
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
  }

  /**
   * Exact analytical height function of the mountain.
   * Produces continuous, smooth downhill terrain with rolling powder rollers and side half-pipe banks.
   * Because it is purely deterministic, adjacent chunks are 100% seamless with zero gaps.
   */
  getHeight(x, z) {
    // 1. Base downhill incline
    let y = -z * this.SLOPE_GRADE;

    // 2. Rolling natural terrain waves
    y += Math.sin(z * 0.035) * 2.8;
    y += Math.cos(x * 0.045) * 2.2;
    y += Math.sin((x + z) * 0.02) * 1.6;

    // 3. Half-pipe / valley side banks: steeply curves upward at outer boundaries
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
    // Orient plane so +Y is up and +Z is forward along the mountain run
    geometry.rotateX(-Math.PI / 2);

    const chunkMesh = new THREE.Mesh(geometry, this.snowMaterial);
    chunkMesh.receiveShadow = true;
    chunkMesh.castShadow = false;

    const chunkData = {
      mesh: chunkMesh,
      zStart: chunkZStart,
      zEnd: chunkZStart + this.CHUNK_LENGTH,
      obstacles: [],
      coins: []
    };

    // Position vertices
    this.updateChunkVertices(chunkData);
    this.scene.add(chunkMesh);

    // Spawn obstacles and coins for this chunk
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
   * Spawns obstacles and coin formations with progressive distance-based difficulty
   * while guaranteeing a fair, navigable line through every obstacle pattern.
   */
  spawnChunkWorld(chunkData) {
    const zStart = chunkData.zStart;
    const zEnd = chunkData.zEnd;

    // Starting plateau (z < 60) stays clean
    if (zStart < 60) return;

    // Distance-based difficulty factor (0.0 to 1.0)
    const difficulty = Math.min(Math.max((zStart - 60) / 2200, 0), 1.0);

    // -------------------------------------------------------------------------
    // 1. Boundary Pine Forests (placed along outer side powder banks)
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
    // 2. Fair-Path Fairway Obstacle Clusters
    // -------------------------------------------------------------------------
    // Divide chunk into 3 longitudinal bands
    const bandLength = this.CHUNK_LENGTH / 3;
    for (let b = 0; b < 3; b++) {
      const bandZ = zStart + b * bandLength + bandLength * 0.45;

      // Define 5 virtual fairway lanes: -20, -10, 0, +10, +20
      const lanes = [-20, -10, 0, 10, 20];

      // GUARANTEE FAIR ROUTE: pick 1 or 2 lanes to keep completely OPEN
      const openLaneIdx1 = Math.floor(Math.random() * 5);
      let openLaneIdx2 = (openLaneIdx1 + 2) % 5;
      if (difficulty > 0.6) {
        // Higher difficulty keeps 1 clear open route
        openLaneIdx2 = -1;
      }

      // Populate other lanes with varied obstacles
      lanes.forEach((laneX, idx) => {
        if (idx === openLaneIdx1 || idx === openLaneIdx2) {
          // Open navigable lane! Chance to spawn coins along the safe line
          if (Math.random() < 0.75) {
            this.spawnCoinLine(chunkData, laneX, bandZ - 10, 5, 3.8);
          }
          return;
        }

        // Spawn probability scales with difficulty
        const spawnChance = 0.45 + difficulty * 0.45;
        if (Math.random() > spawnChance) return;

        const jitterX = laneX + (Math.random() - 0.5) * 3.5;
        const jitterZ = bandZ + (Math.random() - 0.5) * 8.0;
        const y = this.getHeight(jitterX, jitterZ);

        // Pick obstacle type based on random roll & difficulty
        const roll = Math.random();
        let obs = null;

        if (roll < 0.28) {
          // Pine tree on run
          const tree = this.createPineTree();
          tree.position.set(jitterX, y, jitterZ);
          this.scene.add(tree);
          obs = { type: 'tree', mesh: tree, x: jitterX, y, z: jitterZ, radius: 1.2 };
        } else if (roll < 0.50) {
          // Jagged boulder
          const rock = this.createRock();
          rock.position.set(jitterX, y, jitterZ);
          this.scene.add(rock);
          obs = { type: 'rock', mesh: rock, x: jitterX, y, z: jitterZ, radius: 1.3 };
        } else if (roll < 0.70) {
          // Fallen Log across slope
          const log = this.createFallenLog();
          log.position.set(jitterX, y + 0.15, jitterZ);
          this.scene.add(log);
          obs = {
            type: 'log',
            mesh: log,
            x: jitterX, y, z: jitterZ,
            radius: 0.9,
            width: 4.0
          };
        } else if (roll < 0.86) {
          // Ice Monolith / Block
          const ice = this.createIceBlock();
          ice.position.set(jitterX, y, jitterZ);
          this.scene.add(ice);
          obs = { type: 'ice', mesh: ice, x: jitterX, y, z: jitterZ, radius: 1.35 };
        } else {
          // Snowman!
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
    // 3. Snow Kicker Ramps with Coin Rainbow Arcs
    // -------------------------------------------------------------------------
    if (Math.random() < 0.65) {
      const rx = (Math.random() - 0.5) * (this.RUN_HALF_WIDTH * 0.75);
      const rz = zStart + 25 + Math.random() * (this.CHUNK_LENGTH - 50);
      const ry = this.getHeight(rx, rz);

      const rampMesh = this.createKickerRamp();
      rampMesh.position.set(rx, ry + 0.4, rz);
      this.scene.add(rampMesh);

      const obs = {
        type: 'ramp',
        mesh: rampMesh,
        x: rx, y: ry, z: rz,
        radius: 2.2,
        boostVy: 17.0
      };
      chunkData.obstacles.push(obs);
      this.activeObstacles.push(obs);

      // Spawn a majestic parabolic rainbow arc of gold coins launching over the kicker ramp!
      this.spawnCoinArc(chunkData, rx, rz + 1.5, 6, 4.2);
    }

    // -------------------------------------------------------------------------
    // 4. Slalom Gates (Bonus +500 pts)
    // -------------------------------------------------------------------------
    if (Math.random() < 0.7) {
      const gateX = (Math.random() - 0.5) * (this.RUN_HALF_WIDTH * 0.7);
      const gateZ = zStart + 55;
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
    // 5. Carving Zig-Zag Coin Formations
    // -------------------------------------------------------------------------
    if (Math.random() < 0.6) {
      const zigzagZ = zStart + 70;
      this.spawnCoinZigzag(chunkData, zigzagZ, 8, 12.0);
    }
  }

  // =========================================================================
  // Coin Spawning & Pattern Generators
  // =========================================================================

  /**
   * Spawns a single 3D rotating gold coin
   */
  createCoin(x, y, z) {
    const group = new THREE.Group();

    // Coin cylinder body
    const coinGeom = new THREE.CylinderGeometry(0.58, 0.58, 0.14, 18);
    // Orient flat face forward
    coinGeom.rotateX(Math.PI / 2);
    const body = new THREE.Mesh(coinGeom, this.coinMaterial);
    body.castShadow = true;
    group.add(body);

    // Embossed snowflake / star emblem on face
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

    const coin = {
      mesh: group,
      x, y, z,
      baseY: y,
      collected: false,
      phase: Math.random() * Math.PI * 2,
      scaleAnim: 1.0
    };

    return coin;
  }

  /**
   * Spawns a straight line of gold coins down the slope
   */
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

  /**
   * Spawns a parabolic rainbow jump arc of gold coins launching over a ramp
   */
  spawnCoinArc(chunkData, centerX, startZ, count = 6, peakHeight = 4.0) {
    const arcLength = 24.0;
    const spacing = arcLength / count;

    for (let i = 0; i < count; i++) {
      const t = (i + 0.5) / count; // 0 to 1
      const z = startZ + i * spacing;
      const x = centerX;

      // Parabolic jump arc formula: 4 * h * t * (1 - t)
      const arcY = 4 * peakHeight * t * (1 - t);
      const groundY = this.getHeight(x, z);
      const y = groundY + 1.2 + arcY;

      const coin = this.createCoin(x, y, z);
      chunkData.coins.push(coin);
      this.activeCoins.push(coin);
    }
  }

  /**
   * Spawns an alternating zig-zag / S-curve of gold coins that encourages rhythmic carving
   */
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

  /**
   * Builds an attractive low-poly snowy pine tree
   */
  createPineTree() {
    const group = new THREE.Group();

    // Trunk
    const trunkGeom = new THREE.CylinderGeometry(0.3, 0.45, 2.4, 6);
    const trunk = new THREE.Mesh(trunkGeom, this.trunkMaterial);
    trunk.position.y = 1.2;
    trunk.castShadow = true;
    trunk.receiveShadow = true;
    group.add(trunk);

    // 3 Foliage cones
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

      // Snowy white tip cap
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

  /**
   * Builds a stylized snow-capped mountain rock
   */
  createRock() {
    const group = new THREE.Group();

    const radius = 1.3 + Math.random() * 0.8;
    const rockGeom = new THREE.DodecahedronGeometry(radius, 0);

    // Randomize vertex shape for jagged boulder look
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

    // Snowy top cap
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

  /**
   * Builds a fallen snowy tree log lying across the slope
   */
  createFallenLog() {
    const group = new THREE.Group();

    const logLength = 3.8 + Math.random() * 1.2;
    const logRadius = 0.38 + Math.random() * 0.1;

    // Main log cylinder (oriented horizontally)
    const logGeom = new THREE.CylinderGeometry(logRadius * 0.9, logRadius, logLength, 7);
    logGeom.rotateZ(Math.PI / 2);
    const logMesh = new THREE.Mesh(logGeom, this.logBarkMat);
    logMesh.castShadow = true;
    logMesh.receiveShadow = true;
    group.add(logMesh);

    // Snow layer blanket resting across top half of log
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

    // Slight angle relative to downhill path
    group.rotation.y = (Math.random() - 0.5) * 0.6;
    return group;
  }

  /**
   * Builds a translucent glacier cyan crystalline ice monolith
   */
  createIceBlock() {
    const group = new THREE.Group();

    // Central sharp crystalline column
    const crystalGeom = new THREE.ConeGeometry(1.2, 3.4, 5);
    const crystalMesh = new THREE.Mesh(crystalGeom, this.iceMaterial);
    crystalMesh.position.y = 1.7;
    crystalMesh.castShadow = true;
    group.add(crystalMesh);

    // Flanking secondary ice shards
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

  /**
   * Builds a stylized 3D Snowman (classic three snowballs, carrot nose, hat, scarf, twig arms)
   */
  createSnowman() {
    const group = new THREE.Group();

    // 1. Bottom Snowball
    const baseSphere = new THREE.Mesh(new THREE.SphereGeometry(0.95, 8, 8), this.snowmanBodyMat);
    baseSphere.position.y = 0.95;
    baseSphere.castShadow = true;
    group.add(baseSphere);

    // 2. Middle Snowball
    const midSphere = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), this.snowmanBodyMat);
    midSphere.position.y = 2.1;
    midSphere.castShadow = true;
    group.add(midSphere);

    // 3. Head Snowball
    const headSphere = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), this.snowmanBodyMat);
    headSphere.position.y = 3.05;
    headSphere.castShadow = true;
    group.add(headSphere);

    // Carrot Nose (points along +Z)
    const carrotGeom = new THREE.ConeGeometry(0.1, 0.45, 6);
    carrotGeom.rotateX(Math.PI / 2);
    const carrot = new THREE.Mesh(carrotGeom, this.carrotMat);
    carrot.position.set(0, 3.05, 0.55);
    group.add(carrot);

    // Coal Eyes
    [-0.16, 0.16].forEach((ex) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 4, 4), this.coalMat);
      eye.position.set(ex, 3.2, 0.46);
      group.add(eye);
    });

    // Cozy Red Scarf
    const scarfGeom = new THREE.TorusGeometry(0.52, 0.12, 6, 12);
    scarfGeom.rotateX(Math.PI / 2);
    const scarf = new THREE.Mesh(scarfGeom, this.scarfMat);
    scarf.position.y = 2.65;
    group.add(scarf);

    // Top Hat with Gold Band
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

    // Twig Stick Arms
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

  /**
   * Builds an aerodynamic snow kicker ramp
   */
  createKickerRamp() {
    const rampGeom = new THREE.BoxGeometry(4.2, 0.9, 3.5);
    const mesh = new THREE.Mesh(rampGeom, this.rampMat);
    mesh.rotation.x = 0.28; // tilted wedge facing downhill
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  /**
   * Builds a pair of slalom flags (Red or Blue)
   */
  createSlalomGate(isRed) {
    const group = new THREE.Group();
    const flagMat = isRed ? this.flagRedMat : this.flagBlueMat;
    const gateWidth = 5.5;

    // Left & Right poles
    [-gateWidth * 0.5, gateWidth * 0.5].forEach((px) => {
      const poleGeom = new THREE.CylinderGeometry(0.06, 0.06, 2.6, 6);
      const pole = new THREE.Mesh(poleGeom, this.poleMat);
      pole.position.set(px, 1.3, 0);
      pole.castShadow = true;
      group.add(pole);

      // Pennant flag
      const flagGeom = new THREE.PlaneGeometry(0.8, 0.5);
      const flag = new THREE.Mesh(flagGeom, flagMat);
      flag.position.set(px + 0.4, 2.1, 0);
      flag.rotation.y = Math.PI * 0.15; // slight flutter
      group.add(flag);
    });

    return group;
  }

  // =========================================================================
  // Per-Frame Update, Recycling & Collisions
  // =========================================================================

  /**
   * Recycles oldest terrain chunk when rider progresses forward.
   * Updates coin continuous rotation and floating hover animations.
   */
  update(delta, playerZ) {
    // 1. Animate active coins (Spin & Bob)
    const time = Date.now() * 0.003;
    for (let i = 0; i < this.activeCoins.length; i++) {
      const coin = this.activeCoins[i];
      if (!coin.collected) {
        coin.mesh.rotation.y += 3.6 * delta;
        coin.mesh.position.y = coin.baseY + Math.sin(time + coin.phase) * 0.18;
      } else if (coin.scaleAnim > 0.05) {
        // Collection pop animation
        coin.scaleAnim -= 5.0 * delta;
        coin.mesh.scale.setScalar(Math.max(0.01, coin.scaleAnim * 1.5));
        coin.mesh.position.y += 3.5 * delta;
      }
    }

    // 2. Chunk recycling
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

        // Reposition chunk to front
        firstChunk.zStart = this.nextChunkZ;
        firstChunk.zEnd = this.nextChunkZ + this.CHUNK_LENGTH;
        this.nextChunkZ += this.CHUNK_LENGTH;

        // Recompute vertices seamlessly
        this.updateChunkVertices(firstChunk);

        // Spawn new world elements
        this.spawnChunkWorld(firstChunk);

        // Rotate chunk array
        this.chunks.shift();
        this.chunks.push(firstChunk);
      }
    }
  }

  /**
   * Checks coin collection around player
   * Awards 10 coins + 50 points per coin, collected only once.
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
   * Collision check against nearby obstacles
   * Returns { hit: boolean, obstacle: object | null, type: string }
   */
  checkCollisions(playerPos, playerRadius = 0.55) {
    const px = playerPos.x;
    const pz = playerPos.z;
    const py = playerPos.y;

    for (let i = 0; i < this.activeObstacles.length; i++) {
      const obs = this.activeObstacles[i];
      const dz = obs.z - pz;

      // Only check obstacles in close range
      if (Math.abs(dz) > 5) continue;

      const dx = obs.x - px;
      const distSq = dx * dx + dz * dz;

      // 1. Solid obstacles: Pine Trees, Rocks, Ice Blocks, Snowmen
      if (obs.type === 'tree' || obs.type === 'rock' || obs.type === 'ice' || obs.type === 'snowman') {
        const minRadius = obs.radius + playerRadius;
        if (distSq < minRadius * minRadius) {
          return { hit: true, type: 'crash', obstacle: obs, cause: obs.type };
        }
      }

      // 2. Fallen Log: Horizontal barrier check
      if (obs.type === 'log') {
        const halfW = obs.width * 0.5;
        // Check if player is within log width and depth
        if (Math.abs(dx) < (halfW + playerRadius) && Math.abs(dz) < (obs.radius + playerRadius)) {
          // If player is airborne jumping high above the log, they clear it!
          if (py > obs.y + 0.9) {
            // Jumped over log safely!
          } else {
            return { hit: true, type: 'crash', obstacle: obs, cause: 'fallen log' };
          }
        }
      }

      // 3. Snow kicker ramp launch
      if (obs.type === 'ramp') {
        const rampDist = obs.radius + playerRadius;
        if (distSq < rampDist * rampDist) {
          return { hit: true, type: 'ramp', obstacle: obs, boostVy: obs.boostVy };
        }
      }

      // 4. Slalom gate clear
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
    // Clear all existing obstacles
    this.activeObstacles.forEach((obs) => {
      if (obs.mesh) this.scene.remove(obs.mesh);
    });
    this.activeObstacles = [];

    // Clear all existing coins
    this.activeCoins.forEach((coin) => {
      if (coin.mesh) this.scene.remove(coin.mesh);
    });
    this.activeCoins = [];

    // Remove existing chunks
    this.chunks.forEach((chunk) => {
      if (chunk.mesh) this.scene.remove(chunk.mesh);
    });
    this.chunks = [];

    // Rebuild initial chunks
    this.nextChunkZ = -this.CHUNK_LENGTH;
    for (let i = 0; i < this.CHUNK_COUNT; i++) {
      this.createChunk();
    }
  }
}
