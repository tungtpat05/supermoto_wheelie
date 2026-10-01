import type { LocalPoint } from './RiderConfig';

export interface HelmetConfig {
  position: LocalPoint;
  rotation: LocalPoint; // radians, relative to HelmetAnchor; +Z is rider's forward
  scale: number; // multiplier after centering/fitting to targetHeight
  targetHeight: number;
}

const helmetFiles = import.meta.glob('../../assets/glbmodel/helmet/*.glb', {
  eager: true, query: '?url', import: 'default',
}) as Record<string, string>;

export const HELMET_TRANSFORMS: Record<string, Partial<HelmetConfig>> = {
  adv: { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 },
  gao_do: { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 },
  spartan: { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 },
  star_war: { position: [0, 0, 0], rotation: [0, 0, 0], scale: 1 },
};

export const HELMETS_DATABASE = Object.entries(helmetFiles).map(([path, url]) => {
  const id = path.split('/').pop()!.replace(/\.glb$/i, '');
  return {
    id, url, name: id.replace(/[_-]/g, ' ').toUpperCase(),
    transform: {
      position: [0, 0, 0], rotation: [0, 0, 0], scale: 1, targetHeight: 0.28,
      ...HELMET_TRANSFORMS[id],
    } as HelmetConfig,
  };
}).sort((a, b) => a.id.localeCompare(b.id));

export const DEFAULT_HELMET_ID = HELMETS_DATABASE.find(helmet => helmet.id === 'adv')?.id
  || HELMETS_DATABASE[0]?.id || '';
