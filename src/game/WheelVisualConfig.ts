export interface WheelOverlayConfig {
  /** GLB scene-local coordinates, BEFORE modelTransform (not raw quantized vertices). */
  position: [number, number, number];
  /** Overlay radius: inner rim/spokes only, excluding the tire. */
  radius: number;
  /** Distance from wheel center to each outside face, along local Z. */
  sideOffset: number;
}

export interface WheelVisualConfig {
  enabled: boolean;
  front: WheelOverlayConfig;
  rear: WheelOverlayConfig;
}

// These GLBs face local -X, with Y up and the wheel axle along local Z.
// Each overlay is parented to the GLB scene, inheriting its scale/rotation/offset.
export const WHEEL_VISUAL_CONFIGS: Record<string, WheelVisualConfig> = {
  fantasy_thunder_250: {
    enabled: true,
    front: { position: [-0.63, -0.25, 0], radius: 0.21, sideOffset: 0.045 },
    rear: { position: [0.63, -0.25, 0], radius: 0.20, sideOffset: 0.055 },
  },
  fantic_xxf_450: {
    enabled: true,
    front: { position: [-0.63, -0.25, 0], radius: 0.21, sideOffset: 0.045 },
    rear: { position: [0.63, -0.25, 0], radius: 0.20, sideOffset: 0.055 },
  },
  yamaha_yz_125: {
    enabled: true,
    front: { position: [-0.63, -0.26, 0], radius: 0.21, sideOffset: 0.045 },
    rear: { position: [0.63, -0.26, 0], radius: 0.20, sideOffset: 0.055 },
  },
};
