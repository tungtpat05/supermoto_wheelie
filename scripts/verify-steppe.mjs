import assert from 'node:assert/strict';
import { createServer } from 'vite';
import * as THREE from 'three';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
// Canvas textures do not need a GPU for pool/physics checks.
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => null }) };
try {
  const { terrainHeight } = await server.ssrLoadModule('/src/game/SteppeTerrain.ts');
  const { RealisticParticleSystem } = await server.ssrLoadModule('/src/game/RealisticParticleSystem.ts');
  for (const fps of [30, 60, 120]) {
    const scene = new THREE.Scene();
    const system = new RealisticParticleSystem(scene);
    const pos = new THREE.Vector3(80, terrainHeight(80, 200) + .045, 200);
    for (let i = 0; i < fps; i++) { system.emitRidingDust(pos, 3, true, 1 / fps); system.update(1 / fps); }
    const count = system.dustPool.filter(p => p.active).length;
    assert.ok(Math.abs(count - 95) <= 1, `${fps} FPS: unexpected launch count ${count}`);
    assert.ok(system.dustPool.filter(p => p.active).every(p => p.position.y >= terrainHeight(p.position.x, p.position.z)), 'Dust below ground');
    assert.ok(system.dustOpacities.some(alpha => alpha > 0 && alpha < .58), 'Dust must fade');
    system.reset();
    system.update(0);
    assert.ok(system.dustSizes.every(size => size === 0), 'Reset left visible dust');
    for (let i = 0; i < fps; i++) { system.emitRidingDust(pos, 0, false, 1 / fps); system.update(1 / fps); }
    assert.equal(system.dustPool.filter(p => p.active).length, 0, 'Stopped bike emits dust');
    for (let i = 0; i < fps; i++) { system.emitRidingDust(pos, 14, false, 1 / fps); system.update(1 / fps); }
    assert.ok(system.dustPool.some(p => p.active), 'Coasting must emit dust');
    for (let i = 0; i < fps * 3; i++) system.update(1 / fps);
    assert.ok(system.dustOpacities.every(alpha => alpha === 0), 'Dust did not expire');
    system.dispose();
    assert.equal(scene.children.length, 0);
    console.log(`PASS ${fps} FPS: launch, coasting, terrain contact, fade, reset and disposal`);
  }
  for (let z = -600; z < 12000; z += 17) {
    for (const x of [-200, 0, 200]) {
      assert.ok(Math.abs(terrainHeight(x, z + 1) - terrainHeight(x, z)) < .045, 'Abrupt riding slope');
    }
  }
  console.log('PASS gentle rideable slopes across 12 km');
  const { HDRLoader } = await import('three/examples/jsm/loaders/HDRLoader.js');
  const originalLoad = HDRLoader.prototype.load;
  const originalTextureLoad = THREE.TextureLoader.prototype.load;
  HDRLoader.prototype.load = () => new THREE.DataTexture();
  THREE.TextureLoader.prototype.load = () => new THREE.Texture();
  try {
    const { EnvironmentManager } = await server.ssrLoadModule('/src/game/EnvironmentManager.ts');
    const scene = new THREE.Scene();
    const env = new EnvironmentManager(scene);
    const { QUALITY_PRESETS } = await server.ssrLoadModule('/src/game/GraphicsQuality.ts');
    let previousGrassCount = 0;
    for (const [quality, preset] of Object.entries(QUALITY_PRESETS)) {
      env.setQuality(quality);
      env.update(0, 0);
      const grass = scene.getObjectByName('Local grass chunks').children;
      const count = grass.reduce((sum, mesh) => sum + mesh.count, 0);
      assert.ok(count > previousGrassCount, `${quality} must increase grass density`);
      previousGrassCount = count;
      const sun = scene.children.find(o => o.isDirectionalLight);
      assert.equal(sun.castShadow, preset.shadows);
      assert.equal(sun.shadow.mapSize.x, preset.shadowSize);
    }
    console.log('PASS Low / Medium / High / Ultra: grass density and shadow settings');
    const initialGrass = scene.getObjectByName('Local grass chunks').children.map(mesh => Array.from(mesh.instanceMatrix.array));
    for (const z of [0, 561, 2800, 12000, 0]) {
      env.update(z, 1 / 60, 190);
      const grounds = scene.children.filter(o => o.isMesh && o.geometry.type === 'PlaneGeometry').sort((a, b) => a.position.z - b.position.z);
      assert.equal(grounds.length, 12);
      for (let i = 1; i < grounds.length; i++) {
        assert.equal(grounds[i].position.z - grounds[i - 1].position.z, 160, 'Gap between recycled tiles');
        const left = grounds[i - 1].geometry.attributes.position;
        const right = grounds[i].geometry.attributes.position;
        // PlaneGeometry rotated onto XZ: first row is -Z, last row is +Z.
        for (let j = 0; j <= 400; j += 20) {
          assert.ok(Math.abs(left.getY(40 * 401 + j) - right.getY(j)) < .00001, 'Height seam between tiles');
        }
      }
      assert.ok(grounds[0].position.z - 80 < z - 300 && grounds.at(-1).position.z + 80 > z + 1000);
      // Raycast the rendered triangles independently of the grass height helper.
      scene.updateMatrixWorld(true);
      const grass = scene.getObjectByName('Local grass chunks').children;
      assert.equal(grass.length, 49, 'Vegetation pool grew during streaming');
      const ray = new THREE.Raycaster();
      const matrix = new THREE.Matrix4(), root = new THREE.Vector3();
      for (const mesh of grass.filter((_, i) => i % 6 === 0)) {
        for (const index of [0, Math.floor(mesh.count / 2), mesh.count - 1]) {
          mesh.getMatrixAt(index, matrix);
          root.setFromMatrixPosition(matrix).add(mesh.position);
          ray.set(new THREE.Vector3(root.x, 20, root.z), new THREE.Vector3(0, -1, 0));
          const hits = ray.intersectObjects(grounds, false);
          assert.ok(hits.length, 'Grass outside terrain');
          const clearance = root.y - hits[0].point.y;
          assert.ok(clearance > .002 && clearance < .006, `Grass root floating or buried: ${clearance}`);
        }
      }
    }
    env.reset();
    const resetGrass = scene.getObjectByName('Local grass chunks').children;
    resetGrass.forEach((mesh, i) => assert.deepEqual(Array.from(mesh.instanceMatrix.array).slice(0, mesh.count * 16), initialGrass[i].slice(0, mesh.count * 16), 'Restart changed grass distribution'));
    env.dispose();
    assert.equal(scene.children.length, 0, 'Environment leaked scene objects');
    console.log('PASS terrain recycling, seams, grass root contact, bounded streaming, deterministic restart and disposal');
  } finally {
    HDRLoader.prototype.load = originalLoad;
    THREE.TextureLoader.prototype.load = originalTextureLoad;
  }
} finally { await server.close(); }
