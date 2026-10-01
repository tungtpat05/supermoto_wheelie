import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { RealisticParticleSystem } from './RealisticParticleSystem';

export class EnvironmentManager {
  private scene: THREE.Scene;
  private groundSegments: THREE.Group[] = [];
  private segmentLength: number = 70;
  private totalSegments: number = 9;

  // Realistic Particle System (Exhaust, Burnout Dust, Sparks)
  private particleSystem: RealisticParticleSystem;

  // Wind turbine rotating rotors
  private rotatingRotors: THREE.Object3D[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.particleSystem = new RealisticParticleSystem(scene);

    this.setupSkyAndLighting();
    this.createTerrainSegments();
    this.loadEnvironmentGLBModels();
  }

  private setupSkyAndLighting() {
    // 1. Warm Savanna / Steppe Sky color fallback before HDR loads
    this.scene.background = new THREE.Color(0x89bcee);

    // 2. Atmospheric Savanna Fog blending with the horizon
    this.scene.fog = new THREE.FogExp2(0xe4d3b6, 0.0028);

    // 3. Directional Sun Light with Crisp Soft Contact Shadows
    const sunLight = new THREE.DirectionalLight(0xfff6e4, 1.85);
    sunLight.position.set(45, 80, -35);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 300;
    sunLight.shadow.camera.left = -60;
    sunLight.shadow.camera.right = 60;
    sunLight.shadow.camera.top = 60;
    sunLight.shadow.camera.bottom = -60;
    sunLight.shadow.bias = -0.0004;
    this.scene.add(sunLight);

    // Warm Ambient Light from the sky
    const ambientLight = new THREE.AmbientLight(0xffedd5, 0.85);
    this.scene.add(ambientLight);

    // Sky Fill light from opposite side
    const fillLight = new THREE.DirectionalLight(0xbadcff, 0.45);
    fillLight.position.set(-40, 30, 35);
    this.scene.add(fillLight);

    // 4. Load HDRI 360 Environment Map (Lebombo Savanna)
    const rgbeLoader = new RGBELoader();
    rgbeLoader.load(
      '/environment/hdri/lebombo_1k.hdr',
      (texture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        this.scene.background = texture;
        this.scene.environment = texture;
      },
      undefined,
      (err) => {
        console.warn('Failed to load Lebombo HDRI, attempting Kiara sunrise fallback:', err);
        rgbeLoader.load('/environment/hdri/kiara_1_dawn_1k.hdr', (fallback) => {
          fallback.mapping = THREE.EquirectangularReflectionMapping;
          this.scene.background = fallback;
          this.scene.environment = fallback;
        });
      }
    );
  }

  private createTerrainSegments() {
    const texLoader = new THREE.TextureLoader();

    // PBR Grass Textures
    const grassColor = texLoader.load('/environment/textures/grass_color.jpg');
    grassColor.wrapS = THREE.RepeatWrapping;
    grassColor.wrapT = THREE.RepeatWrapping;
    grassColor.repeat.set(30, 6);

    const grassNormal = texLoader.load('/environment/textures/grass_normal.jpg');
    grassNormal.wrapS = THREE.RepeatWrapping;
    grassNormal.wrapT = THREE.RepeatWrapping;
    grassNormal.repeat.set(30, 6);

    const grassRoughness = texLoader.load('/environment/textures/grass_roughness.jpg');
    grassRoughness.wrapS = THREE.RepeatWrapping;
    grassRoughness.wrapT = THREE.RepeatWrapping;
    grassRoughness.repeat.set(30, 6);

    const grassMat = new THREE.MeshStandardMaterial({
      map: grassColor,
      normalMap: grassNormal,
      roughnessMap: grassRoughness,
      color: 0xd6c478, // Warm Golden Savanna Grass tint
      roughness: 0.88,
      metalness: 0.02,
    });

    // PBR Dirt / Riding Trail Textures
    const rockColor = texLoader.load('/environment/textures/rock_color.jpg');
    rockColor.wrapS = THREE.RepeatWrapping;
    rockColor.wrapT = THREE.RepeatWrapping;
    rockColor.repeat.set(3.5, 7);

    const rockNormal = texLoader.load('/environment/textures/rock_normal.jpg');
    rockNormal.wrapS = THREE.RepeatWrapping;
    rockNormal.wrapT = THREE.RepeatWrapping;
    rockNormal.repeat.set(3.5, 7);

    const trailMat = new THREE.MeshStandardMaterial({
      map: rockColor,
      normalMap: rockNormal,
      color: 0xc8b282, // Natural compacted dry dirt & sandstone trail
      roughness: 0.94,
      metalness: 0.01,
    });

    for (let i = 0; i < this.totalSegments; i++) {
      const segment = new THREE.Group();
      const zPos = i * this.segmentLength - 35;

      // 1. Vast Open Savanna Plane (Rộng 400m - Hoàn toàn thoáng đãng)
      const grassGeo = new THREE.PlaneGeometry(400, this.segmentLength);
      const grassMesh = new THREE.Mesh(grassGeo, grassMat);
      grassMesh.rotation.x = -Math.PI / 2;
      grassMesh.receiveShadow = true;
      segment.add(grassMesh);

      // 2. Natural Compacted Dirt Riding Corridor (Rộng 35m)
      const trailGeo = new THREE.PlaneGeometry(35, this.segmentLength);
      const trailMesh = new THREE.Mesh(trailGeo, trailMat);
      trailMesh.rotation.x = -Math.PI / 2;
      trailMesh.position.y = 0.006;
      trailMesh.receiveShadow = true;
      segment.add(trailMesh);

      segment.position.set(0, 0, zPos);
      this.scene.add(segment);
      this.groundSegments.push(segment);
    }
  }

  /**
   * Loads high-quality GLB/GLTF models (Trees, Rocks, Cactus, Wind Turbines)
   * and populates the infinite terrain segments
   */
  private async loadEnvironmentGLBModels() {
    const dracoLoader = new DRACOLoader();
    dracoLoader.setDecoderPath('/draco/');

    const gltfLoader = new GLTFLoader();
    gltfLoader.setDRACOLoader(dracoLoader);

    const modelUrls = [
      { id: 'treeBig', url: '/environment/models/tree-big.gltf', type: 'tree', scale: 7.5 },
      { id: 'treeSmall', url: '/environment/models/tree-small.gltf', type: 'tree', scale: 6.5 },
      { id: 'treeLowPoly', url: '/environment/models/low-poly-tree.gltf', type: 'tree', scale: 5.5 },
      { id: 'rock', url: '/environment/models/formation-rock.gltf', type: 'rock', scale: 3.2 },
      { id: 'rockLarge', url: '/environment/models/formation-large-rock.gltf', type: 'rock', scale: 3.8 },
      { id: 'cactus', url: '/environment/models/cactus.gltf', type: 'cactus', scale: 3.0 },
      { id: 'turbine', url: '/environment/models/wind-turbine.gltf', type: 'turbine', scale: 12.0 },
    ];

    const loadedScenes: { id: string; scene: THREE.Group; type: string; scale: number }[] = [];

    for (const item of modelUrls) {
      try {
        const gltf = await new Promise<any>((resolve, reject) => {
          gltfLoader.load(item.url, resolve, undefined, reject);
        });

        const root = gltf.scene as THREE.Group;
        root.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            if (mesh.material) {
              const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              mats.forEach((m) => {
                if (m instanceof THREE.MeshStandardMaterial) {
                  m.roughness = Math.max(0.3, m.roughness);
                  m.envMapIntensity = 1.0;
                }
              });
            }
          }
        });

        loadedScenes.push({
          id: item.id,
          scene: root,
          type: item.type,
          scale: item.scale,
        });
      } catch (err) {
        console.warn(`Could not load environment model ${item.id}:`, err);
      }
    }

    if (loadedScenes.length === 0) return;

    // Distribute models across the 9 segments
    const trees = loadedScenes.filter((m) => m.type === 'tree');
    const rocks = loadedScenes.filter((m) => m.type === 'rock');
    const cacti = loadedScenes.filter((m) => m.type === 'cactus');
    const turbines = loadedScenes.filter((m) => m.type === 'turbine');

    this.groundSegments.forEach((segment, segIdx) => {
      // 1. Place 3D Trees (2 to 4 trees per segment, far enough from center track |X| > 22)
      for (let t = 0; t < 3; t++) {
        if (trees.length === 0) break;
        const treeTemplate = trees[(segIdx + t) % trees.length];
        const treeClone = treeTemplate.scene.clone(true);

        const side = t % 2 === 0 ? 1 : -1;
        const xPos = side * (24 + Math.random() * 85);
        const zPos = (Math.random() - 0.5) * this.segmentLength;
        const scale = treeTemplate.scale * (0.8 + Math.random() * 0.45);

        treeClone.position.set(xPos, 0, zPos);
        treeClone.rotation.y = Math.random() * Math.PI * 2;
        treeClone.scale.setScalar(scale);
        segment.add(treeClone);
      }

      // 2. Place 3D Weathered Rocks & Sandstone Boulders
      for (let r = 0; r < 2; r++) {
        if (rocks.length === 0) break;
        const rockTemplate = rocks[(segIdx * 2 + r) % rocks.length];
        const rockClone = rockTemplate.scene.clone(true);

        const side = Math.random() > 0.5 ? 1 : -1;
        const xPos = side * (19 + Math.random() * 60);
        const zPos = (Math.random() - 0.5) * this.segmentLength;
        const scale = rockTemplate.scale * (0.75 + Math.random() * 0.6);

        rockClone.position.set(xPos, 0, zPos);
        rockClone.rotation.set(0, Math.random() * Math.PI * 2, 0);
        rockClone.scale.setScalar(scale);
        segment.add(rockClone);
      }

      // 3. Place Desert Cacti (Savanna Vegetation)
      if (cacti.length > 0 && segIdx % 2 === 0) {
        const cactusTemplate = cacti[0];
        const cactusClone = cactusTemplate.scene.clone(true);

        const side = Math.random() > 0.5 ? 1 : -1;
        const xPos = side * (20 + Math.random() * 45);
        const zPos = (Math.random() - 0.5) * this.segmentLength;

        cactusClone.position.set(xPos, 0, zPos);
        cactusClone.rotation.y = Math.random() * Math.PI * 2;
        cactusClone.scale.setScalar(cactusTemplate.scale * (0.8 + Math.random() * 0.5));
        segment.add(cactusClone);
      }

      // 4. Distant Giant Wind Turbines on the Horizon (Every 3rd segment)
      if (turbines.length > 0 && segIdx % 3 === 0) {
        const turbineTemplate = turbines[0];
        const turbineClone = turbineTemplate.scene.clone(true);

        const side = segIdx % 6 === 0 ? 1 : -1;
        const xPos = side * (110 + Math.random() * 40);
        const zPos = (Math.random() - 0.5) * this.segmentLength;

        turbineClone.position.set(xPos, 0, zPos);
        turbineClone.rotation.y = side > 0 ? -Math.PI / 4 : Math.PI / 4;
        turbineClone.scale.setScalar(turbineTemplate.scale * 1.3);

        // Find rotor blades to animate spin
        turbineClone.traverse((child) => {
          if (child.name.toLowerCase().includes('blade') || child.name.toLowerCase().includes('rotor') || child.children.length >= 3) {
            this.rotatingRotors.push(child);
          }
        });

        segment.add(turbineClone);
      }
    });
  }

  // --- Public Particle Effects API ---

  /**
   * Emits realistic exhaust smoke puffs out the exhaust pipe
   */
  public emitExhaust(
    exhaustTipWorldPos: THREE.Vector3,
    rpmRatio: number,
    throttle: boolean,
    isTwoStroke: boolean,
    delta: number
  ) {
    this.particleSystem.emitExhaust(exhaustTipWorldPos, rpmRatio, throttle, isTwoStroke, delta);
  }

  /**
   * Emits tire burnout smoke & violent rooster-tail dirt plume when launching / accelerating (đề-pa)
   */
  public emitBurnout(rearWheelPos: THREE.Vector3, rpmRatio: number, isLaunchBurnout: boolean) {
    this.particleSystem.emitBurnout(rearWheelPos, rpmRatio, isLaunchBurnout);
  }

  /**
   * Compatibility wrapper for riding dirt trail
   */
  public emitDust(worldPos: THREE.Vector3, count: number = 4) {
    this.particleSystem.emitBurnout(worldPos, 0.4, count > 3);
  }

  /**
   * Emits glowing sparks when the rear fender scrapes the ground
   */
  public emitSparks(worldPos: THREE.Vector3, count: number = 4) {
    this.particleSystem.emitSparks(worldPos, count);
  }

  /**
   * Resets all ground segments and particle pools back to origin
   */
  public reset() {
    for (let i = 0; i < this.totalSegments; i++) {
      const segment = this.groundSegments[i];
      const zPos = i * this.segmentLength - 35;
      segment.position.set(0, 0, zPos);
    }
    this.particleSystem.reset();
  }

  /**
   * Game loop update: infinite scrolling terrain, wind turbine animation, and particle physics
   */
  public update(playerZ: number, delta: number) {
    // 1. Infinite scrolling terrain relative to playerZ
    for (const segment of this.groundSegments) {
      if (segment.position.z < playerZ - this.segmentLength * 1.5) {
        segment.position.z += this.totalSegments * this.segmentLength;
      } else if (segment.position.z > playerZ + this.segmentLength * (this.totalSegments - 0.5)) {
        segment.position.z -= this.totalSegments * this.segmentLength;
      }
    }

    // 2. Animate distant wind turbine rotor rotation
    for (const rotor of this.rotatingRotors) {
      rotor.rotation.z += 1.35 * delta;
    }

    // 3. Update particle physics & sync buffers
    this.particleSystem.update(delta);
  }
}
