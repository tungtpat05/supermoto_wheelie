import * as THREE from 'three';
import { getSmokeTexture, getDustTexture, getSparkTexture } from './ParticleTextures';
import { terrainHeight } from './SteppeTerrain';

interface Particle {
  active: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  scale: number;
  initialScale: number;
  maxScale: number;
  opacity: number;
  maxOpacity: number;
  life: number;
  maxLife: number;
  rotation: number;
  rotSpeed: number;
  color: THREE.Color;
}

export class RealisticParticleSystem {
  private scene: THREE.Scene;

  // Exhaust Smoke System
  private maxExhaust: number = 100;
  private exhaustPool: Particle[] = [];
  private exhaustGeometry: THREE.BufferGeometry;
  private exhaustPoints: THREE.Points;
  private exhaustPositions: Float32Array;
  private exhaustColors: Float32Array;
  private exhaustSizes: Float32Array;
  private exhaustTimer: number = 0;
  private exhaustOpacities = new Float32Array(this.maxExhaust);

  // Tire Dust & Burnout System
  private maxDust: number = 220;
  private dustPool: Particle[] = [];
  private dustGeometry: THREE.BufferGeometry;
  private dustPoints: THREE.Points;
  private dustPositions: Float32Array;
  private dustColors: Float32Array;
  private dustSizes: Float32Array;
  private dustOpacities = new Float32Array(this.maxDust);
  private dustTimer = 0;

  // Sparks System
  private maxSparks: number = 80;
  private sparkPool: Particle[] = [];
  private sparkGeometry: THREE.BufferGeometry;
  private sparkPoints: THREE.Points;
  private sparkPositions: Float32Array;
  private sparkColors: Float32Array;
  private sparkSizes: Float32Array;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // --- 1. Exhaust Particles Setup ---
    this.exhaustPositions = new Float32Array(this.maxExhaust * 3);
    this.exhaustColors = new Float32Array(this.maxExhaust * 3);
    this.exhaustSizes = new Float32Array(this.maxExhaust);

    this.exhaustGeometry = new THREE.BufferGeometry();
    this.exhaustGeometry.setAttribute('position', new THREE.BufferAttribute(this.exhaustPositions, 3));
    this.exhaustGeometry.setAttribute('color', new THREE.BufferAttribute(this.exhaustColors, 3));
    this.exhaustGeometry.setAttribute('size', new THREE.BufferAttribute(this.exhaustSizes, 1));
    this.exhaustGeometry.setAttribute('particleOpacity', new THREE.BufferAttribute(this.exhaustOpacities, 1));

    for (let i = 0; i < this.maxExhaust; i++) {
      this.exhaustPool.push({
        active: false,
        position: new THREE.Vector3(0, -999, 0),
        velocity: new THREE.Vector3(),
        scale: 0.1,
        initialScale: 0.15,
        maxScale: 1.2,
        opacity: 0,
        maxOpacity: 0.6,
        life: 0,
        maxLife: 1.0,
        rotation: 0,
        rotSpeed: 0,
        color: new THREE.Color(0xf0f4f8),
      });
    }

    const exhaustMaterial = new THREE.PointsMaterial({
      map: getSmokeTexture(),
      size: 1.0,
      transparent: true,
      opacity: 0.75,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    exhaustMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader = 'attribute float size;\nattribute float particleOpacity;\nvarying float vOpacity;\n' + shader.vertexShader;
      // PointsMaterial already declares a uniform named size; use our per-particle attribute instead.
      shader.vertexShader = shader.vertexShader.replace('uniform float size;', '');
      shader.vertexShader = shader.vertexShader.replace('gl_PointSize = size;', 'gl_PointSize = size;\nvOpacity = particleOpacity;');
      shader.fragmentShader = 'varying float vOpacity;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vOpacity;');
    };
    this.exhaustPoints = new THREE.Points(this.exhaustGeometry, exhaustMaterial);
    this.exhaustPoints.frustumCulled = false;
    this.scene.add(this.exhaustPoints);

    // --- 2. Tire Dust & Burnout Setup ---
    this.dustPositions = new Float32Array(this.maxDust * 3);
    this.dustColors = new Float32Array(this.maxDust * 3);
    this.dustSizes = new Float32Array(this.maxDust);

    this.dustGeometry = new THREE.BufferGeometry();
    this.dustGeometry.setAttribute('position', new THREE.BufferAttribute(this.dustPositions, 3));
    this.dustGeometry.setAttribute('color', new THREE.BufferAttribute(this.dustColors, 3));
    this.dustGeometry.setAttribute('size', new THREE.BufferAttribute(this.dustSizes, 1));
    this.dustGeometry.setAttribute('particleOpacity', new THREE.BufferAttribute(this.dustOpacities, 1));

    for (let i = 0; i < this.maxDust; i++) {
      this.dustPool.push({
        active: false,
        position: new THREE.Vector3(0, -999, 0),
        velocity: new THREE.Vector3(),
        scale: 0.2,
        initialScale: 0.25,
        maxScale: 2.2,
        opacity: 0,
        maxOpacity: 0.65,
        life: 0,
        maxLife: 1.2,
        rotation: 0,
        rotSpeed: 0,
        color: new THREE.Color(0xd6be95),
      });
    }

    const dustMaterial = new THREE.PointsMaterial({
      map: getDustTexture(),
      size: 1.2,
      transparent: true,
      opacity: 0.7,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    dustMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader = 'attribute float size;\nattribute float particleOpacity;\nvarying float vOpacity;\n' + shader.vertexShader;
      // PointsMaterial already declares a uniform named size; use our per-particle attribute instead.
      shader.vertexShader = shader.vertexShader.replace('uniform float size;', '');
      shader.vertexShader = shader.vertexShader.replace('gl_PointSize = size;', 'gl_PointSize = size;\nvOpacity = particleOpacity;');
      shader.fragmentShader = 'varying float vOpacity;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vOpacity;');
    };
    this.dustPoints = new THREE.Points(this.dustGeometry, dustMaterial);
    this.dustPoints.frustumCulled = false;
    this.scene.add(this.dustPoints);

    // --- 3. Sparks Setup ---
    this.sparkPositions = new Float32Array(this.maxSparks * 3);
    this.sparkColors = new Float32Array(this.maxSparks * 3);
    this.sparkSizes = new Float32Array(this.maxSparks);

    this.sparkGeometry = new THREE.BufferGeometry();
    this.sparkGeometry.setAttribute('position', new THREE.BufferAttribute(this.sparkPositions, 3));
    this.sparkGeometry.setAttribute('color', new THREE.BufferAttribute(this.sparkColors, 3));
    this.sparkGeometry.setAttribute('size', new THREE.BufferAttribute(this.sparkSizes, 1));

    for (let i = 0; i < this.maxSparks; i++) {
      this.sparkPool.push({
        active: false,
        position: new THREE.Vector3(0, -999, 0),
        velocity: new THREE.Vector3(),
        scale: 0.1,
        initialScale: 0.12,
        maxScale: 0.22,
        opacity: 0,
        maxOpacity: 1.0,
        life: 0,
        maxLife: 0.45,
        rotation: 0,
        rotSpeed: 0,
        color: new THREE.Color(0xffaa22),
      });
    }

    const sparkMaterial = new THREE.PointsMaterial({
      map: getSparkTexture(),
      size: 0.45,
      transparent: true,
      opacity: 1.0,
      vertexColors: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.sparkPoints = new THREE.Points(this.sparkGeometry, sparkMaterial);
    this.sparkPoints.frustumCulled = false;
    this.scene.add(this.sparkPoints);
  }

  /**
   * Spawns exhaust smoke puffs reacting to engine type, throttle, and RPM
   */
  public emitExhaust(
    exhaustTipWorldPos: THREE.Vector3,
    rpmRatio: number,
    throttle: boolean,
    isTwoStroke: boolean,
    delta: number
  ) {
    // Frequency increases with RPM: from 12 puffs/sec up to 55 puffs/sec
    const puffsPerSec = throttle ? 22 + rpmRatio * 35 : 8 + rpmRatio * 12;
    const interval = 1 / puffsPerSec;

    this.exhaustTimer += delta;
    if (this.exhaustTimer < interval) return;
    this.exhaustTimer = 0;

    // Find available inactive particle
    let p = this.exhaustPool.find((item) => !item.active);
    if (!p) {
      // Overwrite oldest
      p = this.exhaustPool[Math.floor(Math.random() * this.exhaustPool.length)];
    }

    p.active = true;
    p.life = 0;
    p.maxLife = 0.55 + Math.random() * 0.45;
    p.position.copy(exhaustTipWorldPos);
    p.position.x += (Math.random() - 0.5) * 0.05;
    p.position.y += (Math.random() - 0.5) * 0.05;
    p.position.z += (Math.random() - 0.5) * 0.05;

    // Ejection velocity out the back of the bike (-Z with slight outward drift)
    const ejectForce = throttle ? 3.5 + rpmRatio * 4.5 : 1.2;
    p.velocity.set(
      (Math.random() - 0.4) * 0.8,
      0.4 + Math.random() * 0.9,
      -ejectForce - Math.random() * 1.5
    );

    p.initialScale = throttle ? 0.25 : 0.15;
    p.maxScale = throttle ? 1.4 + rpmRatio * 0.6 : 0.8;
    p.scale = p.initialScale;

    // 2-Stroke produces distinctive hazy bluish-white aromatic smoke, 4-stroke is lighter grey
    if (isTwoStroke) {
      p.color.setRGB(0.82, 0.89, 0.98); // Crisp 2-stroke pale blue haze
      p.maxOpacity = throttle ? 0.72 : 0.35;
    } else {
      p.color.setRGB(0.88, 0.88, 0.9); // 4-stroke translucent grey puff
      p.maxOpacity = throttle ? 0.52 : 0.22;
    }
  }

  /**
   * Spawns massive rooster tail dirt cloud and tire burnout smoke when launching (đề-pa)
   */
  public emitRidingDust(
    rearWheelWorldPos: THREE.Vector3,
    speed: number,
    throttle: boolean,
    delta: number
  ) {
    if (speed < 0.25 && !throttle) { this.dustTimer = 0; return; }
    const isLaunchBurnout = throttle && speed < 8;
    const rpmRatio = Math.min(1, speed / 25);
    const rate = isLaunchBurnout ? 95 : Math.min(65, 10 + speed * 2);
    this.dustTimer += Math.min(delta, 0.1) * rate;
    const count = Math.floor(this.dustTimer);
    this.dustTimer -= count;

    for (let c = 0; c < count; c++) {
      let p = this.dustPool.find((item) => !item.active);
      if (!p) {
        p = this.dustPool[Math.floor(Math.random() * this.dustPool.length)];
      }

      p.active = true;
      p.life = 0;
      p.maxLife = 1.4 + Math.random() * 0.9;

      // Contact patch on the ground
      p.position.set(
        rearWheelWorldPos.x + (Math.random() - 0.5) * 0.4,
        rearWheelWorldPos.y + Math.random() * 0.08,
        rearWheelWorldPos.z + (Math.random() - 0.5) * 0.3
      );

      // Strong backward and upward ejection from spinning tire
      const throwSpeed = isLaunchBurnout ? 5.5 + rpmRatio * 7.0 : 2.5;
      p.velocity.set(
        (Math.random() - 0.5) * (isLaunchBurnout ? 3.5 : 1.5),
        Math.random() * (isLaunchBurnout ? 2.8 : 1.2) + 0.5,
        -throwSpeed - Math.random() * 3.0
      );

      p.initialScale = isLaunchBurnout ? 0.35 : 0.2;
      p.maxScale = isLaunchBurnout ? 2.4 : 1.2;
      p.scale = p.initialScale;

      p.color.setHSL(0.095 + Math.random() * 0.02, 0.32, 0.52 + Math.random() * 0.16);
      p.maxOpacity = isLaunchBurnout ? 0.58 : 0.32;
    }
  }

  /**
   * Spawns bright golden-orange friction sparks when scraping the rear fender
   */
  public emitSparks(worldPos: THREE.Vector3, count: number = 4) {
    for (let c = 0; c < count; c++) {
      let p = this.sparkPool.find((item) => !item.active);
      if (!p) {
        p = this.sparkPool[Math.floor(Math.random() * this.sparkPool.length)];
      }

      p.active = true;
      p.life = 0;
      p.maxLife = 0.25 + Math.random() * 0.2;
      p.position.copy(worldPos);

      // Explosive shower of sparks backward and bouncing
      p.velocity.set(
        (Math.random() - 0.5) * 4.5,
        Math.random() * 3.2 + 0.6,
        -Math.random() * 7.0 - 3.0
      );

      p.initialScale = 0.2;
      p.maxScale = 0.4;
      p.scale = p.initialScale;
      p.maxOpacity = 1.0;

      // Bright fiery colors
      const r = 1.0;
      const g = 0.55 + Math.random() * 0.4;
      const b = Math.random() * 0.2;
      p.color.setRGB(r, g, b);
    }
  }

  /**
   * Resets all particles (used on restart)
   */
  public reset() {
    this.dustTimer = 0;
    this.exhaustTimer = 0;
    this.exhaustPool.forEach((p) => {
      p.active = false;
      p.position.set(0, -999, 0);
    });
    this.dustPool.forEach((p) => {
      p.active = false;
      p.position.set(0, -999, 0);
    });
    this.sparkPool.forEach((p) => {
      p.active = false;
      p.position.set(0, -999, 0);
    });
  }

  public clearExhaust() {
    this.exhaustTimer = 0;
    this.exhaustPool.forEach((p, i) => {
      p.active = false;
      p.position.set(0, -999, 0);
      this.exhaustSizes[i] = 0;
      this.exhaustOpacities[i] = 0;
    });
    this.exhaustGeometry.attributes.position.needsUpdate = true;
    this.exhaustGeometry.attributes.size.needsUpdate = true;
    this.exhaustGeometry.attributes.particleOpacity.needsUpdate = true;
  }

  /**
   * Updates all active particles and syncs geometry buffers
   */
  public update(delta: number) {
    // 1. Update Exhaust
    for (let i = 0; i < this.maxExhaust; i++) {
      const p = this.exhaustPool[i];
      const idx = i * 3;

      if (p.active) {
        p.life += delta;
        if (p.life >= p.maxLife) {
          p.active = false;
          p.position.set(0, -999, 0);
        } else {
          // Physics: drag, buoyancy, expansion
          p.velocity.multiplyScalar(Math.max(0, 1 - 1.8 * delta));
          p.velocity.y += 0.7 * delta; // Gentle upward rise
          p.position.addScaledVector(p.velocity, delta);

          const progress = p.life / p.maxLife;
          p.scale = THREE.MathUtils.lerp(p.initialScale, p.maxScale, Math.sqrt(progress));
          p.opacity = (1 - progress) * p.maxOpacity;
        }

        this.exhaustPositions[idx] = p.position.x;
        this.exhaustPositions[idx + 1] = p.position.y;
        this.exhaustPositions[idx + 2] = p.position.z;

        // Modulate color by opacity
        this.exhaustColors[idx] = p.color.r;
        this.exhaustColors[idx + 1] = p.color.g;
        this.exhaustColors[idx + 2] = p.color.b;
        this.exhaustOpacities[i] = p.active ? p.opacity : 0;
        this.exhaustSizes[i] = p.scale;
      } else {
        this.exhaustPositions[idx + 1] = -999;
        this.exhaustSizes[i] = 0;
        this.exhaustOpacities[i] = 0;
      }
    }
    this.exhaustGeometry.attributes.position.needsUpdate = true;
    this.exhaustGeometry.attributes.color.needsUpdate = true;
    this.exhaustGeometry.attributes.size.needsUpdate = true;
    this.exhaustGeometry.attributes.particleOpacity.needsUpdate = true;

    // 2. Update Dust & Burnout
    for (let i = 0; i < this.maxDust; i++) {
      const p = this.dustPool[i];
      const idx = i * 3;

      if (p.active) {
        p.life += delta;
        if (p.life >= p.maxLife) {
          p.active = false;
          p.position.set(0, -999, 0);
        } else {
          p.velocity.multiplyScalar(Math.max(0, 1 - 2.2 * delta));
          p.velocity.y += 0.4 * delta;
          p.position.addScaledVector(p.velocity, delta);

          // Floor collision clamp
          const floor = terrainHeight(p.position.x, p.position.z) + 0.05;
          if (p.position.y < floor) {
            p.position.y = floor;
            p.velocity.y *= -0.3;
          }

          const progress = p.life / p.maxLife;
          p.scale = THREE.MathUtils.lerp(p.initialScale, p.maxScale, Math.sqrt(progress));
          p.opacity = (1 - progress) * p.maxOpacity;
        }

        this.dustPositions[idx] = p.position.x;
        this.dustPositions[idx + 1] = p.position.y;
        this.dustPositions[idx + 2] = p.position.z;

        this.dustColors[idx] = p.color.r;
        this.dustColors[idx + 1] = p.color.g;
        this.dustColors[idx + 2] = p.color.b;
        this.dustOpacities[i] = p.active ? p.opacity : 0;
        this.dustSizes[i] = p.scale;
      } else {
        this.dustPositions[idx + 1] = -999;
        this.dustSizes[i] = 0;
        this.dustOpacities[i] = 0;
      }
    }
    this.dustGeometry.attributes.position.needsUpdate = true;
    this.dustGeometry.attributes.color.needsUpdate = true;
    this.dustGeometry.attributes.size.needsUpdate = true;
    this.dustGeometry.attributes.particleOpacity.needsUpdate = true;

    // 3. Update Sparks
    for (let i = 0; i < this.maxSparks; i++) {
      const p = this.sparkPool[i];
      const idx = i * 3;

      if (p.active) {
        p.life += delta;
        if (p.life >= p.maxLife) {
          p.active = false;
          p.position.set(0, -999, 0);
        } else {
          p.velocity.y -= 9.8 * delta; // Gravity on sparks
          p.position.addScaledVector(p.velocity, delta);

          // Bounce off ground
          const floor = terrainHeight(p.position.x, p.position.z) + 0.02;
          if (p.position.y < floor) {
            p.position.y = floor;
            p.velocity.y = Math.abs(p.velocity.y) * 0.45;
            p.velocity.multiplyScalar(0.7);
          }

          const progress = p.life / p.maxLife;
          p.opacity = 1 - progress;
        }

        this.sparkPositions[idx] = p.position.x;
        this.sparkPositions[idx + 1] = p.position.y;
        this.sparkPositions[idx + 2] = p.position.z;

        this.sparkColors[idx] = p.color.r * p.opacity;
        this.sparkColors[idx + 1] = p.color.g * p.opacity;
        this.sparkColors[idx + 2] = p.color.b * p.opacity;
        this.sparkSizes[i] = p.scale;
      } else {
        this.sparkPositions[idx + 1] = -999;
        this.sparkSizes[i] = 0;
      }
    }
    this.sparkGeometry.attributes.position.needsUpdate = true;
    this.sparkGeometry.attributes.color.needsUpdate = true;
    this.sparkGeometry.attributes.size.needsUpdate = true;
  }

  public dispose() {
    for (const points of [this.exhaustPoints, this.dustPoints, this.sparkPoints]) {
      this.scene.remove(points);
      points.geometry.dispose();
      (points.material as THREE.Material).dispose();
    }
  }
}
