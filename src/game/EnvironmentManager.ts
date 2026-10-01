import * as THREE from 'three';

export class EnvironmentManager {
  private scene: THREE.Scene;
  private groundSegments: THREE.Group[] = [];
  private segmentLength: number = 70;
  private totalSegments: number = 9;

  // Particle systems
  private dustParticles: THREE.Points | null = null;
  private dustPositions: Float32Array | null = null;
  private dustVelocities: Float32Array | null = null;
  private maxDust: number = 180;
  private activeDustCount: number = 0;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.setupSkyAndLighting();
    this.createTerrainSegments();
    this.createDustParticleSystem();
  }

  private setupSkyAndLighting() {
    // Warm Golden-Blue Steppe Sky
    this.scene.background = new THREE.Color(0x76b8fc);

    // Warm Atmospheric Steppe Fog (Savanna Horizon)
    this.scene.fog = new THREE.FogExp2(0xe2d7bf, 0.0035);

    // Warm Ambient Sunlight
    const ambientLight = new THREE.AmbientLight(0xfff6e8, 0.95);
    this.scene.add(ambientLight);

    // Sun Light with Crisp Shadows
    const sunLight = new THREE.DirectionalLight(0xfff8e7, 1.6);
    sunLight.position.set(40, 70, -25);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 250;
    sunLight.shadow.camera.left = -50;
    sunLight.shadow.camera.right = 50;
    sunLight.shadow.camera.top = 50;
    sunLight.shadow.camera.bottom = -50;
    sunLight.shadow.camera.updateProjectionMatrix();
    this.scene.add(sunLight);

    // Fill Light from opposite direction
    const fillLight = new THREE.DirectionalLight(0xaad0ff, 0.45);
    fillLight.position.set(-30, 35, 25);
    this.scene.add(fillLight);
  }

  private createTerrainSegments() {
    // Materials - Short Golden/Yellow-tinted Steppe Grass (Thảo nguyên cỏ ngắn màu vàng)
    const steppeGrassMat = new THREE.MeshStandardMaterial({
      color: 0xc4af60, // Warm Golden Yellow Grass
      roughness: 0.92,
      metalness: 0.02,
    });

    const faintTrailMat = new THREE.MeshStandardMaterial({
      color: 0xb59e56, // Natural blended dry trail
      roughness: 0.96,
      metalness: 0.0,
    });

    const acaciaWoodMat = new THREE.MeshStandardMaterial({
      color: 0x5a4535, // Steppe bark
      roughness: 0.85,
    });

    const acaciaLeafMat = new THREE.MeshStandardMaterial({
      color: 0x8a9245, // Dry olive savanna canopy
      roughness: 0.8,
    });

    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x9a9183, // Weathered sandstone rock
      roughness: 0.85,
    });

    const grassTuftMat = new THREE.MeshStandardMaterial({
      color: 0xdfcb75, // Lighter golden grass blades
      roughness: 0.9,
    });

    for (let i = 0; i < this.totalSegments; i++) {
      const segment = new THREE.Group();
      const zPos = i * this.segmentLength - 35;

      // 1. Vast Open Steppe Plane (Rộng 400m - Hoàn toàn tự do, không tường rào)
      const grassGeo = new THREE.PlaneGeometry(400, this.segmentLength);
      const grassMesh = new THREE.Mesh(grassGeo, steppeGrassMat);
      grassMesh.rotation.x = -Math.PI / 2;
      grassMesh.receiveShadow = true;
      segment.add(grassMesh);

      // 2. Subtle Natural Dirt/Grass Riding Corridor (Rộng 35m không có gờ cản)
      const trailGeo = new THREE.PlaneGeometry(35, this.segmentLength);
      const trailMesh = new THREE.Mesh(trailGeo, faintTrailMat);
      trailMesh.rotation.x = -Math.PI / 2;
      trailMesh.position.y = 0.005;
      trailMesh.receiveShadow = true;
      segment.add(trailMesh);

      // 3. Short Grass Tufts (Cụm cỏ ngắn màu vàng nhô nhẹ trên mặt đất)
      for (let g = 0; g < 18; g++) {
        const tuftGroup = new THREE.Group();
        const tuftX = (Math.random() - 0.5) * 80;
        const tuftZ = (Math.random() - 0.5) * this.segmentLength;

        // Two intersecting planes for low-poly grass tuft
        const tuftGeo = new THREE.PlaneGeometry(0.5, 0.35);
        const blade1 = new THREE.Mesh(tuftGeo, grassTuftMat);
        blade1.position.y = 0.17;
        blade1.castShadow = false;
        tuftGroup.add(blade1);

        const blade2 = new THREE.Mesh(tuftGeo, grassTuftMat);
        blade2.position.y = 0.17;
        blade2.rotation.y = Math.PI / 2;
        blade2.castShadow = false;
        tuftGroup.add(blade2);

        tuftGroup.position.set(tuftX, 0, tuftZ);
        segment.add(tuftGroup);
      }

      // 4. Distant Savanna / Acacia Trees (Cây thảo nguyên tán xòe ở khoảng cách xa)
      for (let t = 0; t < 4; t++) {
        const treeGroup = new THREE.Group();
        const side = t % 2 === 0 ? 1 : -1;
        // Keep central riding area clear (|X| > 22)
        const treeX = side * (24 + Math.random() * 85);
        const treeZ = (Math.random() - 0.5) * this.segmentLength;

        // Curved trunk
        const trunkGeo = new THREE.CylinderGeometry(0.22, 0.45, 4.2, 6);
        const trunk = new THREE.Mesh(trunkGeo, acaciaWoodMat);
        trunk.position.y = 2.1;
        trunk.rotation.z = side * (0.08 + Math.random() * 0.12);
        trunk.castShadow = true;
        treeGroup.add(trunk);

        // Flat umbrella acacia foliage canopies
        const canopy1 = new THREE.Mesh(new THREE.CylinderGeometry(2.8, 2.2, 0.6, 7), acaciaLeafMat);
        canopy1.position.set(side * 0.5, 4.1, 0);
        canopy1.castShadow = true;
        treeGroup.add(canopy1);

        const canopy2 = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 1.4, 0.5, 7), acaciaLeafMat);
        canopy2.position.set(side * 1.0, 4.6, 0.3);
        canopy2.castShadow = true;
        treeGroup.add(canopy2);

        treeGroup.position.set(treeX, 0, treeZ);
        segment.add(treeGroup);
      }

      // 5. Steppe Boulders & Sandstone Rocks (Nằm ở hai bên xa)
      for (let r = 0; r < 3; r++) {
        const rockGeo = new THREE.DodecahedronGeometry(0.6 + Math.random() * 0.7);
        const rock = new THREE.Mesh(rockGeo, rockMat);
        const side = Math.random() > 0.5 ? 1 : -1;
        rock.position.set(side * (18 + Math.random() * 50), 0.35, (Math.random() - 0.5) * this.segmentLength);
        rock.rotation.set(Math.random(), Math.random(), Math.random());
        rock.castShadow = true;
        segment.add(rock);
      }

      segment.position.set(0, 0, zPos);
      this.scene.add(segment);
      this.groundSegments.push(segment);
    }
  }

  private createDustParticleSystem() {
    const geo = new THREE.BufferGeometry();
    this.dustPositions = new Float32Array(this.maxDust * 3);
    this.dustVelocities = new Float32Array(this.maxDust * 3);

    for (let i = 0; i < this.maxDust * 3; i++) {
      this.dustPositions[i] = 0;
      this.dustVelocities[i] = 0;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(this.dustPositions, 3));

    const dustMat = new THREE.PointsMaterial({
      color: 0xd9c59a, // Warm golden dust
      size: 0.5,
      transparent: true,
      opacity: 0.65,
      blending: THREE.NormalBlending,
    });

    this.dustParticles = new THREE.Points(geo, dustMat);
    this.scene.add(this.dustParticles);
  }

  public emitDust(worldPos: THREE.Vector3, count: number = 4) {
    if (!this.dustPositions || !this.dustVelocities) return;

    for (let i = 0; i < count; i++) {
      const idx = (this.activeDustCount % this.maxDust) * 3;
      this.activeDustCount++;

      this.dustPositions[idx] = worldPos.x + (Math.random() - 0.5) * 0.5;
      this.dustPositions[idx + 1] = worldPos.y + Math.random() * 0.2;
      this.dustPositions[idx + 2] = worldPos.z + (Math.random() - 0.5) * 0.5;

      this.dustVelocities[idx] = (Math.random() - 0.5) * 2;
      this.dustVelocities[idx + 1] = Math.random() * 2.2 + 0.6;
      this.dustVelocities[idx + 2] = -Math.random() * 4 - 2;
    }
  }

  public emitSparks(worldPos: THREE.Vector3, count: number = 4) {
    this.emitDust(worldPos, count);
  }

  /**
   * Resets all ground segments and particles back to start position
   */
  public reset() {
    for (let i = 0; i < this.totalSegments; i++) {
      const segment = this.groundSegments[i];
      const zPos = i * this.segmentLength - 35;
      segment.position.set(0, 0, zPos);
    }

    if (this.dustPositions) {
      for (let i = 0; i < this.maxDust * 3; i++) {
        this.dustPositions[i] = 0;
      }
      if (this.dustParticles) {
        (this.dustParticles.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      }
    }
  }

  public update(playerZ: number, delta: number) {
    // Infinite scrolling terrain relative to playerZ
    for (const segment of this.groundSegments) {
      if (segment.position.z < playerZ - this.segmentLength * 1.5) {
        segment.position.z += this.totalSegments * this.segmentLength;
      } else if (segment.position.z > playerZ + this.segmentLength * (this.totalSegments - 0.5)) {
        segment.position.z -= this.totalSegments * this.segmentLength;
      }
    }

    // Update Dust Particles
    if (this.dustParticles && this.dustPositions && this.dustVelocities) {
      const posAttr = this.dustParticles.geometry.attributes.position as THREE.BufferAttribute;

      for (let i = 0; i < this.maxDust; i++) {
        const idx = i * 3;
        if (this.dustPositions[idx + 1] > 0) {
          this.dustPositions[idx] += this.dustVelocities[idx] * delta;
          this.dustPositions[idx + 1] += this.dustVelocities[idx + 1] * delta;
          this.dustPositions[idx + 2] += this.dustVelocities[idx + 2] * delta;

          if (this.dustPositions[idx + 1] > 3) {
            this.dustPositions[idx + 1] = -10;
          }
        }
      }
      posAttr.needsUpdate = true;
    }
  }
}
