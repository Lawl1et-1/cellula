import { describe, expect, it } from 'vitest';
import { OneEuroFilter } from '@/hand/oneEuro';
import { GestureEngine, assignSides, openness, type DetectedHand, type Landmark } from '@/hand/gestures';
import { HAND_CONFIG } from '@/hand/config';

/**
 * A synthetic hand in raw (unmirrored) camera coordinates: wrist below, fingers pointing up.
 * `curl` 0 = fully open (openness ≈ 2), 1 = fist (openness ≈ 0.8).
 */
function hand(cx: number, cy: number, curl = 0): Landmark[] {
  const lm: Landmark[] = Array.from({ length: 21 }, () => ({ x: cx, y: cy, z: 0 }));
  lm[0] = { x: cx, y: cy + 0.2, z: 0 };
  [5, 9, 13, 17].forEach((k, i) => {
    const x = cx - 0.015 + i * 0.01;
    const tipY = cy - 0.1 + curl * 0.18;
    lm[k] = { x, y: cy + 0.05, z: 0 };
    lm[k + 1] = { x, y: cy - 0.02 + curl * 0.06, z: 0 };
    lm[k + 2] = { x, y: (cy - 0.02 + tipY) / 2, z: 0 };
    lm[k + 3] = { x, y: tipY, z: 0 };
  });
  lm[4] = { x: cx - 0.08, y: cy + 0.05, z: 0 };
  return lm;
}
/** MediaPipe labels assume a mirrored image: the user's right hand comes back labelled "Left". */
const realRight = (lm: Landmark[]): DetectedHand => ({ landmarks: lm, label: 'Left' });
const realLeft = (lm: Landmark[]): DetectedHand => ({ landmarks: lm, label: 'Right' });

/** Feeds frames at 30 per second and returns them all. */
function run(engine: GestureEngine, frames: DetectedHand[][], start = 0) {
  return frames.map((hands, i) => engine.update(hands, start + i * 33));
}
const repeat = <T,>(n: number, f: (i: number) => T) => Array.from({ length: n }, (_, i) => f(i));

describe('One Euro filter', () => {
  it('passes the first value through and smooths jitter around a still value', () => {
    const f = new OneEuroFilter(1, 0);
    expect(f.filter(1, 0)).toBe(1);
    let out = 1;
    for (let i = 1; i <= 30; i++) out = f.filter(1 + (i % 2 ? 0.05 : -0.05), i / 30);
    expect(Math.abs(out - 1)).toBeLessThan(0.03);
  });

  it('follows a fast movement closely when beta is high', () => {
    const f = new OneEuroFilter(1, 20);
    let out = 0;
    for (let i = 0; i <= 30; i++) out = f.filter(i / 30, i / 30);
    expect(out).toBeGreaterThan(0.85);
  });
});

describe('hand shape and side', () => {
  it('measures openness from finger curl', () => {
    expect(openness(hand(0.5, 0.5, 0))).toBeGreaterThan(HAND_CONFIG.curl.openAbove);
    expect(openness(hand(0.5, 0.5, 1))).toBeLessThan(HAND_CONFIG.curl.closedBelow);
  });

  it('maps MediaPipe labels to the real hands, and can be swapped', () => {
    expect(Object.keys(assignSides([realRight(hand(0.3, 0.5))]))).toEqual(['right']);
    expect(Object.keys(assignSides([realRight(hand(0.3, 0.5))], false))).toEqual(['left']);
  });

  it('separates two hands with the same label by position', () => {
    // Raw image: the user's left hand appears on the right of the frame (larger x).
    const a = { landmarks: hand(0.75, 0.5), label: 'Left' as const };
    const b = { landmarks: hand(0.25, 0.5), label: 'Left' as const };
    const sides = assignSides([a, b]);
    expect(sides.left).toBe(a);
    expect(sides.right).toBe(b);
  });
});

describe('zoom gestures', () => {
  it('right hand open → closed zooms in exactly once, even if the fist stays closed', () => {
    const e = new GestureEngine();
    const frames = run(e, [...repeat(10, () => [realRight(hand(0.3, 0.5, 0))]), ...repeat(30, () => [realRight(hand(0.3, 0.5, 1))])]);
    expect(frames.reduce((s, f) => s + f.zoom, 0)).toBe(1);
  });

  it('left hand open → closed zooms out', () => {
    const e = new GestureEngine();
    const frames = run(e, [...repeat(10, () => [realLeft(hand(0.7, 0.5, 0))]), ...repeat(10, () => [realLeft(hand(0.7, 0.5, 1))])]);
    expect(frames.reduce((s, f) => s + f.zoom, 0)).toBe(-1);
  });

  it('each full cycle gives one step; a hand that starts closed gives none', () => {
    const e = new GestureEngine();
    const cycle = (i: number) => [realRight(hand(0.3, 0.5, Math.floor(i / 10) % 2))];
    expect(run(e, repeat(60, cycle)).reduce((s, f) => s + f.zoom, 0)).toBe(3);
    const e2 = new GestureEngine();
    expect(run(e2, repeat(20, () => [realRight(hand(0.3, 0.5, 1))])).reduce((s, f) => s + f.zoom, 0)).toBe(0);
  });

  it('a half-closed hand does not flicker between open and closed (hysteresis)', () => {
    const e = new GestureEngine();
    const half = (HAND_CONFIG.curl.openAbove + HAND_CONFIG.curl.closedBelow) / 2;
    // Find a curl giving an openness inside the band, then jitter around it.
    let curl = 0;
    while (openness(hand(0.3, 0.5, curl)) > half) curl += 0.01;
    run(e, repeat(10, () => [realRight(hand(0.3, 0.5, 0))]));
    const frames = run(e, repeat(40, (i) => [realRight(hand(0.3, 0.5, curl + (i % 2 ? 0.03 : -0.03)))]), 400);
    expect(frames.every((f) => f.hands.right?.shape === 'open')).toBe(true);
    expect(frames.reduce((s, f) => s + f.zoom, 0)).toBe(0);
  });
});

describe('panning', () => {
  it('a steady open hand moving to the user’s right pans right', () => {
    const e = new GestureEngine();
    run(e, repeat(15, () => [realRight(hand(0.5, 0.5))]));
    // Raw x decreases when the user moves right (the camera sees a mirror image of the movement).
    const frames = run(e, repeat(10, (i) => [realRight(hand(0.5 - i * 0.02, 0.5))]), 500);
    const panned = frames.filter((f) => f.pan);
    expect(panned.map((f) => Math.sign(f.pan!.x))).not.toContain(-1);
    expect(panned.some((f) => f.pan!.x > 0)).toBe(true);
  });

  it('moving up pans up', () => {
    const e = new GestureEngine();
    run(e, repeat(15, () => [realRight(hand(0.5, 0.5))]));
    const frames = run(e, repeat(10, (i) => [realRight(hand(0.5, 0.5 - i * 0.02))]), 500);
    expect(frames.some((f) => f.pan && f.pan.y < 0)).toBe(true);
  });

  it('ignores tremor (dead zone)', () => {
    const e = new GestureEngine();
    const frames = run(e, repeat(40, (i) => [realRight(hand(0.5 + (i % 2 ? 0.001 : -0.001), 0.5))]));
    expect(frames.every((f) => !f.pan || (f.pan.x === 0 && f.pan.y === 0))).toBe(true);
  });

  it('does not pan while the hand is closing or just after it opens', () => {
    const e = new GestureEngine();
    // Closing while moving: never pans.
    const closing = run(e, repeat(12, (i) => [realRight(hand(0.5 - i * 0.02, 0.5, i / 11))]));
    expect(closing.slice(1).every((f) => !f.pan || (f.pan.x === 0 && f.pan.y === 0))).toBe(true);
    // Re-opening while moving: no pan until the hand has been open for `stableMs`.
    const reopening = run(e, repeat(4, (i) => [realRight(hand(0.3 + i * 0.02, 0.5, 0))]), 1000);
    expect(reopening.every((f) => !f.pan)).toBe(true);
  });
});
