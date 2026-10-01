import assert from 'node:assert/strict';
import { createServer } from 'vite';
import * as THREE from 'three';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const { solveTwoBoneIK } = await server.ssrLoadModule('/src/game/Rider/RiderIK.ts');
  const { StickRider } = await server.ssrLoadModule('/src/game/Rider/StickRider.ts');
  const { RIDER_CONFIGS, PROCEDURAL_RIDER_CONFIG } = await server.ssrLoadModule('/src/game/Rider/RiderConfig.ts');
  const distance = (a, b) => a.distanceTo(b);
  for (const pole of [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, -1, 0)]) {
    for (const target of [new THREE.Vector3(0, -.4, 0), new THREE.Vector3(0, -.6, .01)]) {
      const start = new THREE.Vector3();
      const solved = solveTwoBoneIK(start, target, .3, .32, pole);
      assert.ok(Math.abs(distance(start, solved.joint) - .3) < 1e-7);
      assert.ok(Math.abs(distance(solved.joint, solved.end) - .32) < 1e-7);
      assert.ok(distance(solved.end, target) < 1e-7);
    }
  }
  for (const target of [new THREE.Vector3(), new THREE.Vector3(0, -10, 0)]) {
    const solved = solveTwoBoneIK(new THREE.Vector3(), target, .3, .2, new THREE.Vector3(0, -1, 0));
    assert.ok(solved.joint.toArray().every(Number.isFinite), 'Degenerate IK produced NaN');
    assert.ok(distance(solved.end, target) < 1e-7, 'Unreachable target lost contact');
  }
  for (const [id, config] of Object.entries({ ...RIDER_CONFIGS, procedural: PROCEDURAL_RIDER_CONFIG })) {
    const body = new THREE.Group();
    const rider = new StickRider(config, '#ef4444');
    body.add(rider.group);
    assert.equal(rider.group.getObjectByName('Head'), undefined, 'Rider must have no head mesh');
    assert.ok(rider.group.getObjectByName('HelmetAnchor'));
    const contacts = {
      Pelvis: 'seat', LeftHand: 'leftHandlebar', RightHand: 'rightHandlebar',
      LeftFoot: 'leftFootPeg', RightFoot: 'rightFootPeg',
    };
    for (const angle of [0, .6, 1.4, 2.7]) {
      body.position.set(35, 2, 80);
      body.rotation.set(-angle, .8, -.23);
      body.updateMatrixWorld(true);
      for (const [nodeName, pointName] of Object.entries(contacts)) {
        const actual = rider.group.getObjectByName(nodeName).getWorldPosition(new THREE.Vector3());
        const expected = body.localToWorld(new THREE.Vector3().fromArray(config[pointName]));
        assert.ok(distance(actual, expected) < 1e-7, `${id}: ${nodeName} lost contact at ${angle}`);
      }
    }
    rider.debug?.setEnabled(false);
    assert.equal(rider.debug?.group.visible ?? false, false);
    rider.dispose();
    assert.equal(body.children.length, 0);
    console.log(`PASS ${id}: seat/grips/pegs stay attached through translation, roll, yaw and wheelie`);
  }
  console.log('PASS IK lengths, degenerate poles, unreachable contacts, no head, debug toggle and disposal');
} finally { await server.close(); }
