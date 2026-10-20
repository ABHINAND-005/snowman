/**
 * Snowboarder Character & Physics Engine for SNOWMAN
 * Constructs a low-poly male snowboarder (jacket, pants, helmet, goggles, board, bindings)
 * and handles downhill kinematics, carving, aerodynamic tucking, jumping, and collision response.
 */

import * as THREE from 'three';

export class Player {
  constructor(scene, terrain, soundEngine) {
    this.scene = scene;
    this.terrain = terrain;
    this.sound = soundEngine;

    // Movement physics parameters
    this.speed = 12; // Initial forward speed (m/s)
    this.baseMaxSpeed = 20; // ~72 km/h standard glide
    this.tuckedMaxSpeed = 28; // ~100 km/h in aero tuck
    this.acceleration = 7.5; // Downhill gravity pull
    this.turnSpeed = 16.0; // Lateral carving agility
    this.jumpForce = 13.5; // Vertical jump impulse (m/s)
    this.gravity = 28.0; // Snappy arcade gravity

    // State variables
    this.position = new THREE.Vector3(0, 0, 0);
    this.velocity = new THREE.Vector3(0, 0, this.speed);
    this.lateralVelocity = 0;
    this.verticalVelocity = 0;
    this.isGrounded = true;
    this.isTucking = false;
    this.isJumping = false;
    this.airTime = 0;
    this.totalAirTime = 0;
    this.isCrashed = false;

    // Visual animation states
    this.carveRoll = 0;
    this.tuckProgress = 0;
    this.landingSquat = 0;

    // Input state
    this.keys = {
      left: false,
      right: false,
      tuck: false,
      jump: false
    };

    // Build the 3D snowboarder mesh hierarchy
    this.mesh = new THREE.Group();
    this.buildSnowboarder();
    this.scene.add(this.mesh);

    // Initial positioning on the mountain
    this.reset(0, 0);
  }

  /**
   * Constructs the stylized low-poly male snowboarder model
   */
  buildSnowboarder() {
    // -------------------------------------------------------------
    // 1. Materials
    // -------------------------------------------------------------
    // Snowboard deck with vibrant alpine graphic
    const boardDeckMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.35,
      metalness: 0.2
    });
    const boardStripeMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      roughness: 0.2,
      metalness: 0.4
    });
    const bindingMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.7
    });

    // Rider clothing materials
    const jacketMat = new THREE.MeshLambertMaterial({ color: 0x0284c7 }); // Vibrant alpine cyan/blue
    const jacketDarkMat = new THREE.MeshLambertMaterial({ color: 0x0f172a }); // Charcoal accents
    const pantsMat = new THREE.MeshLambertMaterial({ color: 0xe11d48 }); // High-visibility alpine red/crimson
    const bootsMat = new THREE.MeshLambertMaterial({ color: 0x1e293b });
    const mittensMat = new THREE.MeshLambertMaterial({ color: 0x0f172a });
    const helmetMat = new THREE.MeshStandardMaterial({ color: 0x090e17, roughness: 0.4 });
    const goggleVisorMat = new THREE.MeshStandardMaterial({
      color: 0xffd166,
      roughness: 0.1,
      metalness: 0.95
    });

    // -------------------------------------------------------------
    // 2. Snowboard Mesh Hierarchy
    // -------------------------------------------------------------
    this.boardGroup = new THREE.Group();

    // Central board body
    const deckGeom = new THREE.BoxGeometry(0.48, 0.045, 1.9);
    const deckMesh = new THREE.Mesh(deckGeom, boardDeckMat);
    deckMesh.castShadow = true;
    deckMesh.receiveShadow = true;
    this.boardGroup.add(deckMesh);

    // Top racing stripe
    const stripeGeom = new THREE.BoxGeometry(0.18, 0.05, 1.85);
    const stripeMesh = new THREE.Mesh(stripeGeom, boardStripeMat);
    stripeMesh.position.y = 0.005;
    this.boardGroup.add(stripeMesh);

    // Curved nose tip (front)
    const noseGeom = new THREE.BoxGeometry(0.44, 0.04, 0.3);
    const noseMesh = new THREE.Mesh(noseGeom, boardDeckMat);
    noseMesh.position.set(0, 0.06, 1.02);
    noseMesh.rotation.x = -0.35; // curved upward
    this.boardGroup.add(noseMesh);

    // Curved tail tip (back)
    const tailGeom = new THREE.BoxGeometry(0.44, 0.04, 0.3);
    const tailMesh = new THREE.Mesh(tailGeom, boardDeckMat);
    tailMesh.position.set(0, 0.06, -1.02);
    tailMesh.rotation.x = 0.35; // curved upward
    this.boardGroup.add(tailMesh);

    // Bindings (Duck stance: front +15 deg, rear -10 deg)
    const frontBinding = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.28), bindingMat);
    frontBinding.position.set(0, 0.05, 0.48);
    frontBinding.rotation.y = 0.26;
    this.boardGroup.add(frontBinding);

    const rearBinding = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.08, 0.28), bindingMat);
    rearBinding.position.set(0, 0.05, -0.48);
    rearBinding.rotation.y = -0.18;
    this.boardGroup.add(rearBinding);

    this.mesh.add(this.boardGroup);

    // -------------------------------------------------------------
    // 3. Snowboarder Character Mesh Hierarchy
    // -------------------------------------------------------------
    this.riderGroup = new THREE.Group();
    // Default snowboard stance: rider body angled ~50 degrees to the board
    this.riderGroup.rotation.y = Math.PI * 0.28;

    // Boots
    const bootGeom = new THREE.BoxGeometry(0.2, 0.2, 0.36);
    this.leftBoot = new THREE.Mesh(bootGeom, bootsMat);
    this.leftBoot.position.set(-0.06, 0.12, 0.48);
    this.leftBoot.rotation.y = 0.26;
    this.riderGroup.add(this.leftBoot);

    this.rightBoot = new THREE.Mesh(bootGeom, bootsMat);
    this.rightBoot.position.set(0.06, 0.12, -0.48);
    this.rightBoot.rotation.y = -0.18;
    this.riderGroup.add(this.rightBoot);

    // Legs / Pants (bent knees athletic stance)
    this.legsGroup = new THREE.Group();
    this.legsGroup.position.set(0, 0.2, 0);

    const legGeom = new THREE.CylinderGeometry(0.12, 0.14, 0.65, 6);

    this.leftLeg = new THREE.Mesh(legGeom, pantsMat);
    this.leftLeg.position.set(-0.08, 0.32, 0.4);
    this.leftLeg.rotation.z = -0.1;
    this.leftLeg.rotation.x = 0.15;
    this.leftLeg.castShadow = true;
    this.legsGroup.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeom, pantsMat);
    this.rightLeg.position.set(0.08, 0.32, -0.4);
    this.rightLeg.rotation.z = 0.1;
    this.rightLeg.rotation.x = -0.15;
    this.rightLeg.castShadow = true;
    this.legsGroup.add(this.rightLeg);

    this.riderGroup.add(this.legsGroup);

    // Upper Body / Torso
    this.torsoGroup = new THREE.Group();
    this.torsoGroup.position.set(0, 0.78, 0);

    // Jacket Body
    const jacketGeom = new THREE.BoxGeometry(0.55, 0.62, 0.34);
    this.jacketMesh = new THREE.Mesh(jacketGeom, jacketMat);
    this.jacketMesh.position.y = 0.3;
    this.jacketMesh.castShadow = true;
    this.torsoGroup.add(this.jacketMesh);

    // Dark shoulder yoke & collar
    const collarGeom = new THREE.BoxGeometry(0.56, 0.16, 0.35);
    const collar = new THREE.Mesh(collarGeom, jacketDarkMat);
    collar.position.y = 0.54;
    this.torsoGroup.add(collar);

    // Arms & Mittens
    const armGeom = new THREE.CylinderGeometry(0.08, 0.09, 0.52, 6);
    const mittenGeom = new THREE.BoxGeometry(0.14, 0.16, 0.14);

    // Left Arm (extended back for freeride balance)
    this.leftArmGroup = new THREE.Group();
    this.leftArmGroup.position.set(-0.32, 0.48, 0);
    this.leftArm = new THREE.Mesh(armGeom, jacketMat);
    this.leftArm.position.y = -0.22;
    this.leftArm.rotation.z = 0.45;
    this.leftArmGroup.add(this.leftArm);
    const leftMitten = new THREE.Mesh(mittenGeom, mittensMat);
    leftMitten.position.set(-0.1, -0.48, 0);
    this.leftArmGroup.add(leftMitten);
    this.torsoGroup.add(this.leftArmGroup);

    // Right Arm (extended forward for balance)
    this.rightArmGroup = new THREE.Group();
    this.rightArmGroup.position.set(0.32, 0.48, 0);
    this.rightArm = new THREE.Mesh(armGeom, jacketMat);
    this.rightArm.position.y = -0.22;
    this.rightArm.rotation.z = -0.45;
    this.rightArmGroup.add(this.rightArm);
    const rightMitten = new THREE.Mesh(mittenGeom, mittensMat);
    rightMitten.position.set(0.1, -0.48, 0);
    this.rightArmGroup.add(rightMitten);
    this.torsoGroup.add(this.rightArmGroup);

    // Head, Helmet & Snow Goggles
    this.headGroup = new THREE.Group();
    this.headGroup.position.set(0, 0.68, 0);
    // Turn head to look straight down the mountain (cancelling body rotation angle)
    this.headGroup.rotation.y = -Math.PI * 0.28;

    // Helmet
    const helmetGeom = new THREE.SphereGeometry(0.25, 8, 8);
    const helmetMesh = new THREE.Mesh(helmetGeom, helmetMat);
    helmetMesh.position.y = 0.15;
    helmetMesh.castShadow = true;
    this.headGroup.add(helmetMesh);

    // Goggles (Curved Visor with shiny mirrored gold finish)
    const goggleGeom = new THREE.BoxGeometry(0.28, 0.11, 0.14);
    const goggleMesh = new THREE.Mesh(goggleGeom, goggleVisorMat);
    goggleMesh.position.set(0, 0.15, 0.19);
    this.headGroup.add(goggleMesh);

    this.torsoGroup.add(this.headGroup);
    this.riderGroup.add(this.torsoGroup);

    this.mesh.add(this.riderGroup);
  }

  /**
   * Resets player state to clean spawn on the mountain
   */
  reset(x = 0, z = 0) {
    this.position.set(x, this.terrain.getHeight(x, z), z);
    this.velocity.set(0, 0, 10);
    this.lateralVelocity = 0;
    this.verticalVelocity = 0;
    this.isGrounded = true;
    this.isTucking = false;
    this.isJumping = false;
    this.airTime = 0;
    this.totalAirTime = 0;
    this.isCrashed = false;
    this.carveRoll = 0;
    this.tuckProgress = 0;
    this.landingSquat = 0;

    // Reset mesh transforms
    this.mesh.position.copy(this.position);
    this.mesh.rotation.set(0, 0, 0);
    this.boardGroup.rotation.set(0, 0, 0);
    this.torsoGroup.position.set(0, 0.78, 0);
    this.torsoGroup.rotation.set(0, 0, 0);
    this.riderGroup.rotation.set(0, Math.PI * 0.28, 0);
  }

  /**
   * Updates player inputs from keyboard manager
   */
  setInputs(left, right, tuck, jump) {
    this.keys.left = left;
    this.keys.right = right;
    this.keys.tuck = tuck;
    this.keys.jump = jump;
  }

  /**
   * Triggers a vertical ollie / jump
   */
  jump() {
    if (this.isGrounded && !this.isCrashed) {
      this.isGrounded = false;
      this.isJumping = true;
      this.verticalVelocity = this.jumpForce;
      this.airTime = 0;
      this.sound.playJump();
    }
  }

  /**
   * Triggers a crash / wipeout sequence
   */
  crash() {
    if (this.isCrashed) return;
    this.isCrashed = true;
    this.sound.playCrash();
    this.sound.silenceLoops();

    // Ragdoll tumble effect
    this.verticalVelocity = 5.0;
    this.lateralVelocity += (Math.random() - 0.5) * 8.0;
  }

  /**
   * Main per-frame physics & animation update
   * @param {number} delta - Frame delta time in seconds
   */
  update(delta) {
    // -------------------------------------------------------------
    // 1. Crash State Animation
    // -------------------------------------------------------------
    if (this.isCrashed) {
      this.verticalVelocity -= this.gravity * delta;
      this.position.y += this.verticalVelocity * delta;
      this.position.z += this.velocity.z * 0.4 * delta;
      this.position.x += this.lateralVelocity * delta;

      // Friction stops the tumble
      this.velocity.z = Math.max(0, this.velocity.z - 15 * delta);
      this.lateralVelocity *= 0.94;

      const groundY = this.terrain.getHeight(this.position.x, this.position.z);
      if (this.position.y < groundY + 0.2) {
        this.position.y = groundY + 0.2;
        this.verticalVelocity = 0;
      }

      // Tumble rotation
      this.riderGroup.rotation.x += 4.5 * delta;
      this.riderGroup.rotation.z += 3.2 * delta;
      this.boardGroup.rotation.y += 5.0 * delta;

      this.mesh.position.copy(this.position);
      return;
    }

    // -------------------------------------------------------------
    // 2. Tucking & Speed Acceleration
    // -------------------------------------------------------------
    this.isTucking = this.keys.tuck;
    const targetMaxSpeed = this.isTucking ? this.tuckedMaxSpeed : this.baseMaxSpeed;

    // Downhill acceleration
    if (this.velocity.z < targetMaxSpeed) {
      const accelRate = this.isTucking ? this.acceleration * 1.4 : this.acceleration;
      this.velocity.z = Math.min(this.velocity.z + accelRate * delta, targetMaxSpeed);
    } else if (this.velocity.z > targetMaxSpeed) {
      // Gentle air resistance deceleration when releasing tuck
      this.velocity.z -= 6.0 * delta;
    }

    // -------------------------------------------------------------
    // 3. Lateral Steering & Carving
    // -------------------------------------------------------------
    let steerDir = 0;
    if (this.keys.left) steerDir -= 1;
    if (this.keys.right) steerDir += 1;

    // Apply lateral acceleration
    const targetLatVel = steerDir * this.turnSpeed;
    this.lateralVelocity += (targetLatVel - this.lateralVelocity) * 12.0 * delta;
    this.position.x += this.lateralVelocity * delta;

    // Forward progression
    this.position.z += this.velocity.z * delta;

    // -------------------------------------------------------------
    // 4. Vertical Physics & Ground Following
    // -------------------------------------------------------------
    const groundY = this.terrain.getHeight(this.position.x, this.position.z);

    // Check jump input
    if (this.keys.jump && this.isGrounded) {
      this.jump();
    }

    if (!this.isGrounded) {
      // Airborne: apply gravity
      this.verticalVelocity -= this.gravity * delta;
      this.position.y += this.verticalVelocity * delta;
      this.airTime += delta;
      this.totalAirTime += delta;

      // Landing check
      if (this.position.y <= groundY) {
        this.position.y = groundY;
        this.isGrounded = true;
        this.isJumping = false;

        // Landing shock absorption squat
        const impact = Math.abs(this.verticalVelocity);
        this.landingSquat = Math.min(impact * 0.04, 0.4);
        this.sound.playLanding(Math.min(impact / 15, 1));

        // Reward air-time bonus if significant air
        if (this.airTime > 0.45) {
          const bonus = Math.round(this.airTime * 400);
          this.sound.playAirReward();
          window.dispatchEvent(new CustomEvent('snowman_airbonus', {
            detail: { bonus, airTime: this.airTime }
          }));
        }

        this.verticalVelocity = 0;
        this.airTime = 0;
      }
    } else {
      // Glued to terrain surface
      this.position.y = groundY;
    }

    // -------------------------------------------------------------
    // 5. Procedural Body & Board Animations
    // -------------------------------------------------------------
    // Target board edge roll when carving
    const targetRoll = (-this.lateralVelocity / this.turnSpeed) * 0.42;
    this.carveRoll += (targetRoll - this.carveRoll) * 14.0 * delta;

    // Target tuck crouch
    const targetTuck = this.isTucking ? 1.0 : 0.0;
    this.tuckProgress += (targetTuck - this.tuckProgress) * 10.0 * delta;

    // Landing squat recovery
    this.landingSquat = Math.max(0, this.landingSquat - 3.0 * delta);

    // Apply pitch & slope alignment to board
    const slopePitch = Math.atan(this.terrain.SLOPE_GRADE);
    this.boardGroup.rotation.x = slopePitch;
    this.boardGroup.rotation.z = this.carveRoll;
    this.boardGroup.rotation.y = (-this.lateralVelocity / this.turnSpeed) * 0.35;

    // Animate Torso posture (Tuck & Carve Lean)
    const baseTorsoY = 0.78 - (this.tuckProgress * 0.28) - this.landingSquat;
    this.torsoGroup.position.y = baseTorsoY;
    this.torsoGroup.rotation.x = this.tuckProgress * 0.55; // Lean forward in tuck
    this.torsoGroup.rotation.z = -this.carveRoll * 0.45; // Lean into turn

    // Animate Arms (tuck in when aerodynamic, flare out when airborne)
    if (this.isTucking) {
      this.leftArmGroup.rotation.z = -0.3;
      this.rightArmGroup.rotation.z = 0.3;
    } else if (!this.isGrounded) {
      // Big air balance arms
      this.leftArmGroup.rotation.z = 0.6 + Math.sin(this.airTime * 10) * 0.15;
      this.rightArmGroup.rotation.z = -0.6 - Math.sin(this.airTime * 10) * 0.15;
    } else {
      this.leftArmGroup.rotation.z = 0.1;
      this.rightArmGroup.rotation.z = -0.1;
    }

    // Update root mesh position
    this.mesh.position.copy(this.position);

    // -------------------------------------------------------------
    // 6. Sound Engine Modulation
    // -------------------------------------------------------------
    const carveIntensity = Math.abs(this.lateralVelocity) / this.turnSpeed;
    this.sound.updateDynamicSounds(this.velocity.z, carveIntensity, this.isGrounded);
  }

  /**
   * Returns current speed converted to km/h for HUD display
   */
  getSpeedKmH() {
    return Math.round(this.velocity.z * 3.6);
  }
}
