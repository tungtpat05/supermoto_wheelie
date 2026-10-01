import * as THREE from 'three';
import { solveTwoBoneIK } from './RiderIK';
import { RIDER_DEBUG_ENABLED, RIDER_DEFAULTS, type RiderBikeConfig } from './RiderConfig';
import { RiderDebug } from './RiderDebug';
import { loadHelmet } from './HelmetLoader';

const Y_AXIS = new THREE.Vector3(0, 1, 0);

export class StickRider {
  public readonly group = new THREE.Group();
  public readonly helmetAnchor = new THREE.Group();
  public readonly debug: RiderDebug | undefined;
  private readonly boneGeometry = new THREE.CylinderGeometry(1, 1, 1, 8);
  private readonly jointGeometry = new THREE.SphereGeometry(1, 10, 8);
  private readonly bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x222225, roughness: 0.75 });
  private readonly accentMaterial: THREE.MeshStandardMaterial;
  private helmetRequest = 0;
  private disposed = false;
  private attachedHelmetId = '';

  constructor(config: RiderBikeConfig, accentColor: string | number) {
    this.group.name = 'StickRider';
    this.accentMaterial = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.65 });
    this.helmetAnchor.name = 'HelmetAnchor';
    this.group.add(this.helmetAnchor);
    this.debug = import.meta.env.DEV ? new RiderDebug(this.group) : undefined;
    this.buildPose(config);
    this.debug?.setEnabled(RIDER_DEBUG_ENABLED);
  }

  private bone(name: string, from: THREE.Vector3, to: THREE.Vector3, radius: number, accent = false) {
    const mesh = new THREE.Mesh(this.boneGeometry, accent ? this.accentMaterial : this.bodyMaterial);
    mesh.name = name;
    const direction = to.clone().sub(from);
    mesh.position.copy(from).addScaledVector(direction, 0.5);
    mesh.scale.set(radius, Math.max(0.0001, direction.length()), radius);
    if (direction.lengthSq() > 0) mesh.quaternion.setFromUnitVectors(Y_AXIS, direction.normalize());
    mesh.castShadow = mesh.receiveShadow = true;
    this.group.add(mesh);
  }

  private joint(name: string, position: THREE.Vector3, radius: number, accent = false) {
    const mesh = new THREE.Mesh(this.jointGeometry, accent ? this.accentMaterial : this.bodyMaterial);
    mesh.name = name;
    mesh.position.copy(position);
    mesh.scale.setScalar(radius);
    mesh.castShadow = true;
    this.group.add(mesh);
  }

  private buildPose(config: RiderBikeConfig) {
    const dimensions = { ...RIDER_DEFAULTS, ...config };
    const scale = dimensions.riderScale;
    const pelvis = new THREE.Vector3().fromArray(config.seat);
    const spine = new THREE.Vector3().fromArray(dimensions.torsoOffset).normalize();
    const chest = pelvis.clone().addScaledVector(spine, dimensions.torsoLength * scale);
    const neck = chest.clone().addScaledVector(spine, 0.06 * scale);
    this.bone('Torso', pelvis, chest, 0.045 * scale);
    this.bone('Neck', chest, neck, 0.028 * scale);
    this.joint('Pelvis', pelvis, 0.055 * scale);

    const leftHip = pelvis.clone().add(new THREE.Vector3(dimensions.hipWidth * scale / 2, 0, 0));
    const rightHip = pelvis.clone().add(new THREE.Vector3(-dimensions.hipWidth * scale / 2, 0, 0));
    const leftShoulder = chest.clone().add(new THREE.Vector3(dimensions.shoulderWidth * scale / 2, 0, 0));
    const rightShoulder = chest.clone().add(new THREE.Vector3(-dimensions.shoulderWidth * scale / 2, 0, 0));
    this.bone('Hip', leftHip, rightHip, 0.036 * scale, true);
    this.bone('Shoulders', leftShoulder, rightShoulder, 0.030 * scale, true);
    for (const side of ['Left', 'Right'] as const) {
      const sign = side === 'Left' ? 1 : -1;
      const shoulder = side === 'Left' ? leftShoulder : rightShoulder;
      const hip = side === 'Left' ? leftHip : rightHip;
      const hand = new THREE.Vector3().fromArray(side === 'Left' ? config.leftHandlebar : config.rightHandlebar);
      const foot = new THREE.Vector3().fromArray(side === 'Left' ? config.leftFootPeg : config.rightFootPeg);
      const arm = solveTwoBoneIK(shoulder, hand, dimensions.upperArmLength * scale,
        dimensions.forearmLength * scale, new THREE.Vector3(sign, -0.25, -0.15));
      const leg = solveTwoBoneIK(hip, foot, dimensions.thighLength * scale,
        dimensions.shinLength * scale, new THREE.Vector3(sign * 0.2, 0, 1));
      this.bone(`${side}UpperArm`, shoulder, arm.joint, 0.026 * scale);
      this.bone(`${side}Forearm`, arm.joint, arm.end, 0.023 * scale);
      this.bone(`${side}Thigh`, hip, leg.joint, 0.033 * scale);
      this.bone(`${side}Shin`, leg.joint, leg.end, 0.028 * scale);
      this.joint(`${side}Shoulder`, shoulder, 0.034 * scale, true);
      this.joint(`${side}Elbow`, arm.joint, 0.029 * scale);
      this.joint(`${side}Hand`, arm.end, 0.030 * scale, true);
      this.joint(`${side}Knee`, leg.joint, 0.034 * scale);
      this.joint(`${side}Foot`, leg.end, 0.035 * scale);
      this.debug?.setPoint(`${side}Handlebar`, hand, arm.reachable);
      this.debug?.setPoint(`${side}FootPeg`, foot, leg.reachable);
    }
    // The helmet is the entire head: there is deliberately no head sphere/mesh.
    const anchorOffset = new THREE.Vector3().fromArray(dimensions.helmetAnchorOffset).multiplyScalar(scale);
    this.helmetAnchor.quaternion.setFromUnitVectors(Y_AXIS, spine);
    this.helmetAnchor.position.copy(neck).add(anchorOffset.applyQuaternion(this.helmetAnchor.quaternion));
    this.debug?.setPoint('Seat', pelvis);
    this.debug?.setPoint('HelmetAnchor', this.helmetAnchor.position);
  }

  /** A request token prevents old asynchronous loads overwriting a new selection. */
  public async setHelmet(helmetId: string): Promise<void> {
    if (this.disposed) return;
    const request = ++this.helmetRequest;
    if (helmetId === this.attachedHelmetId) return;
    if (!helmetId) {
      this.helmetAnchor.clear();
      this.attachedHelmetId = '';
      return;
    }
    const helmet = await loadHelmet(helmetId);
    if (this.disposed || request !== this.helmetRequest) return;
    this.helmetAnchor.clear();
    this.helmetAnchor.add(helmet);
    this.attachedHelmetId = helmetId;
  }

  public dispose() {
    this.disposed = true;
    this.helmetRequest++;
    this.helmetAnchor.clear();
    this.debug?.dispose();
    this.boneGeometry.dispose();
    this.jointGeometry.dispose();
    this.bodyMaterial.dispose();
    this.accentMaterial.dispose();
    this.group.removeFromParent();
  }
}
