import * as THREE from 'three';
import type { WheelOverlayConfig, WheelVisualConfig } from './WheelVisualConfig';

export const WHEEL_EFFECT_SETTINGS = {
  enabled: true,
  minOpacity: 0.5, // Crisp blur opacity right as wheels start rolling
  maxOpacity: 0.98, // Maximum blur opacity at high speed
  startBlurSpeed: 0.3, // m/s (~1 km/h) speed threshold to activate effect
  fullBlurSpeed: 12, // m/s (~43 km/h) speed threshold for maximum opacity
  opacityResponse: 10, // exponential smoothing, independent of FPS
  rotationMultiplier: 1,
  frontCoastDeceleration: 5, // visual equivalent m/s² while airborne
};

/** One small procedural texture reused by both wheels and both sides. */
function createBlurTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Cannot create wheel blur texture');
  const pixels = context.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - size / 2) / (size / 2);
      const dy = (y + 0.5 - size / 2) / (size / 2);
      const radius = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      const mask = THREE.MathUtils.smoothstep(radius, 0.12, 0.26)
        * (1 - THREE.MathUtils.smoothstep(radius, 0.82, 1));
      // Broad swept spokes and broken concentric arcs; no opaque disc or hard edge.
      const spokes = Math.pow(0.5 + 0.5 * Math.cos(angle * 13 + radius * 3), 4);
      const arcs = (0.5 + 0.5 * Math.sin(radius * 75 + Math.sin(angle * 3)))
        * (0.5 + 0.5 * Math.cos(angle * 5 + radius * 9));
      // Dark graphite / smoked charcoal tone so the rotation blur is clearly defined
      const shade = Math.round(35 + 45 * spokes + 20 * arcs);
      const offset = (y * size + x) * 4;
      pixels.data[offset] = pixels.data[offset + 1] = pixels.data[offset + 2] = shade;
      pixels.data[offset + 3] = Math.round(255 * mask * (0.16 + 0.54 * spokes + 0.22 * arcs));
    }
  }
  context.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

interface WheelLayer {
  pivot: THREE.Group;
  material: THREE.MeshBasicMaterial;
  radius: number;
}

/** Visual only: reads speed/contact, never writes to physics or the GLB geometry. */
export class WheelRotationEffect {
  public enabled: boolean;
  private readonly root = new THREE.Group();
  private readonly geometry = new THREE.PlaneGeometry(2, 2);
  private readonly texture = createBlurTexture();
  private readonly front: WheelLayer;
  private readonly rear: WheelLayer;
  private frontSpeed = 0;

  constructor(model: THREE.Object3D, config: WheelVisualConfig) {
    this.enabled = config.enabled;
    this.root.name = 'WheelRotationEffect';
    this.front = this.createWheel(config.front, 'FrontWheelBlur');
    this.rear = this.createWheel(config.rear, 'RearWheelBlur');
    model.add(this.root);
    this.reset();
  }

  private createWheel(config: WheelOverlayConfig, name: string): WheelLayer {
    const pivot = new THREE.Group();
    pivot.name = name;
    pivot.position.fromArray(config.position);
    const material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: true, // forks, rider and body still occlude the overlay
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      toneMapped: false,
    });
    for (const side of [-1, 1]) {
      const plane = new THREE.Mesh(this.geometry, material);
      plane.scale.setScalar(config.radius);
      plane.position.z = side * config.sideOffset;
      plane.rotation.y = side < 0 ? Math.PI : 0;
      // FrontSide rendering means only the outward-facing plane is drawn.
      plane.renderOrder = 1;
      pivot.add(plane);
    }
    this.root.add(pivot);
    return { pivot, material, radius: config.radius };
  }

  public update(deltaTime: number, vehicleSpeed: number, frontGrounded: boolean, crashed = false) {
    if (!this.enabled || !WHEEL_EFFECT_SETTINGS.enabled || crashed) {
      this.reset();
      return;
    }
    if (!Number.isFinite(deltaTime) || deltaTime <= 0 || !Number.isFinite(vehicleSpeed)) return;
    if (frontGrounded) {
      this.frontSpeed = vehicleSpeed;
    } else {
      this.frontSpeed = Math.sign(this.frontSpeed) * Math.max(
        0, Math.abs(this.frontSpeed) - WHEEL_EFFECT_SETTINGS.frontCoastDeceleration * deltaTime,
      );
    }
    if (vehicleSpeed === 0) this.frontSpeed = 0;
    this.updateWheel(this.front, this.frontSpeed, deltaTime);
    this.updateWheel(this.rear, vehicleSpeed, deltaTime);
  }

  private updateWheel(wheel: WheelLayer, signedSpeed: number, delta: number) {
    const speed = Math.abs(signedSpeed);
    let target = 0;
    if (speed > WHEEL_EFFECT_SETTINGS.startBlurSpeed) {
      const progress = THREE.MathUtils.clamp(
        (speed - WHEEL_EFFECT_SETTINGS.startBlurSpeed)
        / Math.max(0.001, WHEEL_EFFECT_SETTINGS.fullBlurSpeed - WHEEL_EFFECT_SETTINGS.startBlurSpeed),
        0,
        1,
      );
      target = THREE.MathUtils.lerp(
        WHEEL_EFFECT_SETTINGS.minOpacity,
        WHEEL_EFFECT_SETTINGS.maxOpacity,
        progress,
      );
    }
    wheel.material.opacity = THREE.MathUtils.lerp(
      wheel.material.opacity, target, 1 - Math.exp(-WHEEL_EFFECT_SETTINGS.opacityResponse * delta),
    );
    if (speed === 0) wheel.material.opacity = 0;
    wheel.pivot.visible = speed > 0;
    // +Z rotation rolls these -X-facing models forward; signed speed handles reverse.
    wheel.pivot.rotation.z = (wheel.pivot.rotation.z
      + signedSpeed / wheel.radius * WHEEL_EFFECT_SETTINGS.rotationMultiplier * delta) % (Math.PI * 2);
  }

  public reset() {
    this.frontSpeed = 0;
    for (const wheel of [this.front, this.rear]) {
      wheel.material.opacity = 0;
      wheel.pivot.visible = false;
      wheel.pivot.rotation.z = 0;
    }
  }

  public dispose() {
    this.root.removeFromParent();
    this.geometry.dispose();
    this.texture.dispose();
    this.front.material.dispose();
    this.rear.material.dispose();
  }
}
