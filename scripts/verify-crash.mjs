import assert from 'node:assert/strict';
import { createServer } from 'vite';
import * as THREE from 'three';
import { PhysicsEngine, CRASH_LAND_TIME } from '../src/game/PhysicsEngine.ts';

const controls = { throttle: false, rearBrake: false, steerLeft: false, steerRight: false };
function crash(side, speed = 20, steering = .4) {
  let choices = 0;
  const bike = new PhysicsEngine(() => { choices++; return side < 0 ? .1 : .9; });
  bike.speed = speed;
  bike.steering = steering;
  bike.pitch = bike.crashAngle - .001;
  bike.pitchVelocity = 1;
  bike.update(1 / 120, { ...controls, throttle: true, steerLeft: steering > 0, steerRight: steering < 0 });
  assert.ok(bike.isCrashed);
  assert.equal(bike.bikeCrashRotation.x, -bike.crashAngle, 'Crash starts at the wheelie angle');
  return { bike, choices: () => choices };
}

for (const side of [-1, 1]) {
  let reference;
  for (const fps of [15, 30, 60, 120]) {
    const { bike, choices } = crash(side);
    const start = bike.getState();
    let previousSpeed = start.speed, previousZ = start.positionZ;
    let settledRotation;
    for (let i = 0; i < 6 * fps; i++) {
      // Inputs, including engine toggling, cannot re-accelerate or spin a crash.
      if (i === fps) bike.setEngineRunning(false);
      const state = bike.update(1 / fps, { throttle: true, rearBrake: true, steerLeft: true, steerRight: false });
      assert.ok(state.pitch >= 0 && state.pitch <= Math.PI / 2 + THREE.MathUtils.degToRad(7) + 1e-10, 'Backflip exceeded tip limit');
      assert.ok(Math.abs(state.roll) <= Math.PI / 2, 'Side roll exceeded ground contact');
      assert.ok(state.speed <= previousSpeed + 1e-10 && state.speed >= 0, 'Crash re-accelerated');
      assert.ok(state.positionZ >= previousZ, 'Slide reversed');
      assert.equal(state.wheelieDistance, 0);
      if (bike.crashGrounded) {
        assert.ok(bike.crashTime >= CRASH_LAND_TIME);
        assert.equal(state.pitch, 0);
        assert.equal(state.roll, side * Math.PI / 2);
        assert.equal(state.pitchVelocity, 0);
        assert.equal(state.rollVelocity, 0);
        if (settledRotation) assert.ok(settledRotation.equals(bike.bikeCrashRotation), 'Rotation changed after impact');
        settledRotation = bike.bikeCrashRotation.clone();
      }
      previousSpeed = state.speed; previousZ = state.positionZ;
    }
    const end = bike.getState();
    assert.equal(choices(), 1, 'Fall direction rerolled during the crash');
    assert.equal(end.speed, 0, 'Friction must bring the slide to rest');
    const incomingRatio = start.steering * .18;
    const slideRatio = (end.positionX - start.positionX) / (end.positionZ - start.positionZ);
    assert.ok(Math.abs(incomingRatio - slideRatio) < 1e-9, 'Lost incoming travel direction');
    if (reference) {
      assert.ok(Math.abs(end.positionZ - reference.positionZ) < 1e-8, 'Slide distance depends on FPS');
      assert.ok(Math.abs(end.positionX - reference.positionX) < 1e-8);
    }
    reference = end;
    bike.update(10, controls);
    assert.equal(bike.positionZ, end.positionZ, 'Stopped crash keeps drifting');
    bike.reset();
    assert.ok(!bike.isCrashed && !bike.crashGrounded);
    assert.equal(bike.crashTime, 0);
    assert.equal(bike.bikeCrashRotation.length(), 0);
    assert.equal(bike.rollVelocity, 0);
    console.log(`PASS ${fps} FPS, side ${side}: bounded fall, stable impact, incoming momentum, friction, reset`);
  }
}

// An impact crossed within one long frame must integrate both phases correctly.
const coarse = crash(1).bike, fine = crash(1).bike;
coarse.update(2, controls);
for (let i = 0; i < 240; i++) fine.update(1 / 120, controls);
assert.ok(Math.abs(coarse.positionZ - fine.positionZ) < 1e-8);
assert.ok(coarse.bikeCrashRotation.equals(fine.bikeCrashRotation));
console.log('PASS long-frame impact transition');

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { createSupermotoBike } = await server.ssrLoadModule('/src/game/SupermotoMesh.ts');
  const { BikeCrashPose } = await server.ssrLoadModule('/src/game/BikeCrashPose.ts');
  const { terrainHeight } = await server.ssrLoadModule('/src/game/SteppeTerrain.ts');
  const parts = createSupermotoBike(), pose = new BikeCrashPose();
  const ridingArms = ['LeftUpperArm', 'LeftForearm', 'LeftHand', 'RightUpperArm', 'RightForearm', 'RightHand'].map(name => {
    const object = parts.rider.group.getObjectByName(name);
    return { object, position: object.position.clone(), quaternion: object.quaternion.clone() };
  });
  const point = new THREE.Vector3();
  for (const side of [-1, 1]) {
    for (const [x, z] of [[0, 0], [-150, 350], [180, 12000]]) {
      pose.reset();
      const { bike } = crash(side);
      bike.positionX = x; bike.positionZ = z;
      for (let i = 0; i < 100; i++) {
        bike.update(.02, controls);
        pose.update(parts, bike);
        parts.bikeGroup.updateMatrixWorld(true);
        let lowestClearance = Infinity;
        // Independently sample actual mesh vertices across the rendered assembly.
        parts.bodyGroup.traverseVisible(object => {
          if (!object.isMesh) return;
          const positions = object.geometry.attributes.position;
          for (let j = 0; j < positions.count; j += Math.max(1, Math.floor(positions.count / 40))) {
            point.fromBufferAttribute(positions, j).applyMatrix4(object.matrixWorld);
            const clearance = point.y - terrainHeight(point.x, point.z);
            lowestClearance = Math.min(lowestClearance, clearance);
            assert.ok(clearance > -.005, `Bike/rider below terrain at ${x}, ${z}: ${clearance}`);
          }
        });
        if (bike.crashGrounded) assert.ok(lowestClearance < .13, `Grounded bike floating: ${lowestClearance}`);
      }
    }
  }
  pose.reset();
  for (const arm of ridingArms) {
    assert.ok(arm.object.position.distanceTo(arm.position) < 1e-10, 'Restart left hands detached from grips');
    assert.ok(arm.object.quaternion.angleTo(arm.quaternion) < 1e-7, 'Restart left a folded arm');
  }
  parts.rider.dispose();
  console.log('PASS bike/rider terrain contact on both sides, slopes and riding-pose restoration');
} finally { await server.close(); }
