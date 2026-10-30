import { describe, expect, it } from 'vitest';
import { OneEuroFilter } from '@/hand/oneEuro';
import { HandInterpreter, classifyPose, type DetectedHand, type Landmark } from '@/hand/gestures';
import { HAND_CONFIG } from '@/hand/config';

/** A synthetic right hand: wrist at (cx, cy + 0.2), fingers pointing up, each either extended or curled. */
function hand(cx: number, cy: number, opts: { extended?: boolean; pinch?: boolean } = {}): Landmark[] {
  const { extended = true, pinch = false } = opts;
  const lm: Landmark[] = Array.from({ length: 21 }, () => ({ x: cx, y: cy, z: 0 }));
  lm[0] = { x: cx, y: cy + 0.2, z: 0 }; // wrist
  const knuckles = [5, 9, 13, 17];
  knuckles.forEach((k, i) => {
    const x = cx - 0.06 + i * 0.04;
    lm[k] = { x, y: cy + 0.05, z: 0 };
    lm[k + 1] = { x, y: cy - 0.02, z: 0 }; // middle joint (PIP)
    lm[k + 2] = { x, y: extended ? cy - 0.06 : cy + 0.06, z: 0 };
    lm[k + 3] = { x, y: extended ? cy - 0.1 : cy + 0.08, z: 0 }; // tip: far up when extended, curled back otherwise
  });
  lm[4] = pinch ? { x: lm[8]!.x + 0.005, y: lm[8]!.y, z: 0 } : { x: cx - 0.14, y: cy + 0.05, z: 0 }; // thumb tip
  return lm;
}
const right = (lm: Landmark[]): DetectedHand => ({ landmarks: lm, handedness: 'Right' });

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

describe('hand poses', () => {
  it('recognises open hand, fist and pinch', () => {
    expect(classifyPose(hand(0.5, 0.5), false)).toBe('open');
    expect(classifyPose(hand(0.5, 0.5, { extended: false }), false)).toBe('fist');
    expect(classifyPose(hand(0.5, 0.5, { pinch: true }), false)).toBe('pinch');
  });
});

describe('hand interpreter', () => {
  const frames = HAND_CONFIG.gestures.confirmFrames;

  it('waits a few frames before a gesture takes effect, then orbits with an open hand', () => {
    const h = new HandInterpreter();
    let last = h.update([right(hand(0.5, 0.5))], 0);
    expect(last.mode).toBe('none');
    for (let i = 1; i < frames; i++) last = h.update([right(hand(0.5, 0.5))], i * 33);
    expect(last.mode).toBe('orbit');
    let theta = 0;
    for (let i = 0; i < 10; i++) theta += h.update([right(hand(0.5 - i * 0.02, 0.5))], (frames + i) * 33).orbit.theta;
    expect(theta).not.toBe(0);
  });

  it('ignores tiny tremors (dead zone)', () => {
    const h = new HandInterpreter();
    for (let i = 0; i < frames + 5; i++) h.update([right(hand(0.5, 0.5))], i * 33);
    let total = 0;
    for (let i = 0; i < 20; i++) total += Math.abs(h.update([right(hand(0.5 + (i % 2 ? 0.001 : -0.001), 0.5))], (frames + 5 + i) * 33).orbit.theta);
    expect(total).toBe(0);
  });

  it('selects once per pinch', () => {
    const h = new HandInterpreter();
    let selects = 0;
    for (let i = 0; i < 30; i++) if (h.update([right(hand(0.5, 0.5, { pinch: true }))], i * 33).select) selects++;
    expect(selects).toBe(1);
  });

  it('freezes with a fist', () => {
    const h = new HandInterpreter();
    let mode = '';
    for (let i = 0; i < frames + 1; i++) mode = h.update([right(hand(0.5, 0.5, { extended: false }))], i * 33).mode;
    expect(mode).toBe('fist');
  });
});
