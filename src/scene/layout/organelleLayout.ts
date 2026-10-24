import { Matrix4, Quaternion, Vector3 } from 'three';
import { createRng, type Rng } from '@/lib/random';
import { CELL, GOLGI_CENTER, orientTangent, randomCytoplasmPoint, scatter, toMatrices } from './cellLayout';

/**
 * Placement of instanced organelles, shared by the renderers and the picking proxies so that what
 * you click is exactly what you see. Each layout is computed once (seeded, deterministic).
 */
export interface InstanceLayout {
  matrices: Matrix4[];
  seeds: number[];
}

const once = <T>(fn: () => T) => {
  let value: T | undefined;
  return () => (value ??= fn());
};

/** Instances drawn in a healthy cell; layouts hold more so diseases can make organelles proliferate. */
export const BASE_COUNT = { mitochondrion: 64, lysosome: 34, peroxisome: 42 } as const;

const uniform = (min: number, max: number) => (rng: Rng) => new Vector3(1, 1, 1).multiplyScalar(rng.range(min, max));

/** Real mitochondria: ~0.5 µm wide, 1–4 µm long (here 5 units wide, ~12–22 long). */
export const mitochondriaLayout = once<InstanceLayout>(() => {
  const placed = orientTangent(
    scatter(11, Math.round(BASE_COUNT.mitochondrion * 2.5), {
      spacing: 10,
      margin: 3,
      scale: (rng) => new Vector3(1, rng.range(0.75, 1.45), 1).multiplyScalar(rng.range(0.85, 1.12)),
      bias: (p) => (p.distanceTo(CELL.nucleus.center) < 60 ? 1 : 0.55),
    }),
    12,
  );
  return { matrices: toMatrices(placed), seeds: placed.map((o) => o.seed) };
});

export const lysosomesLayout = once<InstanceLayout>(() => {
  const placed = scatter(21, BASE_COUNT.lysosome * 3, { spacing: 6, margin: 2, scale: uniform(0.7, 1.35) });
  return { matrices: toMatrices(placed), seeds: placed.map((o) => o.seed) };
});

export const peroxisomesLayout = once<InstanceLayout>(() => {
  const placed = scatter(31, BASE_COUNT.peroxisome * 3, { spacing: 5, margin: 2, scale: uniform(0.75, 1.2) });
  return { matrices: toMatrices(placed), seeds: placed.map((o) => o.seed) };
});

/** Only the instances present in a healthy cell (picking, camera anchors, scenario anchors). */
export function healthy(layout: InstanceLayout, id: keyof typeof BASE_COUNT): InstanceLayout {
  const n = BASE_COUNT[id];
  return { matrices: layout.matrices.slice(0, n), seeds: layout.seeds.slice(0, n) };
}

export const vesiclesLayout = once<InstanceLayout>(() => {
  const rng = createRng(41);
  const matrices: Matrix4[] = [];
  const seeds: number[] = [];
  const p = new Vector3();
  const q = new Quaternion();
  for (let i = 0; i < 220; i++) {
    if (i < 60) {
      // Transport vesicles crowd around the Golgi stack.
      p.copy(GOLGI_CENTER).add(rng.direction().multiplyScalar(rng.range(9, 20)));
    } else {
      randomCytoplasmPoint(rng, p, 1);
    }
    const s = rng.range(0.6, 1.5);
    matrices.push(new Matrix4().compose(p, q, new Vector3(s, s, s)));
    seeds.push(rng.next());
  }
  return { matrices, seeds };
});
