import { Matrix4, Quaternion, Vector3 } from 'three';
import { createRng, type Rng } from '@/lib/random';

/**
 * Seeded spatial layout of the cell. 1 scene unit = 0.1 µm.
 * Sizes of organelles are close to reality; molecular-scale objects are enlarged (see uMolecularScale).
 */
export const CELL = {
  /** Ellipsoid radii of the plasma membrane: ~20 × 16 × 19 µm. */
  radii: new Vector3(100, 82, 95),
  nucleus: { center: new Vector3(-6, 2, -4), radius: 28 },
  /** Direction from the nucleus towards the centrosome / Golgi pole. */
  pole: new Vector3(0.62, 0.34, 0.7).normalize(),
};

export const CENTROSOME = CELL.nucleus.center.clone().addScaledVector(CELL.pole, CELL.nucleus.radius + 9);
export const GOLGI_CENTER = CELL.nucleus.center.clone().addScaledVector(CELL.pole, CELL.nucleus.radius + 20);

/** Normalised ellipsoid distance: < 1 inside the cell. */
export function cellDistance(p: Vector3) {
  return Math.hypot(p.x / CELL.radii.x, p.y / CELL.radii.y, p.z / CELL.radii.z);
}

export function insideCytoplasm(p: Vector3, margin = 0) {
  const nucleusClear = p.distanceTo(CELL.nucleus.center) > CELL.nucleus.radius + 6 + margin;
  return nucleusClear && cellDistance(p) < 1 - (margin + 4) / CELL.radii.y;
}

export function randomCytoplasmPoint(rng: Rng, out = new Vector3(), margin = 0) {
  for (let i = 0; i < 200; i++) {
    out.set(rng.range(-1, 1), rng.range(-1, 1), rng.range(-1, 1)).multiply(CELL.radii);
    if (insideCytoplasm(out, margin)) return out;
  }
  return out.set(CELL.radii.x * 0.6, 0, 0);
}

export interface Placed {
  position: Vector3;
  quaternion: Quaternion;
  scale: Vector3;
  seed: number;
}

/** Rejection-sampled placement with minimum spacing between objects of the same kind. */
export function scatter(
  seed: number,
  count: number,
  opts: { spacing: number; margin?: number; bias?: (p: Vector3) => number; scale: (rng: Rng) => Vector3 },
): Placed[] {
  const rng = createRng(seed);
  const placed: Placed[] = [];
  const p = new Vector3();
  for (let attempt = 0; placed.length < count && attempt < count * 80; attempt++) {
    randomCytoplasmPoint(rng, p, opts.margin ?? 0);
    if (opts.bias && rng.next() > opts.bias(p)) continue;
    if (p.distanceTo(GOLGI_CENTER) < 16) continue;
    if (placed.some((o) => o.position.distanceTo(p) < opts.spacing)) continue;
    const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), rng.direction());
    placed.push({ position: p.clone(), quaternion, scale: opts.scale(rng), seed: rng.next() });
  }
  return placed;
}

export function toMatrices(items: Placed[]) {
  return items.map((o) => new Matrix4().compose(o.position, o.quaternion, o.scale));
}

/** Mitochondria tend to align tangentially around the nucleus and gather where ATP demand is high. */
export function orientTangent(items: Placed[], rngSeed: number) {
  const rng = createRng(rngSeed);
  const radial = new Vector3();
  const tangent = new Vector3();
  for (const o of items) {
    radial.subVectors(o.position, CELL.nucleus.center).normalize();
    tangent.crossVectors(radial, rng.direction()).normalize();
    o.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), tangent);
  }
  return items;
}
