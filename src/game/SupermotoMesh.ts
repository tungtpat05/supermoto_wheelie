import * as THREE from 'three';
import type { WheelRotationEffect } from './WheelRotationEffect';
import { StickRider } from './Rider/StickRider';
import { PROCEDURAL_RIDER_CONFIG } from './Rider/RiderConfig';

export interface SupermotoParts {
  bikeGroup: THREE.Group;
  bodyGroup: THREE.Group;
  frontWheel: THREE.Group;
  rearWheel: THREE.Group;
  riderGroup: THREE.Group;
  fenderTip: THREE.Vector3;
  sparksEmitter: THREE.Group;
  exhaustEmitter: THREE.Group;
  wheelRotationEffect?: WheelRotationEffect;
  rider: StickRider;
}

export function createSupermotoBike(): SupermotoParts {
  const bikeGroup = new THREE.Group();
  const bodyGroup = new THREE.Group();
  bikeGroup.add(bodyGroup);

  // Material Palettes - Vibrant Racing Supermoto (KTM Racing Orange & Alpine White)
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xff6600, // Racing Orange
    roughness: 0.25,
    metalness: 0.3,
  });

  const frameMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, // Alpine White Frame
    roughness: 0.3,
    metalness: 0.7,
  });

  const engineMat = new THREE.MeshStandardMaterial({
    color: 0x2b303c, // Dark Gunmetal Engine
    roughness: 0.3,
    metalness: 0.85,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xf0f0f0,
    roughness: 0.1,
    metalness: 0.95,
  });

  const forkGoldMat = new THREE.MeshStandardMaterial({
    color: 0xffc107, // Gold Anodized Forks
    roughness: 0.2,
    metalness: 0.85,
  });

  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.9,
    metalness: 0.05,
  });

  const rimMat = new THREE.MeshStandardMaterial({
    color: 0x111827, // Glossy Black Rims
    roughness: 0.2,
    metalness: 0.8,
  });

  const seatMat = new THREE.MeshStandardMaterial({
    color: 0x090a0f,
    roughness: 0.85,
  });

  // --- 1. WHEELS (Spoke Wheel + Rim + Knobby/Supermoto Tire) ---
  const createWheel = () => {
    const wheelGroup = new THREE.Group();

    // Tire (Torus)
    const tireGeo = new THREE.TorusGeometry(0.44, 0.11, 16, 32);
    const tireMesh = new THREE.Mesh(tireGeo, tireMat);
    tireMesh.castShadow = true;
    wheelGroup.add(tireMesh);

    // Rim
    const rimGeo = new THREE.TorusGeometry(0.36, 0.035, 16, 32);
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    wheelGroup.add(rimMesh);

    // Brake Disc
    const discGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.015, 24);
    discGeo.rotateX(Math.PI / 2);
    const discMesh = new THREE.Mesh(discGeo, chromeMat);
    wheelGroup.add(discMesh);

    // Hub
    const hubGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.16, 16);
    hubGeo.rotateX(Math.PI / 2);
    const hubMesh = new THREE.Mesh(hubGeo, bodyMat);
    wheelGroup.add(hubMesh);

    // Spokes
    const spokeMat = new THREE.MeshBasicMaterial({ color: 0xdddddd });
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const spokeGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.7, 6);
      const spoke = new THREE.Mesh(spokeGeo, spokeMat);
      spoke.rotation.z = angle;
      wheelGroup.add(spoke);
    }

    return wheelGroup;
  };

  const frontWheel = createWheel();
  frontWheel.position.set(0, 0.44, 0.85);
  bodyGroup.add(frontWheel);

  const rearWheel = createWheel();
  rearWheel.position.set(0, 0.44, -0.85);
  bodyGroup.add(rearWheel);

  // --- 2. FRAME & ENGINE BLOCK ---
  // Main trellis frame
  const frameGeo = new THREE.BoxGeometry(0.2, 0.38, 1.25);
  const frameMesh = new THREE.Mesh(frameGeo, frameMat);
  frameMesh.position.set(0, 0.68, 0);
  frameMesh.castShadow = true;
  bodyGroup.add(frameMesh);

  // Single Cylinder Engine Block (450cc Offroad Monster)
  const engineGeo = new THREE.BoxGeometry(0.26, 0.4, 0.45);
  const engineMesh = new THREE.Mesh(engineGeo, engineMat);
  engineMesh.position.set(0, 0.54, -0.05);
  engineMesh.castShadow = true;
  bodyGroup.add(engineMesh);

  // Cylinder cooling fins
  for (let i = 0; i < 4; i++) {
    const finGeo = new THREE.BoxGeometry(0.29, 0.02, 0.38);
    const finMesh = new THREE.Mesh(finGeo, engineMat);
    finMesh.position.set(0, 0.46 + i * 0.07, -0.05);
    bodyGroup.add(finMesh);
  }

  // --- 3. REAR SWINGARM ---
  const swingarmGeo = new THREE.BoxGeometry(0.3, 0.09, 0.82);
  const swingarmMesh = new THREE.Mesh(swingarmGeo, frameMat);
  swingarmMesh.position.set(0, 0.46, -0.45);
  swingarmMesh.castShadow = true;
  bodyGroup.add(swingarmMesh);

  // --- 4. FRONT FORKS & HANDLEBARS ---
  const forkGroup = new THREE.Group();
  forkGroup.position.set(0, 0.44, 0.85);

  // Upside-down Gold Suspension Forks
  const forkGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.9, 16);
  const leftFork = new THREE.Mesh(forkGeo, forkGoldMat);
  leftFork.position.set(0.13, 0.38, -0.08);
  leftFork.rotation.x = -0.22;
  leftFork.castShadow = true;

  const rightFork = new THREE.Mesh(forkGeo, forkGoldMat);
  rightFork.position.set(-0.13, 0.38, -0.08);
  rightFork.rotation.x = -0.22;
  rightFork.castShadow = true;

  forkGroup.add(leftFork);
  forkGroup.add(rightFork);

  // Triple Clamp
  const clampGeo = new THREE.BoxGeometry(0.34, 0.05, 0.14);
  const topClamp = new THREE.Mesh(clampGeo, bodyMat);
  topClamp.position.set(0, 0.75, -0.16);
  forkGroup.add(topClamp);

  // Handlebars
  const barGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.8, 12);
  barGeo.rotateZ(Math.PI / 2);
  const barMesh = new THREE.Mesh(barGeo, frameMat);
  barMesh.position.set(0, 0.82, -0.16);
  forkGroup.add(barMesh);

  // Handguards
  const guardGeo = new THREE.BoxGeometry(0.16, 0.09, 0.04);
  const leftGuard = new THREE.Mesh(guardGeo, bodyMat);
  leftGuard.position.set(0.38, 0.82, -0.14);
  const rightGuard = new THREE.Mesh(guardGeo, bodyMat);
  rightGuard.position.set(-0.38, 0.82, -0.14);
  forkGroup.add(leftGuard);
  forkGroup.add(rightGuard);

  // Front Offroad/Supermoto Fender
  const frontFenderShape = new THREE.ConeGeometry(0.13, 0.6, 4);
  frontFenderShape.rotateX(Math.PI / 2.2);
  const frontFender = new THREE.Mesh(frontFenderShape, bodyMat);
  frontFender.position.set(0, 0.65, 0.14);
  frontFender.castShadow = true;
  forkGroup.add(frontFender);

  bodyGroup.add(forkGroup);

  // --- 5. TANK, SEAT & REAR FENDER ---
  // Gas Tank
  const tankGeo = new THREE.BoxGeometry(0.32, 0.3, 0.52);
  const tankMesh = new THREE.Mesh(tankGeo, bodyMat);
  tankMesh.position.set(0, 0.85, 0.3);
  tankMesh.castShadow = true;
  bodyGroup.add(tankMesh);

  // Long Offroad/Supermoto Seat
  const seatGeo = new THREE.BoxGeometry(0.26, 0.12, 0.85);
  const seatMesh = new THREE.Mesh(seatGeo, seatMat);
  seatMesh.position.set(0, 0.9, -0.2);
  seatMesh.castShadow = true;
  bodyGroup.add(seatMesh);

  // Rear Plastics & Fender
  const rearFenderGeo = new THREE.BoxGeometry(0.28, 0.06, 0.65);
  const rearFenderMesh = new THREE.Mesh(rearFenderGeo, bodyMat);
  rearFenderMesh.position.set(0, 0.86, -0.78);
  rearFenderMesh.rotation.x = -0.16;
  rearFenderMesh.castShadow = true;
  bodyGroup.add(rearFenderMesh);

  // Tail Tip
  const fenderTip = new THREE.Vector3(0, 0.8, -1.1);

  // Exhaust Pipe & Muffler
  const pipeGeo = new THREE.CylinderGeometry(0.028, 0.045, 0.95, 12);
  pipeGeo.rotateX(Math.PI / 2.3);
  const pipeMesh = new THREE.Mesh(pipeGeo, chromeMat);
  pipeMesh.position.set(0.15, 0.68, -0.4);
  bodyGroup.add(pipeMesh);

  const mufflerGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.45, 16);
  mufflerGeo.rotateX(Math.PI / 2);
  const mufflerMesh = new THREE.Mesh(mufflerGeo, frameMat);
  mufflerMesh.position.set(0.16, 0.84, -0.78);
  mufflerMesh.castShadow = true;
  bodyGroup.add(mufflerMesh);

  // --- 6. STICKMAN RIDER ---
  const rider = new StickRider(PROCEDURAL_RIDER_CONFIG, 0xf97316);
  const riderGroup = rider.group;
  bodyGroup.add(riderGroup);

  // --- 7. SPARKS EMITTER GROUP ---
  const sparksEmitter = new THREE.Group();
  sparksEmitter.position.copy(fenderTip);
  bodyGroup.add(sparksEmitter);

  // --- 8. EXHAUST EMITTER GROUP ---
  const exhaustTip = new THREE.Vector3(0, 0.84, -0.98);
  const exhaustEmitter = new THREE.Group();
  exhaustEmitter.position.copy(exhaustTip);
  bodyGroup.add(exhaustEmitter);

  return {
    bikeGroup,
    bodyGroup,
    frontWheel,
    rearWheel,
    riderGroup,
    fenderTip,
    sparksEmitter,
    exhaustEmitter,
    rider,
  };
}
