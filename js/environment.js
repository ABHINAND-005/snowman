/**
 * Environment & Atmosphere for SNOWMAN
 * Creates winter sky, directional sun, atmospheric fog, distant mountain peaks,
 * falling snow particle simulation, and board carving spray effects.
 */

import * as THREE from 'three';

export class Environment {
  constructor(scene) {
    this.scene = scene;

    // References to dynamic systems
    this.snowParticles = null;
    this.snowSpraySystem = null;
    this.speedLinesSystem = null;
    this.sunLight = null;
    this.hemiLight = null;
    this.distantMountains = null;

    this.initLighting();
    this.initFogAndSky();
    this.initDistantMountains();
    this.initFallingSnow();
    this.initSnowSprayPool();
    this.initCoinSparklesPool();
    this.initNitroThrusterPool();
    this.initSpeedLines();
  }

  /**
   * Sets up cinematic winter lighting with soft directional shadows
   */
  initLighting() {
    // Hemispheric ambient light: icy sky blue from above, clean snow bounce from below
    this.hemiLight = new THREE.HemisphereLight(0xd4ebf8, 0xe8eff5, 0.65);
    this.hemiLight.position.set(0, 50, 0);
    this.scene.add(this.hemiLight);

    // Warm alpine sun low on the winter horizon
    this.sunLight = new THREE.DirectionalLight(0xfffaed, 1.25);
    this.sunLight.position.set(60, 120, -50);
    this.sunLight.castShadow = true;

    // Shadow map tuning for high visual quality
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 320;

    const d = 55;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.bias = -0.0006;

    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
  }

  /**
   * Atmospheric fog and background clearing color
   */
  initFogAndSky() {
    const fogColor = new THREE.Color(0xb8d4e8);
    this.scene.background = fogColor;
    this.scene.fog = new THREE.Fog(fogColor, 90, 480);
  }

  /**
   * Builds majestic low-poly mountain ranges on the distant horizon
   */
  initDistantMountains() {
    const mountainGroup = new THREE.Group();
    const count = 16;
    const radius = 420;

    // Create varied low-poly mountain peak geometries
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const dist = radius + (Math.sin(i * 3.5) * 50);
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;

      const peakHeight = 160 + (Math.sin(i * 2.3) * 60) + Math.random() * 30;
      const peakRadius = 70 + (Math.cos(i * 1.8) * 20);

      // Cone with randomized perturbed vertices for natural ridge formations
      const geom = new THREE.ConeGeometry(peakRadius, peakHeight, 7, 5);
      const posAttr = geom.attributes.position;

      for (let v = 0; v < posAttr.count; v++) {
        const py = posAttr.getY(v);
        // Perturb side vertices, keep peak point sharp
        if (py < peakHeight * 0.45) {
          const px = posAttr.getX(v);
          const pz = posAttr.getZ(v);
          posAttr.setX(v, px + (Math.random() - 0.5) * 12);
          posAttr.setZ(v, pz + (Math.random() - 0.5) * 12);
        }
      }
      geom.computeVertexNormals();

      // Dual-tone vertex colors or clean shaded material
      const mat = new THREE.MeshLambertMaterial({
        color: i % 2 === 0 ? 0x98b5c9 : 0x8ba6bc,
        flatShading: true
      });

      const peak = new THREE.Mesh(geom, mat);
      peak.position.set(x, peakHeight * 0.35 - 30, z);
      mountainGroup.add(peak);

      // Add a snow cap to higher peaks
      const capGeom = new THREE.ConeGeometry(peakRadius * 0.45, peakHeight * 0.4, 7);
      const capMat = new THREE.MeshLambertMaterial({
        color: 0xf5faff,
        flatShading: true
      });
      const cap = new THREE.Mesh(capGeom, capMat);
      cap.position.set(x, peakHeight * 0.7 - 28, z);
      mountainGroup.add(cap);
    }

    this.scene.add(mountainGroup);
    this.distantMountains = mountainGroup;
  }

  /**
   * High performance falling snow particle simulation
   */
  initFallingSnow() {
    const particleCount = 1800;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const velocities = new Float32Array(particleCount * 3);

    this.snowBoxWidth = 140;
    this.snowBoxHeight = 80;
    this.snowBoxDepth = 140;

    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * this.snowBoxWidth;
      positions[i3 + 1] = Math.random() * this.snowBoxHeight;
      positions[i3 + 2] = (Math.random() - 0.5) * this.snowBoxDepth;

      // Varied flutter velocities
      velocities[i3] = (Math.random() - 0.5) * 2.5;         // wind drift X
      velocities[i3 + 1] = -(4.5 + Math.random() * 4.5);    // fall speed Y
      velocities[i3 + 2] = -(1.5 + Math.random() * 2.5);    // mountain wind Z
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Snowflake texture generated procedurally on canvas
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.4, 'rgba(230, 245, 255, 0.8)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(16, 16, 16, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.9,
      map: texture,
      transparent: true,
      opacity: 0.85,
      blending: THREE.NormalBlending,
      depthWrite: false
    });

    this.snowParticles = new THREE.Points(geometry, material);
    this.snowParticlesVelocities = velocities;
    this.scene.add(this.snowParticles);
  }

  /**
   * Initializes zero-allocation particle pool for carving snow spray
   */
  initSnowSprayPool() {
    this.maxSprayParticles = 120;
    this.sprayIndex = 0;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.maxSprayParticles * 3);
    const scales = new Float32Array(this.maxSprayParticles);

    // Initial pool coordinates far below scene
    for (let i = 0; i < this.maxSprayParticles; i++) {
      positions[i * 3 + 1] = -9999;
      scales[i] = 0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(scales, 1));

    const material = new THREE.PointsMaterial({
      color: 0xe2f3fc,
      size: 1.4,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.sprayMesh = new THREE.Points(geometry, material);
    this.scene.add(this.sprayMesh);

    // Store particle physical state
    this.sprayPool = [];
    for (let i = 0; i < this.maxSprayParticles; i++) {
      this.sprayPool.push({
        active: false,
        x: 0, y: -9999, z: 0,
        vx: 0, vy: 0, vz: 0,
        life: 0,
        maxLife: 0.6,
        size: 1.2
      });
    }
  }

  /**
   * Emits dynamic snow powder spray at the board tail
   */
  emitSpray(pos, lateralVelocity, intensity = 1) {
    const burstCount = Math.min(Math.floor(intensity * 4) + 1, 6);

    for (let b = 0; b < burstCount; b++) {
      const p = this.sprayPool[this.sprayIndex];
      p.active = true;
      p.life = 0;
      p.maxLife = 0.35 + Math.random() * 0.35;
      p.x = pos.x + (Math.random() - 0.5) * 0.4;
      p.y = pos.y + 0.15;
      p.z = pos.z - 0.4 + (Math.random() - 0.5) * 0.3;

      // Spray shoots outward opposite to carve direction
      const sprayAngle = lateralVelocity > 0 ? -1 : 1;
      p.vx = (sprayAngle * (2.5 + Math.random() * 4.5)) + (Math.random() - 0.5);
      p.vy = 1.8 + Math.random() * 2.8;
      p.vz = (Math.random() - 0.5) * 2;
      p.size = 1.2 + Math.random() * 1.5;

      this.sprayIndex = (this.sprayIndex + 1) % this.maxSprayParticles;
    }
  }

  /**
   * Initializes zero-allocation particle pool for coin sparkle effects
   */
  initCoinSparklesPool() {
    this.maxSparkles = 90;
    this.sparkleIndex = 0;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.maxSparkles * 3);
    const colors = new Float32Array(this.maxSparkles * 3);
    const sizes = new Float32Array(this.maxSparkles);

    for (let i = 0; i < this.maxSparkles; i++) {
      positions[i * 3 + 1] = -9999;
      colors[i * 3] = 1.0;
      colors[i * 3 + 1] = 0.85;
      colors[i * 3 + 2] = 0.2;
      sizes[i] = 0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 1.8,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.sparklesMesh = new THREE.Points(geometry, material);
    this.scene.add(this.sparklesMesh);

    this.sparklesPool = [];
    for (let i = 0; i < this.maxSparkles; i++) {
      this.sparklesPool.push({
        active: false,
        x: 0, y: -9999, z: 0,
        vx: 0, vy: 0, vz: 0,
        life: 0,
        maxLife: 0.55,
        size: 1.8
      });
    }
  }

  /**
   * Emits golden sparkle explosion upon collecting a coin
   */
  emitCoinSparkles(pos) {
    const count = 14;
    for (let i = 0; i < count; i++) {
      const p = this.sparklesPool[this.sparkleIndex];
      p.active = true;
      p.life = 0;
      p.maxLife = 0.45 + Math.random() * 0.3;
      p.x = pos.x;
      p.y = pos.y + 0.5;
      p.z = pos.z;

      // Radial burst outwards
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;
      const speed = 3.5 + Math.random() * 5.5;

      p.vx = Math.cos(phi) * Math.cos(theta) * speed;
      p.vy = Math.sin(phi) * speed + 2.5; // upward bias
      p.vz = Math.cos(phi) * Math.sin(theta) * speed;
      p.size = 1.6 + Math.random() * 1.6;

      this.sparkleIndex = (this.sparkleIndex + 1) % this.maxSparkles;
    }
  }

  /**
   * Emits a violent snow blast when crashing into an obstacle
   */
  emitCrashBlast(pos) {
    const count = 28;
    for (let i = 0; i < count; i++) {
      const p = this.sprayPool[this.sprayIndex];
      p.active = true;
      p.life = 0;
      p.maxLife = 0.6 + Math.random() * 0.4;
      p.x = pos.x + (Math.random() - 0.5) * 0.6;
      p.y = pos.y + 0.3 + Math.random() * 0.8;
      p.z = pos.z + (Math.random() - 0.5) * 0.6;

      const angle = Math.random() * Math.PI * 2;
      const blastSpeed = 5.0 + Math.random() * 8.0;
      p.vx = Math.cos(angle) * blastSpeed;
      p.vy = 4.0 + Math.random() * 6.0;
      p.vz = Math.sin(angle) * blastSpeed;
      p.size = 2.0 + Math.random() * 2.2;

      this.sprayIndex = (this.sprayIndex + 1) % this.maxSprayParticles;
    }
  }

  /**
   * Initializes zero-allocation particle pool for supersonic Nitro thruster flames
   */
  initNitroThrusterPool() {
    this.maxNitroParticles = 80;
    this.nitroIndex = 0;

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.maxNitroParticles * 3);
    const colors = new Float32Array(this.maxNitroParticles * 3);
    const sizes = new Float32Array(this.maxNitroParticles);

    for (let i = 0; i < this.maxNitroParticles; i++) {
      positions[i * 3 + 1] = -9999;
      // Electric cyan / azure glow colors
      colors[i * 3] = 0.0;
      colors[i * 3 + 1] = 0.94;
      colors[i * 3 + 2] = 1.0;
      sizes[i] = 0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 2.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.nitroMesh = new THREE.Points(geometry, material);
    this.scene.add(this.nitroMesh);

    this.nitroPool = [];
    for (let i = 0; i < this.maxNitroParticles; i++) {
      this.nitroPool.push({
        active: false,
        x: 0, y: -9999, z: 0,
        vx: 0, vy: 0, vz: 0,
        life: 0,
        maxLife: 0.45,
        size: 2.2
      });
    }
  }

  /**
   * Emits rocket thruster flame exhaust behind the snowboard during nitro boost
   */
  emitNitroThruster(pos, lateralVel) {
    const burstCount = 4;
    for (let b = 0; b < burstCount; b++) {
      const p = this.nitroPool[this.nitroIndex];
      p.active = true;
      p.life = 0;
      p.maxLife = 0.28 + Math.random() * 0.18;
      // Emit from tail of the board
      p.x = pos.x + (Math.random() - 0.5) * 0.35;
      p.y = pos.y + 0.12 + Math.random() * 0.15;
      p.z = pos.z - 1.1 + (Math.random() - 0.5) * 0.2;

      // Shoot backward with violent velocity
      p.vx = -lateralVel * 0.2 + (Math.random() - 0.5) * 1.5;
      p.vy = 0.5 + Math.random() * 1.2;
      p.vz = -(12.0 + Math.random() * 16.0);
      p.size = 2.4 + Math.random() * 1.8;

      this.nitroIndex = (this.nitroIndex + 1) % this.maxNitroParticles;
    }
  }

  /**
   * Speed lines system for high speed sensation
   */
  initSpeedLines() {
    this.speedLineCount = 40;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.speedLineCount * 6); // 2 vertices per line

    for (let i = 0; i < this.speedLineCount; i++) {
      const idx = i * 6;
      positions[idx] = 0;
      positions[idx + 1] = -999;
      positions[idx + 2] = 0;
      positions[idx + 3] = 0;
      positions[idx + 4] = -999;
      positions[idx + 5] = 0;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      linewidth: 1
    });

    this.speedLinesMesh = new THREE.LineSegments(geometry, material);
    this.scene.add(this.speedLinesMesh);

    this.speedLinesData = [];
    for (let i = 0; i < this.speedLineCount; i++) {
      this.speedLinesData.push({
        x: (Math.random() - 0.5) * 16,
        y: (Math.random() - 0.5) * 10,
        z: (Math.random() - 0.5) * 25,
        speed: 40 + Math.random() * 30
      });
    }
  }

  /**
   * Main per-frame update loop for atmospheric systems
   * @param {number} delta - Frame delta time in seconds
   * @param {THREE.Vector3} playerPos - Current player position
   * @param {number} playerSpeed - Current speed in m/s
   * @param {boolean} isTucking - Whether aerodynamic tuck is active
   */
  update(delta, playerPos, playerSpeed, isTucking) {
    // 1. Follow Sun Light with smooth position offset
    if (this.sunLight && playerPos) {
      this.sunLight.position.set(
        playerPos.x + 55,
        playerPos.y + 110,
        playerPos.z - 45
      );
      this.sunLight.target.position.copy(playerPos);
      this.sunLight.target.updateMatrixWorld();
    }

    // 2. Keep distant mountain silhouettes anchored relative to player Z
    if (this.distantMountains && playerPos) {
      this.distantMountains.position.x = playerPos.x * 0.15;
      this.distantMountains.position.y = playerPos.y * 0.15;
      this.distantMountains.position.z = playerPos.z;
    }

    // 3. Update Falling Snow Particles (centered around player)
    if (this.snowParticles && playerPos) {
      const posAttr = this.snowParticles.geometry.attributes.position;
      const positions = posAttr.array;
      const velocities = this.snowParticlesVelocities;
      const count = positions.length / 3;

      const halfW = this.snowBoxWidth * 0.5;
      const halfH = this.snowBoxHeight * 0.5;
      const halfD = this.snowBoxDepth * 0.5;

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;

        // Apply velocities with subtle wind oscillations
        positions[i3] += velocities[i3] * delta;
        positions[i3 + 1] += velocities[i3 + 1] * delta;
        positions[i3 + 2] += (velocities[i3 + 2] - playerSpeed * 0.4) * delta;

        // Relative bounds check around player
        const dx = positions[i3] - playerPos.x;
        const dy = positions[i3 + 1] - playerPos.y;
        const dz = positions[i3 + 2] - playerPos.z;

        if (dy < -halfH) positions[i3 + 1] = playerPos.y + halfH;
        if (dy > halfH) positions[i3 + 1] = playerPos.y - halfH;

        if (dx < -halfW) positions[i3] = playerPos.x + halfW;
        if (dx > halfW) positions[i3] = playerPos.x - halfW;

        if (dz < -halfD) positions[i3 + 2] = playerPos.z + halfD;
        if (dz > halfD) positions[i3 + 2] = playerPos.z - halfD;
      }
      posAttr.needsUpdate = true;
    }

    // 4. Update Snow Spray Particles
    if (this.sprayMesh) {
      const posAttr = this.sprayMesh.geometry.attributes.position;
      const sizeAttr = this.sprayMesh.geometry.attributes.size;
      const positions = posAttr.array;
      const sizes = sizeAttr.array;

      for (let i = 0; i < this.maxSprayParticles; i++) {
        const p = this.sprayPool[i];
        if (p.active) {
          p.life += delta;
          if (p.life >= p.maxLife) {
            p.active = false;
            positions[i * 3 + 1] = -9999;
            sizes[i] = 0;
          } else {
            // Gravity & drag on snow spray
            p.vy -= 9.8 * delta;
            p.vx *= 0.95;
            p.vz *= 0.95;

            p.x += p.vx * delta;
            p.y += p.vy * delta;
            p.z += p.vz * delta;

            positions[i * 3] = p.x;
            positions[i * 3 + 1] = p.y;
            positions[i * 3 + 2] = p.z;

            // Fade size as particle disperses
            const lifeRatio = 1 - (p.life / p.maxLife);
            sizes[i] = p.size * lifeRatio;
          }
        }
      }
      posAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;
    }

    // 4b. Update Coin Sparkles Particles
    if (this.sparklesMesh) {
      const posAttr = this.sparklesMesh.geometry.attributes.position;
      const sizeAttr = this.sparklesMesh.geometry.attributes.size;
      const positions = posAttr.array;
      const sizes = sizeAttr.array;

      for (let i = 0; i < this.maxSparkles; i++) {
        const p = this.sparklesPool[i];
        if (p.active) {
          p.life += delta;
          if (p.life >= p.maxLife) {
            p.active = false;
            positions[i * 3 + 1] = -9999;
            sizes[i] = 0;
          } else {
            p.vy -= 9.8 * delta; // slight gravity pull
            p.vx *= 0.96;
            p.vz *= 0.96;

            p.x += p.vx * delta;
            p.y += p.vy * delta;
            p.z += p.vz * delta;

            positions[i * 3] = p.x;
            positions[i * 3 + 1] = p.y;
            positions[i * 3 + 2] = p.z;

            // Sparkle twinkle
            const lifeRatio = 1 - (p.life / p.maxLife);
            sizes[i] = p.size * lifeRatio * (0.8 + Math.sin(p.life * 25) * 0.2);
          }
        }
      }
      posAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;
    }

    // 4c. Update Nitro Thruster Particles
    if (this.nitroMesh) {
      const posAttr = this.nitroMesh.geometry.attributes.position;
      const sizeAttr = this.nitroMesh.geometry.attributes.size;
      const positions = posAttr.array;
      const sizes = sizeAttr.array;

      for (let i = 0; i < this.maxNitroParticles; i++) {
        const p = this.nitroPool[i];
        if (p.active) {
          p.life += delta;
          if (p.life >= p.maxLife) {
            p.active = false;
            positions[i * 3 + 1] = -9999;
            sizes[i] = 0;
          } else {
            p.x += p.vx * delta;
            p.y += p.vy * delta;
            p.z += p.vz * delta;

            positions[i * 3] = p.x;
            positions[i * 3 + 1] = p.y;
            positions[i * 3 + 2] = p.z;

            const lifeRatio = 1 - (p.life / p.maxLife);
            sizes[i] = p.size * lifeRatio;
          }
        }
      }
      posAttr.needsUpdate = true;
      sizeAttr.needsUpdate = true;
    }

    // 5. Update Wind / Speed Lines (Visible when fast or tucking)
    if (this.speedLinesMesh && playerPos) {
      const isHighSpeed = playerSpeed > 18 || isTucking;
      const targetOpacity = isHighSpeed ? Math.min((playerSpeed - 18) / 12, 0.45) : 0;
      this.speedLinesMesh.material.opacity += (targetOpacity - this.speedLinesMesh.material.opacity) * 0.15;

      if (this.speedLinesMesh.material.opacity > 0.02) {
        const posAttr = this.speedLinesMesh.geometry.attributes.position;
        const positions = posAttr.array;

        for (let i = 0; i < this.speedLineCount; i++) {
          const s = this.speedLinesData[i];
          s.z -= (s.speed + playerSpeed * 1.5) * delta;

          // Wrap speed lines around camera
          if (s.z < -20) {
            s.z = 25 + Math.random() * 10;
            s.x = (Math.random() - 0.5) * 18;
            s.y = (Math.random() - 0.5) * 10;
          }

          const idx = i * 6;
          const startX = playerPos.x + s.x;
          const startY = playerPos.y + s.y + 1.2;
          const startZ = playerPos.z + s.z;

          // Line segment starts here, extends backward along velocity
          positions[idx] = startX;
          positions[idx + 1] = startY;
          positions[idx + 2] = startZ;

          positions[idx + 3] = startX;
          positions[idx + 4] = startY;
          positions[idx + 5] = startZ + 3.2;
        }
        posAttr.needsUpdate = true;
      }
    }
  }
}
