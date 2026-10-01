export type LocalPoint = [number, number, number];

export interface RiderBikeConfig {
  /** Coordinates in bodyGroup (meters): +Z forward, +Y up, +X rider's left. */
  seat: LocalPoint;
  leftHandlebar: LocalPoint;
  rightHandlebar: LocalPoint;
  leftFootPeg: LocalPoint;
  rightFootPeg: LocalPoint;
  torsoOffset?: LocalPoint;
  helmetAnchorOffset?: LocalPoint;
  riderScale?: number;
  upperArmLength?: number;
  forearmLength?: number;
  thighLength?: number;
  shinLength?: number;
  shoulderWidth?: number;
  hipWidth?: number;
  torsoLength?: number;
}

export const RIDER_DEFAULTS = {
  riderScale: 1,
  upperArmLength: 0.27,
  forearmLength: 0.27,
  thighLength: 0.38,
  shinLength: 0.39,
  shoulderWidth: 0.32,
  hipWidth: 0.20,
  torsoLength: 0.44,
  torsoOffset: [0, 0.42, 0.14] as LocalPoint,
  helmetAnchorOffset: [0, 0.14, 0] as LocalPoint,
};

export const RIDER_DEBUG_ENABLED = false; // development only; also available in the HUD

// Starting poses, not automatically extracted attachment points.
// Use the development markers to fine-tune these for your GLBs.
export const RIDER_CONFIGS: Record<string, RiderBikeConfig> = {
  fantasy_thunder_250: {
    seat: [0, 0.86, -0.15],
    leftHandlebar: [0.23, 1.04, 0.30], rightHandlebar: [-0.23, 1.04, 0.30],
    leftFootPeg: [0.18, 0.35, -0.12], rightFootPeg: [-0.18, 0.35, -0.12],
  },
  fantic_xxf_450: {
    seat: [0, 0.86, -0.14],
    leftHandlebar: [0.23, 1.04, 0.30], rightHandlebar: [-0.23, 1.04, 0.30],
    leftFootPeg: [0.18, 0.35, -0.13], rightFootPeg: [-0.18, 0.35, -0.13],
  },
  yamaha_yz_125: {
    seat: [0, 0.86, -0.15],
    leftHandlebar: [0.23, 1.04, 0.30], rightHandlebar: [-0.23, 1.04, 0.30],
    leftFootPeg: [0.18, 0.34, -0.12], rightFootPeg: [-0.18, 0.34, -0.12],
  },
};

export const PROCEDURAL_RIDER_CONFIG: RiderBikeConfig = {
  seat: [0, 0.98, -0.20],
  leftHandlebar: [0.24, 1.23, 0.63], rightHandlebar: [-0.24, 1.23, 0.63],
  leftFootPeg: [0.17, 0.55, -0.18], rightFootPeg: [-0.17, 0.55, -0.18],
  upperArmLength: 0.35, forearmLength: 0.35,
};

export function getRiderConfig(bikeId: string): RiderBikeConfig {
  return RIDER_CONFIGS[bikeId] || RIDER_CONFIGS.fantasy_thunder_250;
}
