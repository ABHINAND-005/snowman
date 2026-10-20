/**
 * Terrain Manager for SNOWMAN
 * Generates an endless, seamless downhill ski mountain slope.
 * Features chunk recycling, obstacle spawning (pine trees, boulders, slalom gates, kickers),
 * and precision height / normal queries for physics.
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

    // Track active chunks
    this.chunks = [];
    this.activeObstacles = [];
    this.nextChunkZ = -this.CHUNK_LENGTH; // Starts slightly behind initial player

    // Shared materials & geometries for optimal memory & zero allocations
    this.initSharedAssets();

    // Generate initial terrain chunks
    for (let i = 0; i < this.CHUNK_COUNT; i++) {
      this.createChunk();
    }
  }

  /**
   * Caches reusable materials and base obstacle geometries
   */
  initSharedAssets() {
    // Crisp alpine snow material with soft specular glint
    this.snowMaterial = new THREE.MeshStandardMaterial({
      color: 0xf2f7fc,
      roughness: 0.85,
      metalness: 0.05,
      flatShading: false
    });

    // Rock material
    this.rockMaterial = new THREE.MeshLambertMaterial({
      color: 0x485563,
      flatShading: true
    });
    this.rockCapMaterial = new THREE.MeshLambertMaterial({
      color: 0xf5faff,
      flatShading: true
    });

    // Tree materials
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

    // Slalom flag materials
    this.flagRedMat = new THREE.MeshLambertMaterial({ color: 0xff3b30 });
    this.flagBlueMat = new THREE.MeshLambertMaterial({ color: 0x007aff });
    this.poleMat = new THREE.MeshLambertMaterial({ color: 0xffffff });

    // Kicker ramp material
    this.rampMat = new THREE.MeshStandardMaterial({
      color: 0xd9eaf7,
      roughness: 0.6
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
      obstacles: []
    };

    // Position vertices
    this.updateChunkVertices(chunkData);
    this.scene.add(chunkMesh);

    // Spawn trees, rocks, ramps, and slalom gates for this chunk
    this.spawnChunkObstacles(chunkData);

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

      // Local mesh Y coordinate
      pos.setY(i, worldY);
    }

    geometry.computeVertexNormals();
    pos.needsUpdate = true;
  }

  /**
   * Spawns scenic low-poly trees, boulders, kickers, and slalom gates on a chunk
   */
  spawnChunkObstacles(chunkData) {
    const zStart = chunkData.zStart;
    const zEnd = chunkData.zEnd;

    // Skip spawning on the very first starting plateau (z < 60) to give player a clean start
    if (zStart < 60) return;

    // 1. Dense Pine Trees along side powder banks + scattered in fairway
    const treeCount = 14 + Math.floor(Math.random() * 6);
    for (let i = 0; i < treeCount; i++) {
      let x;
      // Most trees are placed on the mountain sides, some on the run
      if (Math.random() < 0.75) {
        const side = Math.random() < 0.5 ? -1 : 1;
        x = side * (this.RUN_HALF_WIDTH + 2 + Math.random() * 28);
      } else {
        x = (Math.random() - 0.5) * (this.RUN_HALF_WIDTH * 1.5);
      }

      const z = zStart + 5 + Math.random() * (this.CHUNK_LENGTH - 10);
      const y = this.getHeight(x, z);

      const treeGroup = this.createPineTree();
      treeGroup.position.set(x, y, z);
      this.scene.add(treeGroup);

      const obs = {
        type: 'tree',
        mesh: treeGroup,
        x, y, z,
        radius: 1.15
      };
      chunkData.obstacles.push(obs);
      this.activeObstacles.push(obs);
    }

    // 2. Jagged Snow-Covered Boulders
    const rockCount = 5 + Math.floor(Math.random() * 5);
    for (let i = 0; i < rockCount; i++) {
      const x = (Math.random() - 0.5) * (this.RUN_HALF_WIDTH * 1.6);
      const z = zStart + 8 + Math.random() * (this.CHUNK_LENGTH - 16);
      const y = this.getHeight(x, z);

      const rockGroup = this.createRock();
      rockGroup.position.set(x, y, z);
      this.scene.add(rockGroup);

      const obs = {
        type: 'rock',
        mesh: rockGroup,
        x, y, z,
        radius: 1.3
      };
      chunkData.obstacles.push(obs);
      this.activeObstacles.push(obs);
    }

    // 3. Snow Kicker Ramps (Jump launches)
    if (Math.random() < 0.6) {
      const rx = (Math.random() - 0.5) * (this.RUN_HALF_WIDTH * 0.9);
      const rz = zStart + 20 + Math.random() * (this.CHUNK_LENGTH - 40);
      const ry = this.getHeight(rx, rz);

      const rampMesh = this.createKickerRamp();
      rampMesh.position.set(rx, ry + 0.4, rz);
      this.scene.add(rampMesh);

      const obs = {
        type: 'ramp',
        mesh: rampMesh,
        x: rx, y: ry, z: rz,
        radius: 2.2,
        boostVy: 16.5 // Launches rider upward with high impulse
      };
      chunkData.obstacles.push(obs);
      this.activeObstacles.push(obs);
    }

    // 4. Slalom Gates (Pairs of Red/Blue flags for bonus points)
    if (Math.random() < 0.7) {
      const gateX = (Math.random() - 0.5) * (this.RUN_HALF_WIDTH * 0.8);
      const gateZ = zStart + 45;
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
  }

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

  /**
   * Recycles oldest terrain chunk when rider progresses forward.
   * Keeps active terrain ahead with zero memory leaks.
   */
  update(playerZ) {
    // Check if player has passed the first chunk
    if (this.chunks.length > 0) {
      const firstChunk = this.chunks[0];
      // When rider is well past the end of the first chunk
      if (playerZ > firstChunk.zEnd + 30) {
        // Remove old obstacles from scene and active list
        firstChunk.obstacles.forEach((obs) => {
          if (obs.mesh) this.scene.remove(obs.mesh);
          const idx = this.activeObstacles.indexOf(obs);
          if (idx !== -1) this.activeObstacles.splice(idx, 1);
        });
        firstChunk.obstacles = [];

        // Reposition chunk to the far front
        firstChunk.zStart = this.nextChunkZ;
        firstChunk.zEnd = this.nextChunkZ + this.CHUNK_LENGTH;
        this.nextChunkZ += this.CHUNK_LENGTH;

        // Recompute vertices seamlessly
        this.updateChunkVertices(firstChunk);

        // Spawn new obstacles
        this.spawnChunkObstacles(firstChunk);

        // Move first chunk to back of queue
        this.chunks.shift();
        this.chunks.push(firstChunk);
      }
    }
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

      // Check tree or rock crash
      if (obs.type === 'tree' || obs.type === 'rock') {
        const minRadius = obs.radius + playerRadius;
        if (distSq < minRadius * minRadius) {
          return { hit: true, type: 'crash', obstacle: obs };
        }
      }

      // Check snow kicker ramp launch
      if (obs.type === 'ramp') {
        const rampDist = obs.radius + playerRadius;
        if (distSq < rampDist * rampDist) {
          return { hit: true, type: 'ramp', obstacle: obs, boostVy: obs.boostVy };
        }
      }

      // Check slalom gate clear
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
