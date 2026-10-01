export const QUALITY_PRESETS = {
  Low: { pixelRatio: 0.75, shadows: false, shadowSize: 512, grassDensity: 0.2, grassDistance: 160 },
  Medium: { pixelRatio: 1, shadows: true, shadowSize: 1024, grassDensity: 0.45, grassDistance: 320 },
  High: { pixelRatio: 1.5, shadows: true, shadowSize: 2048, grassDensity: 0.75, grassDistance: 520 },
  Ultra: { pixelRatio: 2, shadows: true, shadowSize: 4096, grassDensity: 1, grassDistance: 900 },
} as const;

export type GraphicsQuality = keyof typeof QUALITY_PRESETS;

export function isGraphicsQuality(value: string | null): value is GraphicsQuality {
  return value !== null && Object.hasOwn(QUALITY_PRESETS, value);
}
