/** Shared by the terrain, tire contact and camera. Gentle, continuous world-space swells. */
export function terrainHeight(x: number, z: number): number {
  return Math.sin(x * 0.012 + z * 0.009) * 1.8
    + Math.sin(z * 0.023 - x * 0.007) * 0.75
    + Math.sin(x * 0.043 + z * 0.031) * 0.18;
}

/** Winding worn tracks and broad patches of exposed earth, with feathered edges. */
export function terrainWear(x: number, z: number): number {
  const track = x - Math.sin(z * 0.008) * 16 - Math.sin(z * 0.023) * 4;
  const ruts = Math.exp(-(((Math.abs(track) - 1.5) / 0.85) ** 2));
  const clearing = Math.max(0, Math.sin(x * 0.026 + z * 0.016)
    * Math.cos(z * 0.021 - x * 0.013));
  return Math.max(ruts * 0.94, Math.exp(-((track / 6) ** 2)) * 0.62, clearing ** 3);
}
