import fanticUrl from '../assets/glbmodel/bike/fantic_xxf_450.glb?url';
import kawasakiUrl from '../assets/glbmodel/bike/kawasaki_kx500.glb?url';
import yamahaUrl from '../assets/glbmodel/bike/yamaha_yz125.glb?url';

export interface BikePhysicsTuning {
  maxSpeed: number; // m/s
  accelerationPower: number; // m/s^2
  brakePower: number;
  throttlePitchTorque: number;
  leanPitchTorque: number;
  brakePitchTorque: number;
  balanceAngle: number; // rad
  scrapeAngle: number; // rad
  crashAngle: number; // rad
}

export interface BikeConfig {
  id: string;
  name: string;
  brand: string;
  engine: string;
  engineCategory: '2-Stroke' | '4-Stroke';
  tagline: string;
  description: string;
  color: string;
  soundType: '4stroke_deep' | '2stroke_heavy' | '2stroke_screamer';
  modelType: 'glb' | 'procedural';
  modelUrl?: string;
  modelTransform?: {
    scale: number;
    rotationY: number;
    offsetY: number;
    fenderTip: [number, number, number];
    riderOffset: [number, number, number];
    exhaustTip?: [number, number, number];
  };
  stats: {
    topSpeedKmh: number;
    power: number; // 0 - 100
    wheelieTorque: number; // 0 - 100
    stability: number; // 0 - 100
    weightKg: number;
  };
  physics: BikePhysicsTuning;
}

export const BIKES_DATABASE: BikeConfig[] = [
  {
    id: 'fantic_xxf_450',
    name: 'Fantic XXF 450',
    brand: 'Fantic Racing',
    engine: '450cc DOHC 4-Thì Fi',
    engineCategory: '4-Stroke',
    tagline: 'Cỗ máy cào cào Ý - Mô-men xoắn dũng mãnh',
    description: 'Động cơ 4 thì 450cc cho lực kéo cực kỳ đầm chắc, kiểm soát góc bốc đầu chính xác và gia tốc mượt mà ở mọi dải vòng tua.',
    color: '#ef4444',
    soundType: '4stroke_deep',
    modelType: 'glb',
    modelUrl: fanticUrl,
    modelTransform: {
      scale: 1.0,
      rotationY: Math.PI / 2,
      offsetY: 0.55,
      fenderTip: [0, 0.88, -1.08],
      riderOffset: [0, 0.88, -0.15],
      exhaustTip: [0.18, 0.78, -0.95],
    },
    stats: {
      topSpeedKmh: 92,
      power: 92,
      wheelieTorque: 90,
      stability: 85,
      weightKg: 108,
    },
    physics: {
      maxSpeed: 25.5, // ~92 km/h (< 100 km/h)
      accelerationPower: 8.5,
      brakePower: 22.0,
      throttlePitchTorque: 4.0,
      leanPitchTorque: 3.0,
      brakePitchTorque: 7.5,
      balanceAngle: 0.98, // ~56 deg
      scrapeAngle: 1.36, // ~78 deg
      crashAngle: Math.PI / 2, // 90 deg (1.5708 rad)
    },
  },
  {
    id: 'kawasaki_kx500',
    name: 'Kawasaki KX500',
    brand: 'Kawasaki Factory',
    engine: '500cc 2-Thì "Widowmaker"',
    engineCategory: '2-Stroke',
    tagline: 'Huyền thoại 2-thì - Sức mạnh bạo lực ngất ngây',
    description: 'Biểu tượng huyền thoại mở ga là dựng đứng xe ngay tức thì! Gia tốc vũ bão đòi hỏi tay nài phải cực nhạy phanh sau để thuần hóa.',
    color: '#22c55e',
    soundType: '2stroke_heavy',
    modelType: 'glb',
    modelUrl: kawasakiUrl,
    modelTransform: {
      scale: 1.0,
      rotationY: Math.PI / 2,
      offsetY: 0.67,
      fenderTip: [0, 0.95, -1.15],
      riderOffset: [0, 0.96, -0.15],
      exhaustTip: [0.22, 0.82, -0.98],
    },
    stats: {
      topSpeedKmh: 98,
      power: 100,
      wheelieTorque: 98,
      stability: 72,
      weightKg: 101,
    },
    physics: {
      maxSpeed: 27.2, // ~98 km/h (< 100 km/h)
      accelerationPower: 9.5,
      brakePower: 24.0,
      throttlePitchTorque: 4.3,
      leanPitchTorque: 3.2,
      brakePitchTorque: 8.0,
      balanceAngle: 0.96, // ~55 deg
      scrapeAngle: 1.34, // ~77 deg
      crashAngle: Math.PI / 2, // 90 deg (1.5708 rad)
    },
  },
  {
    id: 'yamaha_yz125',
    name: 'Yamaha YZ125',
    brand: 'Yamaha Monster Energy',
    engine: '125cc 2-Thì YPVS Screamer',
    engineCategory: '2-Stroke',
    tagline: 'Gọn nhẹ linh hoạt - Bậc thầy giữ thăng bằng',
    description: 'Trọng lượng siêu nhẹ với khung nhôm thanh thoát. Dải Sweet Spot cực rộng giúp người chơi bốc đầu dài bất tận và né chướng ngại vật mượt mà.',
    color: '#3b82f6',
    soundType: '2stroke_screamer',
    modelType: 'glb',
    modelUrl: yamahaUrl,
    modelTransform: {
      scale: 1.0,
      rotationY: Math.PI / 2,
      offsetY: 0.56,
      fenderTip: [0, 0.88, -1.05],
      riderOffset: [0, 0.88, -0.15],
      exhaustTip: [0.18, 0.76, -0.92],
    },
    stats: {
      topSpeedKmh: 85,
      power: 78,
      wheelieTorque: 84,
      stability: 96,
      weightKg: 87,
    },
    physics: {
      maxSpeed: 23.6, // ~85 km/h (< 100 km/h)
      accelerationPower: 7.5,
      brakePower: 20.0,
      throttlePitchTorque: 3.8,
      leanPitchTorque: 2.8,
      brakePitchTorque: 7.0,
      balanceAngle: 1.0, // ~57 deg
      scrapeAngle: 1.38, // ~79 deg
      crashAngle: Math.PI / 2, // 90 deg (1.5708 rad)
    },
  },
];

export const DEFAULT_BIKE_ID = 'fantic_xxf_450';

export function getBikeConfig(bikeId: string): BikeConfig {
  return BIKES_DATABASE.find((b) => b.id === bikeId) || BIKES_DATABASE[0];
}
