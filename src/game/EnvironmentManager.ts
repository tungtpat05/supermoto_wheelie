import * as THREE from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { RealisticParticleSystem } from './RealisticParticleSystem';
import { terrainHeight } from './SteppeTerrain';
import { QUALITY_PRESETS, type GraphicsQuality } from './GraphicsQuality';
import { createGrasslandMaterial } from './GrasslandMaterial';
import { createGrasslandSky, createGrasslandHills, SUN_DIRECTION } from './GrasslandSky';
import { GrasslandVegetation } from './GrasslandVegetation';

const LENGTH = 160;
const COUNT = 12;
const WIDTH = 2400;
interface TerrainTile {
  ground: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  shrubs: THREE.InstancedMesh;
}

export class EnvironmentManager {
  private scene: THREE.Scene;
  private tiles: TerrainTile[] = [];
  private particleSystem: RealisticParticleSystem;
  private backdrop = new THREE.Group();
  private sun = new THREE.DirectionalLight(0xffefd9, 2.65);
  private ambient = new THREE.HemisphereLight(0xc8dff5, 0x736c55, 1.05);
  private wind = { value: 0 };
  private vegetation: GrasslandVegetation;
  private sky: THREE.Mesh;
  private groundTexture: THREE.Texture;
  private environmentTexture: THREE.Texture | null = null;
  private disposed = false;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.particleSystem = new RealisticParticleSystem(scene);
    this.sky = createGrasslandSky(this.wind);
    this.groundTexture = new THREE.TextureLoader().load('/environment/textures/grass_color.jpg');
    this.groundTexture.colorSpace = THREE.SRGBColorSpace;
    this.groundTexture.wrapS = this.groundTexture.wrapT = THREE.RepeatWrapping;
    this.groundTexture.anisotropy = 8;
    this.setupSkyAndLighting();
    this.createTerrain();
    this.vegetation = new GrasslandVegetation(this.wind);
    this.scene.add(this.vegetation.group);
    this.update(0,0);
  }

  private setupSkyAndLighting() {
    this.scene.fog = new THREE.FogExp2(0xbfcfdc,.0007);
    this.scene.add(this.ambient);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048,2048);
    Object.assign(this.sun.shadow.camera,{near:1,far:240,left:-24,right:24,top:24,bottom:-24});
    this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.shadow.bias = -.00015;
    this.sun.shadow.normalBias = .022;
    this.sun.shadow.radius = 2;
    this.scene.add(this.sun,this.sun.target);
    new HDRLoader().load('/environment/hdri/lebombo_1k.hdr',texture => {
      if (this.disposed) { texture.dispose(); return; }
      texture.mapping = THREE.EquirectangularReflectionMapping;
      this.environmentTexture = texture;
      this.scene.environment = texture;
      this.scene.environmentIntensity = .25;
    });
    this.backdrop = createGrasslandHills();
    this.scene.add(this.sky,this.backdrop);
  }

  private createTerrain() {
    const material = createGrasslandMaterial(this.groundTexture);
    // A cheap underlay closes the view beyond the recycled tiles when orbiting
    // backwards. It sits below the rideable surface and adds no contact geometry.
    const apronGeo = new THREE.PlaneGeometry(4200,4200);
    apronGeo.rotateX(-Math.PI/2);
    const apron = new THREE.Mesh(apronGeo,material);
    apron.name = 'Distant ground apron';
    apron.position.y = -8;
    // Let the riding tiles fill depth first so the hidden apron costs no shading.
    apron.renderOrder = 1;
    this.backdrop.add(apron);
    const shrubGeo = new THREE.IcosahedronGeometry(1,1);
    const shrubMat = new THREE.MeshStandardMaterial({color:0xffffff,roughness:1});
    for (let i = 0; i < COUNT; i++) {
      // Preserve mesh resolution and the existing continuous rideable surface.
      const geo = new THREE.PlaneGeometry(WIDTH,LENGTH,400,40);
      geo.rotateX(-Math.PI/2);
      const ground = new THREE.Mesh(geo,material);
      ground.name = 'Rideable grassland';
      ground.receiveShadow = true;
      const shrubs = new THREE.InstancedMesh(shrubGeo,shrubMat,54);
      shrubs.name = 'Distant scrub islands';
      const tile = {ground,shrubs};
      this.tiles.push(tile);
      this.placeTile(tile,(i-3)*LENGTH);
      this.scene.add(ground,shrubs);
    }
  }

  private placeTile(tile: TerrainTile, centerZ: number) {
    tile.ground.position.z = centerZ;
    tile.shrubs.position.z = centerZ;
    const p = tile.ground.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) p.setY(i,terrainHeight(p.getX(i),p.getZ(i)+centerZ));
    p.needsUpdate = true;
    tile.ground.geometry.computeVertexNormals();
    tile.ground.geometry.computeBoundingSphere();
    // Stable world seed and distant, low scrub keep the central practice field open.
    let seed = (Math.imul(centerZ/LENGTH,73537)^928371)>>>0;
    const random = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296; };
    const dummy = new THREE.Object3D(), color = new THREE.Color();
    for (let i = 0; i < 18; i++) {
      const x = (i%2 ? -1:1)*(110+random()*370);
      const z = (random()-.5)*LENGTH;
      const size = 1+random()*1.8;
      for (let lobe = 0; lobe < 3; lobe++) {
        const lx = x+(lobe-1)*size*.65, lz = z+random()*size;
        const height = size*(.38+random()*.2);
        dummy.position.set(lx,terrainHeight(lx,lz+centerZ)+height*.65,lz);
        dummy.rotation.set(random()*.2,random()*Math.PI,random()*.2);
        dummy.scale.set(size*.7,height,size*.6);
        dummy.updateMatrix();
        tile.shrubs.setMatrixAt(i*3+lobe,dummy.matrix);
        color.setHSL(.21+random()*.04,.18+random()*.14,.19+random()*.09);
        tile.shrubs.setColorAt(i*3+lobe,color);
      }
    }
    tile.shrubs.instanceMatrix.needsUpdate = true;
    if (tile.shrubs.instanceColor) tile.shrubs.instanceColor.needsUpdate = true;
    tile.shrubs.computeBoundingSphere();
  }

  public emitExhaust(pos: THREE.Vector3,rpm: number,throttle: boolean,twoStroke: boolean,delta: number) {
    this.particleSystem.emitExhaust(pos,rpm,throttle,twoStroke,delta);
  }
  public emitRidingDust(pos: THREE.Vector3,speed: number,throttle: boolean,delta: number) {
    this.particleSystem.emitRidingDust(pos,speed,throttle,delta);
  }
  public clearExhaust() { this.particleSystem.clearExhaust(); }
  public emitSparks(pos: THREE.Vector3,count = 4) { this.particleSystem.emitSparks(pos,count); }

  public setQuality(quality: GraphicsQuality) {
    const preset = QUALITY_PRESETS[quality];
    this.sun.castShadow = preset.shadows;
    if (this.sun.shadow.mapSize.x !== preset.shadowSize) {
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
      this.sun.shadow.mapSize.set(preset.shadowSize,preset.shadowSize);
    }
    this.vegetation.setQuality(quality);
  }

  public reset() {
    this.tiles.forEach((tile,i) => this.placeTile(tile,(i-3)*LENGTH));
    this.particleSystem.reset();
    this.update(0,0,0);
  }

  public update(playerZ: number,delta: number,playerX = 0) {
    for (const tile of this.tiles) {
      let z = tile.ground.position.z;
      while (z < playerZ-3.5*LENGTH) z += COUNT*LENGTH;
      while (z > playerZ+8.5*LENGTH) z -= COUNT*LENGTH;
      if (z !== tile.ground.position.z) this.placeTile(tile,z);
    }
    this.vegetation.update(playerX,playerZ);
    this.sky.position.set(playerX,0,playerZ);
    // A little parallax in both axes makes the ridgelines feel distant, not painted.
    this.backdrop.position.set(playerX+Math.sin(playerX*.0015)*50,0,playerZ+Math.sin(playerZ*.001)*40);
    this.sun.target.position.set(playerX,terrainHeight(playerX,playerZ),playerZ);
    this.sun.position.copy(this.sun.target.position).addScaledVector(SUN_DIRECTION,112);
    this.wind.value += delta;
    this.particleSystem.update(delta);
  }

  public dispose() {
    this.disposed = true;
    if (this.scene.environment === this.environmentTexture) this.scene.environment = null;
    this.environmentTexture?.dispose();
    this.groundTexture.dispose();
    this.vegetation.dispose();
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    for (const object of [...this.tiles.flatMap(t => [t.ground,t.shrubs]),this.backdrop,this.sky]) {
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
    this.scene.remove(this.sun,this.sun.target,this.ambient);
    this.sun.dispose();
    this.particleSystem.dispose();
  }
}
