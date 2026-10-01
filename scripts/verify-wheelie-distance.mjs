import assert from 'node:assert/strict';
import { PhysicsEngine } from '../src/game/PhysicsEngine.ts';
const controls = { throttle: false, rearBrake: false, leanBack: false, steerLeft: false, steerRight: false };
for (const fps of [30, 60, 120]) {
  const bike = new PhysicsEngine();
  const step = (input = {}) => bike.update(1 / fps, { ...controls, ...input });
  bike.setEngineRunning(false);
  const engineOffStart = bike.getState();
  for (let i = 0; i < fps; i++) step({ throttle: true, steerLeft: true, rearBrake: true });
  const engineOffEnd = bike.getState();
  assert.equal(engineOffEnd.speed, 0, 'Engine OFF must block throttle movement');
  assert.equal(engineOffEnd.positionZ, engineOffStart.positionZ, 'Engine OFF must block forward movement');
  assert.equal(engineOffEnd.positionX, engineOffStart.positionX, 'Engine OFF must block steering movement');
  bike.setEngineRunning(true);
  bike.speed = 10;
  for (let i = 0; i < fps; i++) assert.equal(step().wheelieDistance, 0, 'Ground travel must not count');
  let state;
  for (let i = 0; i < fps / 2; i++) state = step({ throttle: true, leanBack: true });
  assert.ok(state.pitch > 0 && state.wheelieDistance > 0, 'Wheelie distance should increase');
  const firstDistance = state.wheelieDistance;
  for (let i = 0; i < fps * 2; i++) {
    state = step({ rearBrake: true });
    if (state.pitch === 0) break;
  }
  assert.equal(state.pitch, 0, 'Front wheel should land');
  assert.equal(state.wheelieDistance, 0, 'Landing must immediately reset distance');
  assert.ok(state.positionZ > firstDistance, 'World movement must remain intact');
  bike.speed = 10;
  for (let i = 0; i < fps / 4; i++) state = step({ throttle: true, leanBack: true });
  assert.ok(state.wheelieDistance > 0 && state.wheelieDistance < firstDistance, 'Next wheelie starts from zero');
  for (let i = 0; i < fps * 5 && !state.isCrashed; i++) state = step({ throttle: true, leanBack: true });
  assert.ok(state.isCrashed);
  assert.equal(state.wheelieDistance, 0, 'Crash clears current wheelie');
  bike.reset();
  assert.equal(bike.getState().wheelieDistance, 0);
  console.log(`PASS ${fps} FPS: ground movement, lift, touchdown, next wheelie, crash and restart`);
}
