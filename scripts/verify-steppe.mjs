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
  HDRLoader.prototype.load = () => new THREE.DataTexture();
  try {
    const { EnvironmentManager } = await server.ssrLoadModule('/src/game/EnvironmentManager.ts');
    const scene = new THREE.Scene();
    const env = new EnvironmentManager(scene);
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
    }
    env.reset();
    env.dispose();
    console.log('PASS terrain recycling, seam continuity, large jumps and restart');
  } finally { HDRLoader.prototype.load = originalLoad; }
} finally { await server.close(); }
