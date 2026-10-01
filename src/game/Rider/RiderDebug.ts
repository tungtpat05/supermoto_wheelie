import * as THREE from 'three';

export class RiderDebug {
  public readonly group = new THREE.Group();
  private readonly geometry = new THREE.SphereGeometry(0.022, 8, 6);
  private readonly markers = new Map<string, THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>>();

  constructor(parent: THREE.Group) {
    this.group.name = 'RiderDebugAnchors';
    this.group.visible = false;
    for (const [name, color] of [
      ['Seat', 0xffdd33], ['LeftHandlebar', 0x33ffaa], ['RightHandlebar', 0x22bbff],
      ['LeftFootPeg', 0xff55cc], ['RightFootPeg', 0x9966ff], ['HelmetAnchor', 0xffffff],
    ] as const) {
      const marker = new THREE.Mesh(this.geometry, new THREE.MeshBasicMaterial({ color, depthTest: false }));
      marker.name = `Debug:${name}`;
      marker.renderOrder = 20;
      this.group.add(marker);
      this.markers.set(name, marker);
    }
    parent.add(this.group);
  }

  public setPoint(name: string, position: THREE.Vector3, reachable = true) {
    const marker = this.markers.get(name);
    if (!marker) return;
    marker.position.copy(position);
    marker.scale.setScalar(reachable ? 1 : 1.6);
    // Orange means the configured limb lengths cannot reach the contact point.
    if (!reachable) marker.material.color.setHex(0xff8800);
  }

  public setEnabled(enabled: boolean) { this.group.visible = import.meta.env.DEV && enabled; }

  public dispose() {
    this.group.removeFromParent();
    this.geometry.dispose();
    for (const marker of this.markers.values()) marker.material.dispose();
  }
}
