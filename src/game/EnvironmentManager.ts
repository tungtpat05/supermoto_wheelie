import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { RealisticParticleSystem } from './RealisticParticleSystem';
import { terrainHeight, terrainWear } from './SteppeTerrain';
import { QUALITY_PRESETS, type GraphicsQuality } from './GraphicsQuality';

const LENGTH = 160;
const COUNT = 12;
const WIDTH = 2400;
const GRASS_COUNT = 24000;
interface TerrainTile {
  ground: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  grass: THREE.InstancedMesh;
  seed: number;
  fullGrassCount: number;
}

export class EnvironmentManager {
  private scene: THREE.Scene;
  private tiles: TerrainTile[] = [];
  private particleSystem: RealisticParticleSystem;
  private backdrop = new THREE.Group();
  private sun = new THREE.DirectionalLight(0xffd296, 2.1);
  private wind = { value: 0 };
  private disposed = false;
  private quality: GraphicsQuality = 'High';

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.particleSystem = new RealisticParticleSystem(scene);
    this.setupSkyAndLighting();
    this.createTerrain();
  }

  private setupSkyAndLighting() {
    this.scene.fog = new THREE.FogExp2(0xdac8a4, 0.00105);
    this.scene.add(new THREE.HemisphereLight(0xd6e3e4, 0x9c7846, 1.35));
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { near: 1, far: 240, left: -35, right: 35, top: 35, bottom: -35 });
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.035;
    this.scene.add(this.sun, this.sun.target);
    new HDRLoader().load('/environment/hdri/lebombo_1k.hdr', texture => {
      if (this.disposed) { texture.dispose(); return; }
      texture.mapping = THREE.EquirectangularReflectionMapping;
      this.scene.environment = texture;
      this.scene.environmentIntensity = 0.35;
    });

    const sky = new THREE.Mesh(new THREE.SphereGeometry(2000, 32, 20), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false,
      vertexShader: `varying vec3 vDirection;
        void main() { vDirection = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: `varying vec3 vDirection;
        void main() {
          vec3 d = normalize(vDirection);
          vec3 sky = mix(vec3(.65,.48,.29), vec3(.18,.38,.58), pow(max(d.y, 0.), .45));
          float sun = max(dot(d, normalize(vec3(-.65,.22,.75))), 0.);
          sky += vec3(.35,.21,.08) * pow(sun, 24.);
          sky = mix(sky, vec3(1.,.91,.66), smoothstep(.99965,.99985,sun));
          gl_FragColor = vec4(sky, 1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }));
    this.backdrop.add(sky);

    // Two broad, irregular ridgelines keep the horizon distant without enclosing the rider.
    for (let layer = 0; layer < 2; layer++) {
      const geo = new THREE.PlaneGeometry(1, 1, 180, 10);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const u = (i % 181) / 180;
        const v = Math.floor(i / 181) / 10;
        const a = u * Math.PI * 2;
        const r = 850 + layer * 350 + v * 280;
        const peaks = 28 + 24 * Math.sin(a * 3 + layer) ** 2 + 48 * Math.sin(a * 5 - 1.2) ** 6;
        p.setXYZ(i, Math.cos(a) * r, -14 + Math.sin(v * Math.PI) * peaks, Math.sin(a) * r);
      }
      geo.computeVertexNormals();
      const hills = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
        color: layer ? 0x8b9290 : 0x92917b, roughness: 1, side: THREE.DoubleSide,
      }));
      this.backdrop.add(hills);
    }
    this.scene.add(this.backdrop);
  }

  private createTerrain() {
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = 'varying vec3 vEarth;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvEarth = (modelMatrix * vec4(position, 1.)).xyz;');
      shader.fragmentShader = `varying vec3 vEarth;
        float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        float noise(vec2 p) {
          vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);
        }\n` + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `
        #include <color_fragment>
        vec2 p = vEarth.xz;
        float track = p.x - sin(p.y*.008)*16. - sin(p.y*.023)*4.;
        float ruts = exp(-pow((abs(track)-1.5)/.85,2.));
        float clearing = max(0.,sin(p.x*.026+p.y*.016)*cos(p.y*.021-p.x*.013));
        float wear = max(ruts*.94,max(exp(-pow(track/6.,2.))*.62,pow(clearing,3.)));
        float patches = noise(p*.035)*.65 + noise(p*.19)*.35;
        vec3 turf = mix(vec3(.23,.265,.105),vec3(.47,.405,.21),patches);
        vec3 earth = mix(vec3(.39,.285,.155),vec3(.53,.405,.245),noise(p*.34));
        float grain = .87 + .19*noise(p*8.) + .06*noise(p*29.);
        diffuseColor.rgb *= mix(turf,earth,smoothstep(.12,.88,wear))*grain;
      `);
    };

    // Each tuft has three tapered, slightly bent blades. Instances keep draw calls low.
    const blade = new THREE.BufferGeometry();
    const vertices: number[] = [];
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI / 2.5;
      const x = Math.cos(a) * .022, z = Math.sin(a) * .022;
      vertices.push(-x, 0, -z, x, 0, z, Math.cos(a) * .06, .7 + i * .07, Math.sin(a) * .06);
    }
    blade.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    blade.computeVertexNormals();
    const grassMat = new THREE.MeshStandardMaterial({ roughness: 1, side: THREE.DoubleSide });
    grassMat.onBeforeCompile = (shader) => {
      shader.uniforms.steppeTime = this.wind;
      shader.vertexShader = 'uniform float steppeTime;\nvarying float vBladeHeight;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        vBladeHeight = position.y;
        transformed.x += sin(steppeTime*1.6 + instanceMatrix[3].x*.3 + instanceMatrix[3].z*.17)*.10*position.y*position.y;
      `);
      shader.fragmentShader = 'varying float vBladeHeight;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',
        '#include <color_fragment>\ndiffuseColor.rgb *= mix(vec3(.58,.60,.40),vec3(1.12,1.05,.79),vBladeHeight);');
    };
    for (let i = 0; i < COUNT; i++) {
      const geo = new THREE.PlaneGeometry(WIDTH, LENGTH, 400, 40);
      geo.rotateX(-Math.PI / 2);
      const ground = new THREE.Mesh(geo, material);
      ground.receiveShadow = true;
      const grass = new THREE.InstancedMesh(blade, grassMat, GRASS_COUNT);
      grass.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const tile = { ground, grass, seed: 1234 + i * 97, fullGrassCount: 0 };
      this.tiles.push(tile);
      this.placeTile(tile, (i - 3) * LENGTH);
      this.scene.add(ground, grass);
    }
  }

  private placeTile(tile: TerrainTile, centerZ: number) {
    tile.ground.position.z = centerZ;
    tile.grass.position.z = centerZ;
    const p = tile.ground.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i, terrainHeight(p.getX(i), p.getZ(i) + centerZ));
    p.needsUpdate = true;
    tile.ground.geometry.computeVertexNormals();
    tile.ground.geometry.computeBoundingSphere();
    let seed = tile.seed;
    const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    let count = 0;
    for (let i = 0; i < GRASS_COUNT; i++) {
      const x = (random() - .5) * 640, z = (random() - .5) * LENGTH;
      const wear = terrainWear(x, z + centerZ);
      if (random() < wear * .97) continue;
      dummy.position.set(x, terrainHeight(x, z + centerZ) - .025, z);
      dummy.rotation.y = random() * Math.PI * 2;
      const height = .14 + random() * .23;
      dummy.scale.set(.8 + random() * .7, height, .8 + random() * .7);
      dummy.updateMatrix();
      tile.grass.setMatrixAt(count, dummy.matrix);
      color.setHSL(.13 + random() * .095, .27 + random() * .16, .26 + random() * .17);
      tile.grass.setColorAt(count++, color);
    }
    tile.fullGrassCount = count;
    tile.grass.count = Math.floor(count * QUALITY_PRESETS[this.quality].grassDensity);
    tile.grass.instanceMatrix.needsUpdate = true;
    if (tile.grass.instanceColor) tile.grass.instanceColor.needsUpdate = true;
    tile.grass.computeBoundingSphere();
  }

  public emitExhaust(pos: THREE.Vector3, rpm: number, throttle: boolean, twoStroke: boolean, delta: number) {
    this.particleSystem.emitExhaust(pos, rpm, throttle, twoStroke, delta);
  }

  public emitRidingDust(pos: THREE.Vector3, speed: number, throttle: boolean, delta: number) {
    this.particleSystem.emitRidingDust(pos, speed, throttle, delta);
  }

  public emitSparks(pos: THREE.Vector3, count = 4) { this.particleSystem.emitSparks(pos, count); }

  public setQuality(quality: GraphicsQuality) {
    this.quality = quality;
    const preset = QUALITY_PRESETS[quality];
    this.sun.castShadow = preset.shadows;
    if (this.sun.shadow.mapSize.x !== preset.shadowSize) {
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
      this.sun.shadow.mapSize.set(preset.shadowSize, preset.shadowSize);
    }
    this.tiles.forEach(tile => {
      tile.grass.count = Math.floor(tile.fullGrassCount * preset.grassDensity);
      tile.grass.computeBoundingSphere();
    });
  }

  public reset() {
    this.tiles.forEach((tile, i) => this.placeTile(tile, (i - 3) * LENGTH));
    this.particleSystem.reset();
    this.update(0, 0, 0);
  }

  public update(playerZ: number, delta: number, playerX = 0) {
    for (const tile of this.tiles) {
      let z = tile.ground.position.z;
      while (z < playerZ - 3.5 * LENGTH) z += COUNT * LENGTH;
      while (z > playerZ + 8.5 * LENGTH) z -= COUNT * LENGTH;
      if (z !== tile.ground.position.z) this.placeTile(tile, z);
      tile.grass.visible = Math.abs(z - playerZ) < QUALITY_PRESETS[this.quality].grassDistance + LENGTH / 2;
    }
    this.backdrop.position.set(playerX * .7, 0, playerZ);
    this.sun.position.set(playerX - 65, 45, playerZ + 75);
    this.sun.target.position.set(playerX, 0, playerZ);
    this.wind.value += delta;
    this.particleSystem.update(delta);
  }

  public dispose() {
    this.disposed = true;
    this.scene.environment?.dispose();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    for (const object of [...this.tiles.flatMap(t => [t.ground, t.grass]), this.backdrop]) {
      object.traverse(child => {
        if (child instanceof THREE.Mesh) {
          geometries.add(child.geometry);
          (Array.isArray(child.material) ? child.material : [child.material]).forEach(m => materials.add(m));
          if (child instanceof THREE.InstancedMesh) child.dispose();
        }
      });
      this.scene.remove(object);
    }
    geometries.forEach(g => g.dispose());
    materials.forEach(m => m.dispose());
    this.sun.dispose();
    this.particleSystem.dispose();
  }
}
