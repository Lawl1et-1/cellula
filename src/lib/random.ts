import { Vector3 } from 'three';

/** Deterministic PRNG (mulberry32): the same seed always builds the same cell. */
export function createRng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const range = (min: number, max: number) => min + (max - min) * next();
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)]!;
  /** Uniform direction on the unit sphere. */
  const direction = (out = new Vector3()) => {
    const z = range(-1, 1);
    const phi = range(0, Math.PI * 2);
    const r = Math.sqrt(1 - z * z);
    return out.set(r * Math.cos(phi), z, r * Math.sin(phi));
  };
  const gaussian = () => {
    const u = Math.max(next(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
  };
  return { next, range, pick, direction, gaussian };
}
export type Rng = ReturnType<typeof createRng>;

/** Evenly spread points on a sphere (Fibonacci lattice). */
export function fibonacciSphere(count: number, i: number, out = new Vector3()) {
  const y = 1 - (2 * (i + 0.5)) / count;
  const r = Math.sqrt(1 - y * y);
  const theta = Math.PI * (3 - Math.sqrt(5)) * i;
  return out.set(Math.cos(theta) * r, y, Math.sin(theta) * r);
}
