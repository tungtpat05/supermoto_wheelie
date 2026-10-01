import * as THREE from 'three';

export interface TwoBoneSolution {
  joint: THREE.Vector3;
  end: THREE.Vector3;
  reachable: boolean;
}

/** Analytic two-bone IK in bike-local space, with a stable bend-direction pole. */
export function solveTwoBoneIK(
  start: THREE.Vector3, target: THREE.Vector3, upperLength: number, lowerLength: number,
  bendDirection: THREE.Vector3,
): TwoBoneSolution {
  const axis = target.clone().sub(start);
  const distance = axis.length();
  if (distance < 1e-8) axis.set(0, -1, 0);
  else axis.divideScalar(distance);
  const upper = Math.max(1e-4, upperLength);
  const lower = Math.max(1e-4, lowerLength);
  const reachable = distance <= upper + lower && distance >= Math.abs(upper - lower);

  // Always preserve the grip/peg contact even if the edited dimensions cannot reach.
  // An unreachable pose stretches/compresses only the visual bones; debug turns orange.
  let a = upper;
  let b = lower;
  if (distance > upper + lower) {
    const factor = distance / (upper + lower);
    a *= factor; b *= factor;
  } else if (distance < Math.abs(upper - lower)) {
    a = b = Math.max(upper, lower);
  }
  const projected = distance > 1e-8
    ? (a * a - b * b + distance * distance) / (2 * distance) : 0;
  const height = Math.sqrt(Math.max(0, a * a - projected * projected));
  const bend = bendDirection.clone().addScaledVector(axis, -bendDirection.dot(axis));
  if (bend.lengthSq() < 1e-8) {
    // Pick the least parallel basis, deterministically, avoiding NaNs and pole flips.
    bend.set(Math.abs(axis.x) < 0.8 ? 1 : 0, Math.abs(axis.x) < 0.8 ? 0 : 1, 0);
    bend.addScaledVector(axis, -bend.dot(axis));
  }
  bend.normalize();
  return {
    joint: start.clone().addScaledVector(axis, projected).addScaledVector(bend, height),
    end: target.clone(),
    reachable,
  };
}
