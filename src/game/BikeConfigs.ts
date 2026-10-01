export interface BikePhysicsTuning {
  maxSpeed: number; accelerationPower: number; brakePower: number;
  throttlePitchTorque: number; leanPitchTorque: number; brakePitchTorque: number;
  balanceAngle: number; scrapeAngle: number; crashAngle: number;
}

const modelFiles = import.meta.glob('../assets/glbmodel/bike/*.glb', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export interface BikeConfig {
  id: string; name: string; brand: string; engine: string;
  engineCategory: '2-Stroke' | '4-Stroke'; color: string;
  soundType: '4stroke_deep' | '2stroke_heavy' | '2stroke_screamer';
  modelType: 'glb' | 'procedural'; modelUrl?: string;
  modelTransform: { scale: number; rotationY: number; offsetY: number; fenderTip: [number, number, number]; riderOffset: [number, number, number] };
  physics: BikePhysicsTuning;
}

const tunedModels: Record<string, Partial<Pick<BikeConfig, 'color' | 'engineCategory' | 'soundType' | 'modelTransform' | 'physics'>>> = {
  fantic_xxf_450: { color: '#ef4444', engineCategory: '4-Stroke', soundType: '4stroke_deep', modelTransform: { scale: 1, rotationY: Math.PI / 2, offsetY: .55, fenderTip: [0, .88, -1.08], riderOffset: [0, .88, -.15] } },
  yamaha_yz125: { color: '#3b82f6', engineCategory: '2-Stroke', soundType: '2stroke_screamer', modelTransform: { scale: 1, rotationY: Math.PI / 2, offsetY: .56, fenderTip: [0, .88, -1.05], riderOffset: [0, .88, -.15] } },
};
const defaultPhysics: BikePhysicsTuning = { maxSpeed: 25.5, accelerationPower: 8.5, brakePower: 22, throttlePitchTorque: 4, leanPitchTorque: 3, brakePitchTorque: 7.5, balanceAngle: .98, scrapeAngle: 1.36, crashAngle: Math.PI / 2 };
const genericTransform: BikeConfig['modelTransform'] = { scale: 1, rotationY: Math.PI / 2, offsetY: .55, fenderTip: [0, .88, -1.08], riderOffset: [0, .88, -.15] };

function fileId(path: string): string { return path.split('/').pop()!.replace(/\.glb$/i, '').toLowerCase(); }
function displayName(id: string): string {
  return id.split(/[_-]+/).filter(Boolean).map(word => {
    const upper = word.toUpperCase();
    return /^[a-z]*\d+$|^\d+$/.test(word) || ['ktm', 'yz', 'kx', 'xxf', 'exc', 'crf', 'rmz', 'sxf'].includes(word.toLowerCase()) ? upper : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

export const BIKES_DATABASE: BikeConfig[] = Object.entries(modelFiles).map(([path, modelUrl], index) => {
  const id = fileId(path); const tuned = tunedModels[id] || {};
  const engineCategory = tuned.engineCategory || (/(2t|2-stroke|two[_-]?stroke)/i.test(id) ? '2-Stroke' : '4-Stroke');
  return { id, name: displayName(id), brand: id.split(/[_-]/)[0].toUpperCase(), engine: 'Dirt bike', engineCategory, color: tuned.color || ['#eab308', '#22c55e', '#a855f7', '#f97316'][index % 4], soundType: tuned.soundType || (engineCategory === '2-Stroke' ? '2stroke_heavy' : '4stroke_deep'), modelType: 'glb' as const, modelUrl, modelTransform: { ...genericTransform, ...tuned.modelTransform }, physics: { ...defaultPhysics, ...tuned.physics } };
}).sort((a, b) => a.name.localeCompare(b.name));

export const DEFAULT_BIKE_ID = BIKES_DATABASE[0]?.id || '';
export function getBikeConfig(bikeId: string): BikeConfig { return BIKES_DATABASE.find(bike => bike.id === bikeId) || BIKES_DATABASE[0]; }
