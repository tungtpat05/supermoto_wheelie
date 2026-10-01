import * as THREE from 'three';

let cachedSmokeTexture: THREE.CanvasTexture | null = null;
let cachedDustTexture: THREE.CanvasTexture | null = null;
let cachedSparkTexture: THREE.CanvasTexture | null = null;

/**
 * Procedurally generates a soft, billowy radial smoke puff texture
 */
export function getSmokeTexture(): THREE.CanvasTexture {
  if (cachedSmokeTexture) return cachedSmokeTexture;

  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const center = size / 2;
    // Radial soft smoke cloud with smooth falloff
    const gradient = ctx.createRadialGradient(center, center, 4, center, center, size / 2);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    gradient.addColorStop(0.25, 'rgba(240, 240, 245, 0.7)');
    gradient.addColorStop(0.55, 'rgba(210, 215, 220, 0.35)');
    gradient.addColorStop(0.8, 'rgba(180, 185, 190, 0.1)');
    gradient.addColorStop(1, 'rgba(160, 165, 170, 0.0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(center, center, size / 2, 0, Math.PI * 2);
    ctx.fill();

    // Add subtle cloud puff irregularities
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2 + Math.random() * 0.4;
      const dist = 14 + Math.random() * 18;
      const puffX = center + Math.cos(angle) * dist;
      const puffY = center + Math.sin(angle) * dist;
      const puffR = 24 + Math.random() * 16;

      const subGrad = ctx.createRadialGradient(puffX, puffY, 0, puffX, puffY, puffR);
      subGrad.addColorStop(0, 'rgba(255, 255, 255, 0.4)');
      subGrad.addColorStop(0.6, 'rgba(220, 220, 225, 0.15)');
      subGrad.addColorStop(1, 'rgba(200, 200, 205, 0)');

      ctx.fillStyle = subGrad;
      ctx.beginPath();
      ctx.arc(puffX, puffY, puffR, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  cachedSmokeTexture = new THREE.CanvasTexture(canvas);
  cachedSmokeTexture.needsUpdate = true;
  return cachedSmokeTexture;
}

/**
 * Procedurally generates a soft grainy dust puff texture
 */
export function getDustTexture(): THREE.CanvasTexture {
  if (cachedDustTexture) return cachedDustTexture;

  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const center = size / 2;
    const gradient = ctx.createRadialGradient(center, center, 2, center, center, size / 2);
    gradient.addColorStop(0, 'rgba(235, 215, 175, 0.9)');
    gradient.addColorStop(0.4, 'rgba(210, 185, 140, 0.5)');
    gradient.addColorStop(0.7, 'rgba(180, 155, 115, 0.2)');
    gradient.addColorStop(1, 'rgba(160, 135, 95, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(center, center, size / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  cachedDustTexture = new THREE.CanvasTexture(canvas);
  cachedDustTexture.needsUpdate = true;
  return cachedDustTexture;
}

/**
 * Procedurally generates a sharp star-flare spark texture for fender scrape
 */
export function getSparkTexture(): THREE.CanvasTexture {
  if (cachedSparkTexture) return cachedSparkTexture;

  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    const center = size / 2;
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, size / 2);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    gradient.addColorStop(0.2, 'rgba(255, 230, 120, 0.9)');
    gradient.addColorStop(0.5, 'rgba(255, 140, 30, 0.4)');
    gradient.addColorStop(1, 'rgba(255, 80, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(center, center, size / 2, 0, Math.PI * 2);
    ctx.fill();

    // 4-point star streaks
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(center - 1, 4, 2, size - 8);
    ctx.fillRect(4, center - 1, size - 8, 2);
  }

  cachedSparkTexture = new THREE.CanvasTexture(canvas);
  cachedSparkTexture.needsUpdate = true;
  return cachedSparkTexture;
}
