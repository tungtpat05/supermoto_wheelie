import * as THREE from 'three';
import type { PhysicsEngine } from './PhysicsEngine';
import type { SupermotoParts } from './SupermotoMesh';
import { terrainHeight } from './SteppeTerrain';
import type { StickRider } from './Rider/StickRider';

const supportCache = new WeakMap<THREE.BufferGeometry, THREE.Vector3[]>();
const directions: THREE.Vector3[] = [];
for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
  if (x || y || z) directions.push(new THREE.Vector3(x, y, z));
}

function geometrySupports(geometry: THREE.BufferGeometry) {
  const cached = supportCache.get(geometry);
  if (cached) return cached;
  const vertices = geometry.attributes.position;
  const points = directions.map(() => new THREE.Vector3());
  const furthest = directions.map(() => -Infinity);
  const point = new THREE.Vector3();
  // A bounded scan, cached across crashes and cloned models. Use actual surface
  // extrema instead of empty box corners that can make a tipped bike float.
  const stride = Math.max(1, Math.ceil(vertices.count / 2048));
  for (let i = 0; i < vertices.count; i += stride) {
    point.fromBufferAttribute(vertices, i);
    for (let d = 0; d < directions.length; d++) {
      const projection = point.dot(directions[d]);
      if (projection > furthest[d]) { furthest[d] = projection; points[d].copy(point); }
    }
  }
  supportCache.set(geometry, points);
  return points;
}

/** A rigid bike/rider fall with inexpensive, cached support points. No ragdoll. */
export class BikeCrashPose {
  private body: THREE.Group | null = null;
  private helmet: THREE.Object3D | undefined;
  private rider: StickRider | null = null;
  private supports: { mesh: THREE.Mesh; points: THREE.Vector3[] }[] = [];
  private point = new THREE.Vector3();

  reset() {
    this.rider?.setCrashPose(0);
    this.rider = null;
    this.body = null;
    this.helmet = undefined;
    this.supports.length = 0;
  }

  private capture(parts: SupermotoParts) {
    this.body = parts.bodyGroup;
    this.rider = parts.rider;
    this.helmet = parts.rider.helmetAnchor.children[0];
    this.supports.length = 0;
    // Only gather surfaces at the start of a fall or when the model changes.
    parts.bodyGroup.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (materials.every(material => !material.visible || material.opacity === 0)) return;
      if (!object.geometry.attributes.position?.count) return;
      this.supports.push({ mesh: object, points: geometrySupports(object.geometry) });
    });
  }

  update(parts: SupermotoParts, physics: PhysicsEngine) {
    if (this.body !== parts.bodyGroup || this.helmet !== parts.rider.helmetAnchor.children[0]) this.capture(parts);
    parts.rider.setCrashPose(THREE.MathUtils.smoothstep(physics.crashTime, .12, .7));
    const x = physics.positionX, z = physics.positionZ;
    const slope = Math.atan2(terrainHeight(x, z + .85) - terrainHeight(x, z - .85), 1.7);
    parts.bodyGroup.rotation.set(physics.bikeCrashRotation.x - slope,
      physics.bikeCrashRotation.y, physics.bikeCrashRotation.z);
    parts.bikeGroup.position.set(x, 0, z);
    parts.bikeGroup.updateWorldMatrix(true, true);
    let supportHeight = -Infinity;
    for (const { mesh, points } of this.supports) {
      for (const local of points) {
        this.point.copy(local).applyMatrix4(mesh.matrixWorld);
        supportHeight = Math.max(supportHeight,
          terrainHeight(this.point.x, this.point.z) - this.point.y);
      }
    }
    // Both the rider and bike settle against the terrain; the old wheelie height
    // offset must not survive into a side fall or leave the whole assembly aloft.
    const height = Number.isFinite(supportHeight) ? supportHeight : terrainHeight(x, z);
    parts.bikeGroup.position.set(x, height + .025, z);
  }
}
