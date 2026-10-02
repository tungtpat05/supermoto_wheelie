export const QUALITY_PRESETS = {
  Low: { pixelRatio: 0.75, shadows: false, shadowSize: 512, grassDensity: 0.3, grassDistance: 44 },
  Medium: { pixelRatio: 1, shadows: true, shadowSize: 1024, grassDensity: 0.5, grassDistance: 64 },
  High: { pixelRatio: 1.5, shadows: true, shadowSize: 2048, grassDensity: 0.75, grassDistance: 82 },
  Ultra: { pixelRatio: 2, shadows: true, shadowSize: 4096, grassDensity: 1, grassDistance: 94 },
} as const;

export type GraphicsQuality = keyof typeof QUALITY_PRESETS;

export function isGraphicsQuality(value: string | null): value is GraphicsQuality {
  return value !== null && Object.hasOwn(QUALITY_PRESETS, value);
}
