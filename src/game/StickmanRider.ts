import * as THREE from 'three';

/**
 * Creates a stylish 3D Stickman Motocross Rider.
 * Limbs are mathematically connected between joints and hands hold the handlebars.
 */
export function createStickmanRider(accentColor: string | number = 0xef4444): THREE.Group {
  const riderGroup = new THREE.Group();

  const colorHex = typeof accentColor === 'string'
    ? parseInt(accentColor.replace('#', '0x'), 16)
    : accentColor;

  // Materials
  const stickmanMat = new THREE.MeshStandardMaterial({
    color: 0x18181b, // Sleek matte charcoal stickman body
    roughness: 0.6,
    metalness: 0.1,
  });

  const jointMat = new THREE.MeshStandardMaterial({
    color: 0x27272a, // Slightly lighter joint spheres
    roughness: 0.5,
    metalness: 0.2,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: colorHex, // Accent color matching bike
    roughness: 0.35,
    metalness: 0.3,
  });

  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x09090b,
    roughness: 0.1,
    metalness: 0.9,
  });

  // Helper to create joint spheres
  const addJoint = (pos: THREE.Vector3, radius: number, mat: THREE.Material = jointMat): THREE.Mesh => {
    const geo = new THREE.SphereGeometry(radius, 12, 12);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(pos);
    mesh.castShadow = true;
    riderGroup.add(mesh);
    return mesh;
  };

  // Helper to create bone/cylinder cleanly connecting two 3D points
  const addBone = (from: THREE.Vector3, to: THREE.Vector3, radius: number, mat: THREE.Material = stickmanMat): THREE.Mesh => {
    const dir = new THREE.Vector3().subVectors(to, from);
    const len = dir.length();
    const geo = new THREE.CylinderGeometry(radius, radius, Math.max(0.01, len), 10);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    mesh.position.copy(from).addScaledVector(dir, 0.5);
    const yAxis = new THREE.Vector3(0, 1, 0);
    mesh.quaternion.setFromUnitVectors(yAxis, dir.clone().normalize());
    riderGroup.add(mesh);
    return mesh;
  };

  // --- 1. KEY SKELETON ANCHOR POINTS (Relative to seat center) ---
  const pelvis = new THREE.Vector3(0, 0.08, -0.05);
  const midSpine = new THREE.Vector3(0, 0.28, 0.05);
  const chest = new THREE.Vector3(0, 0.46, 0.16);
  const neck = new THREE.Vector3(0, 0.54, 0.22);
  const headPos = new THREE.Vector3(0, 0.67, 0.28);

  const leftShoulder = new THREE.Vector3(0.18, 0.44, 0.16);
  const rightShoulder = new THREE.Vector3(-0.18, 0.44, 0.16);

  // Elbows flexed naturally in attack riding position
  const leftElbow = new THREE.Vector3(0.28, 0.32, 0.32);
  const rightElbow = new THREE.Vector3(-0.28, 0.32, 0.32);

  // Hands anchored directly onto handlebar grips!
  const leftHand = new THREE.Vector3(0.24, 0.44, 0.48);
  const rightHand = new THREE.Vector3(-0.24, 0.44, 0.48);

  // Hips
  const leftHip = new THREE.Vector3(0.11, 0.07, -0.04);
  const rightHip = new THREE.Vector3(-0.11, 0.07, -0.04);

  // Knees bent forward hugging the fuel tank / radiator shrouds
  const leftKnee = new THREE.Vector3(0.17, -0.04, 0.16);
  const rightKnee = new THREE.Vector3(-0.17, -0.04, 0.16);

  // Feet resting on footpegs
  const leftFoot = new THREE.Vector3(0.17, -0.32, 0.02);
  const rightFoot = new THREE.Vector3(-0.17, -0.32, 0.02);

  // --- 2. BONES & JOINTS ASSEMBLY ---

  // Pelvis & Spine
  addJoint(pelvis, 0.065);
  addJoint(midSpine, 0.055);
  addJoint(chest, 0.065, accentMat);
  addBone(pelvis, midSpine, 0.045);
  addBone(midSpine, chest, 0.045);

  // Shoulder crossbar
  addBone(leftShoulder, rightShoulder, 0.035, accentMat);
  addJoint(leftShoulder, 0.045, accentMat);
  addJoint(rightShoulder, 0.045, accentMat);

  // Neck & Head
  addBone(chest, neck, 0.035);
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 16), stickmanMat);
  headMesh.position.copy(headPos);
  headMesh.castShadow = true;
  riderGroup.add(headMesh);

  // Stylized Motocross Helmet Cap & Goggles on Stickman
  const capGeo = new THREE.ConeGeometry(0.12, 0.22, 5);
  capGeo.rotateX(Math.PI / 2.2);
  const capMesh = new THREE.Mesh(capGeo, accentMat);
  capMesh.position.set(headPos.x, headPos.y + 0.08, headPos.z + 0.09);
  capMesh.castShadow = true;
  riderGroup.add(capMesh);

  const goggleGeo = new THREE.BoxGeometry(0.18, 0.06, 0.08);
  const goggleMesh = new THREE.Mesh(goggleGeo, visorMat);
  goggleMesh.position.set(headPos.x, headPos.y + 0.02, headPos.z + 0.11);
  riderGroup.add(goggleMesh);

  // Left Arm (Shoulder -> Elbow -> Handlebar Grip)
  addJoint(leftElbow, 0.038);
  addBone(leftShoulder, leftElbow, 0.032);
  addBone(leftElbow, leftHand, 0.028);
  addJoint(leftHand, 0.04, accentMat); // Hand holding left grip

  // Right Arm (Shoulder -> Elbow -> Handlebar Grip)
  addJoint(rightElbow, 0.038);
  addBone(rightShoulder, rightElbow, 0.032);
  addBone(rightElbow, rightHand, 0.028);
  addJoint(rightHand, 0.04, accentMat); // Hand holding right grip

  // Left Leg (Hip -> Knee -> Footpeg)
  addJoint(leftHip, 0.045);
  addJoint(leftKnee, 0.042);
  addBone(leftHip, leftKnee, 0.038);
  addBone(leftKnee, leftFoot, 0.032);
  addJoint(leftFoot, 0.042, stickmanMat);

  // Right Leg (Hip -> Knee -> Footpeg)
  addJoint(rightHip, 0.045);
  addJoint(rightKnee, 0.042);
  addBone(rightHip, rightKnee, 0.038);
  addBone(rightKnee, rightFoot, 0.032);
  addJoint(rightFoot, 0.042, stickmanMat);

  return riderGroup;
}
