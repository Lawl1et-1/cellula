import { HAND_CONFIG } from './config';
import { OneEuroFilter, OneEuroFilter2D } from './oneEuro';

/** One MediaPipe hand landmark, normalised to the analysed frame. */
export interface Landmark {
  x: number;
  y: number;
  z: number;
}
/** A hand as MediaPipe reports it: `label` is MediaPipe's own handedness (mirrored, see config). */
export interface DetectedHand {
  /** 21 landmarks (0 wrist, 5/9/13/17 knuckles, 8/12/16/20 fingertips…). */
  landmarks: Landmark[];
  label: 'Left' | 'Right';
}

export type HandSide = 'left' | 'right';
export type HandShape = 'open' | 'closed' | 'between';

const dist = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * How open the hand is: average over the four fingers of (wrist → fingertip) ÷ (wrist → knuckle).
 * ~1.9 open, ~1.0 fist; independent of the hand's distance from the camera.
 */
export function openness(h: Landmark[]) {
  const wrist = h[0]!;
  const fingers = [
    [5, 8],
    [9, 12],
    [13, 16],
    [17, 20],
  ] as const;
  let sum = 0;
  for (const [knuckle, tip] of fingers) sum += dist(wrist, h[tip]!) / (dist(wrist, h[knuckle]!) || 1e-6);
  return sum / fingers.length;
}

export const palmCenter = (h: Landmark[]) => {
  const ids = [0, 5, 9, 13, 17];
  return {
    x: ids.reduce((s, i) => s + h[i]!.x, 0) / ids.length,
    y: ids.reduce((s, i) => s + h[i]!.y, 0) / ids.length,
  };
};

/**
 * Your real left / right hand. MediaPipe's label assumes a mirrored image (see `handedness.swap`). If both
 * hands get the same label (it happens when they cross), the one on your left of the frame is the left one.
 */
export function assignSides(hands: DetectedHand[], swap: boolean = HAND_CONFIG.handedness.swap): Partial<Record<HandSide, DetectedHand>> {
  const sideOf = (h: DetectedHand): HandSide => ((h.label === 'Left') !== swap ? 'left' : 'right');
  if (hands.length >= 2) {
    const [a, b] = hands as [DetectedHand, DetectedHand];
    if (sideOf(a) !== sideOf(b)) return { [sideOf(a)]: a, [sideOf(b)]: b };
    // Mirrored x: the hand with the larger raw x is on the user's left.
    const aLeft = palmCenter(a.landmarks).x > palmCenter(b.landmarks).x;
    return { left: aLeft ? a : b, right: aLeft ? b : a };
  }
  return hands[0] ? { [sideOf(hands[0])]: hands[0] } : {};
}

export interface HandReport {
  shape: HandShape;
  openness: number;
  /** Open, held open long enough and not changing shape: allowed to pan. */
  steady: boolean;
}

export interface GestureFrame {
  hands: Record<HandSide, HandReport | null>;
  /** Zoom steps triggered by this frame: +1 in (right hand closed), −1 out (left hand closed). */
  zoom: number;
  /** Pan velocity from the right hand, in frame widths per second (x right, y down), null when not panning. */
  pan: { x: number; y: number } | null;
  panHand: HandSide | null;
  /** Rotation velocity from the left hand, in frame widths per second (x right, y down), null when not rotating. */
  rotate: { x: number; y: number } | null;
}

const deadZone = (v: number, dz: number) => (Math.abs(v) <= dz ? 0 : v - Math.sign(v) * dz);

/** One hand's state across frames: shape with hysteresis, open→close cycles, steadiness and palm motion. */
class SideTracker {
  private f = HAND_CONFIG.filter;
  private opennessFilter = new OneEuroFilter(this.f.minCutoff, this.f.beta, this.f.dCutoff);
  private palmFilter = new OneEuroFilter2D(this.f.minCutoff, this.f.beta, this.f.dCutoff);
  shape: HandShape = 'between';
  private wasOpen = false;
  private openSince = 0;
  private lastOpenness: number | null = null;
  private lastT = 0;
  private lastPalm: { x: number; y: number } | null = null;
  lastSeen = -Infinity;

  /**
   * `t` in ms; `dz` is the movement dead zone for what this hand drives. Returns the report, whether a close
   * completed an open→close cycle, and the palm velocity (only while the hand is steady and open).
   */
  update(hand: DetectedHand, t: number, dz: number) {
    const c = HAND_CONFIG;
    const ts = t / 1000;
    const dt = Math.max(1e-3, (t - this.lastT) / 1000);
    const fresh = t - this.lastSeen > c.lostAfterMs;
    if (fresh) this.reset();
    this.lastSeen = t;

    const o = this.opennessFilter.filter(openness(hand.landmarks), ts);
    const rate = this.lastOpenness === null ? 0 : Math.abs(o - this.lastOpenness) / dt;
    this.lastOpenness = o;

    let closed = false;
    if (this.shape !== 'open' && o > c.curl.openAbove) {
      this.shape = 'open';
      this.wasOpen = true;
      this.openSince = t;
    } else if (this.shape !== 'closed' && o < c.curl.closedBelow) {
      this.shape = 'closed';
      // A zoom step only for a full open → closed cycle (and only once while the fist stays closed).
      closed = this.wasOpen;
      this.wasOpen = false;
    }

    const steady = this.shape === 'open' && t - this.openSince >= c.pan.stableMs && rate < c.pan.maxOpennessRate;

    // Palm, mirrored so that x grows to the user's right.
    const raw = palmCenter(hand.landmarks);
    const p = this.palmFilter.filter(1 - raw.x, raw.y, ts);
    let velocity: { x: number; y: number } | null = null;
    if (steady && this.lastPalm && !fresh) {
      const dx = deadZone(p.x - this.lastPalm.x, dz);
      const dy = deadZone(p.y - this.lastPalm.y, dz);
      velocity = { x: dx / dt, y: dy / dt };
    }
    // Not steady: forget the reference, so panning resumes from where the hand is (no jump).
    this.lastPalm = steady ? p : null;
    this.lastT = t;
    return { report: { shape: this.shape, openness: o, steady }, closed, velocity };
  }

  reset() {
    this.opennessFilter.reset();
    this.palmFilter.reset();
    this.shape = 'between';
    this.wasOpen = false;
    this.lastOpenness = null;
    this.lastPalm = null;
  }
}

/**
 * Turns detections into intentions: zoom steps from fist cycles (right in, left out), panning from the steady
 * open right hand and rotation from the steady open left hand. Both hands can act at the same time.
 */
export class GestureEngine {
  private sides: Record<HandSide, SideTracker> = { left: new SideTracker(), right: new SideTracker() };

  /** `t` in ms (the capture time of the analysed frame). */
  update(hands: DetectedHand[], t: number): GestureFrame {
    const assigned = assignSides(hands);
    const out: GestureFrame = { hands: { left: null, right: null }, zoom: 0, pan: null, panHand: null, rotate: null };
    for (const side of ['left', 'right'] as const) {
      const hand = assigned[side];
      const tracker = this.sides[side];
      if (!hand) {
        if (t - tracker.lastSeen > HAND_CONFIG.lostAfterMs) tracker.reset();
        continue;
      }
      const dz = side === 'right' ? HAND_CONFIG.pan.deadZone : HAND_CONFIG.rotate.deadZone;
      const r = tracker.update(hand, t, dz);
      out.hands[side] = r.report;
      if (r.closed) out.zoom += side === 'right' ? 1 : -1;
      if (!r.velocity) continue;
      if (side === 'right') {
        const sign = HAND_CONFIG.pan.invert ? -1 : 1;
        out.pan = { x: sign * r.velocity.x, y: sign * r.velocity.y };
        out.panHand = 'right';
      } else {
        out.rotate = r.velocity;
      }
    }
    return out;
  }

  reset() {
    this.sides.left.reset();
    this.sides.right.reset();
  }
}
