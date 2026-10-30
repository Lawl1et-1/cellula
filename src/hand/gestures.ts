import { HAND_CONFIG } from './config';
import { OneEuroFilter, OneEuroFilter2D } from './oneEuro';

/** One MediaPipe hand landmark, normalised to the analysed frame. */
export interface Landmark {
  x: number;
  y: number;
  z: number;
}
export interface DetectedHand {
  /** 21 landmarks (0 wrist, 4 thumb tip, 8 index tip, …). */
  landmarks: Landmark[];
  handedness: 'Left' | 'Right';
}

export type Pose = 'open' | 'point' | 'pinch' | 'fist';
export type HandMode = 'none' | 'orbit' | 'point' | 'pinch' | 'fist' | 'zoom';

const dist = (a: Landmark, b: Landmark) => Math.hypot(a.x - b.x, a.y - b.y);

/** Wrist to middle-finger knuckle: a size that follows the hand's distance from the camera. */
export const handSize = (h: Landmark[]) => dist(h[0]!, h[9]!) || 1e-6;

export const palmCenter = (h: Landmark[]) => {
  const ids = [0, 5, 9, 13, 17];
  return {
    x: ids.reduce((s, i) => s + h[i]!.x, 0) / ids.length,
    y: ids.reduce((s, i) => s + h[i]!.y, 0) / ids.length,
  };
};

/** Fingers (index to little finger) whose tip is clearly farther from the wrist than their middle joint. */
export function extendedFingers(h: Landmark[], ratio = HAND_CONFIG.gestures.extendedRatio) {
  const wrist = h[0]!;
  return [
    [8, 6],
    [12, 10],
    [16, 14],
    [20, 18],
  ].filter(([tip, pip]) => dist(wrist, h[tip!]!) > dist(wrist, h[pip!]!) * ratio).length;
}

/** Pose of one hand. Pinching has hysteresis: it starts below `pinchOn` and ends above `pinchOff`. */
export function classifyPose(h: Landmark[], wasPinching: boolean): Pose {
  const g = HAND_CONFIG.gestures;
  const pinch = dist(h[4]!, h[8]!) / handSize(h);
  if (pinch < (wasPinching ? g.pinchOff : g.pinchOn)) return 'pinch';
  const extended = extendedFingers(h);
  if (extended === 0) return 'fist';
  if (extended >= 4) return 'open';
  return 'point';
}

export interface HandFrame {
  /** Cursor on screen, 0..1 from the top-left (null when no hand is seen). */
  cursor: { x: number; y: number } | null;
  /** Confirmed mode (after `confirmFrames`). */
  mode: HandMode;
  /** Camera orbit since the previous frame, in radians (azimuth, polar). */
  orbit: { theta: number; phi: number };
  /** Dolly since the previous frame, as a fraction of the camera distance (positive = closer). */
  zoom: number;
  /** True on the frame a pinch selects. */
  select: boolean;
}

const deadZone = (v: number, dz: number) => (Math.abs(v) <= dz ? 0 : v - Math.sign(v) * dz);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Turns raw detections into intentions, one frame at a time: smoothing (One Euro), dead zones, a few frames
 * of confirmation before a gesture takes effect, and a cooldown between selections.
 */
export class HandInterpreter {
  private f = HAND_CONFIG.filter;
  private cursorFilter = new OneEuroFilter2D(this.f.minCutoff, this.f.beta, this.f.dCutoff);
  private palmFilter = new OneEuroFilter2D(this.f.minCutoff, this.f.beta, this.f.dCutoff);
  private spreadFilter = new OneEuroFilter(this.f.minCutoff, this.f.beta, this.f.dCutoff);
  private lastPalm: { x: number; y: number } | null = null;
  private lastSpread: number | null = null;
  private pinching = false;
  private candidate: HandMode = 'none';
  private candidateFrames = 0;
  private mode: HandMode = 'none';
  private lastSeen = -Infinity;
  private lastSelect = -Infinity;
  private cursor: { x: number; y: number } | null = null;

  /** `t` in milliseconds. */
  update(hands: DetectedHand[], t: number): HandFrame {
    const g = HAND_CONFIG.gestures;
    const ts = t / 1000;
    const out: HandFrame = { cursor: this.cursor, mode: this.mode, orbit: { theta: 0, phi: 0 }, zoom: 0, select: false };

    if (!hands.length) {
      if (t - this.lastSeen > g.lostAfterMs) this.reset();
      out.cursor = this.cursor;
      out.mode = this.mode;
      return out;
    }
    this.lastSeen = t;

    // The hand that drives the cursor: the right hand when both are visible (stable choice between frames).
    const primary = hands.find((h) => h.handedness === 'Right') ?? hands[0]!;
    const pose = classifyPose(primary.landmarks, this.pinching);
    this.pinching = pose === 'pinch';

    const twoOpen = hands.length >= 2 && hands.every((h) => classifyPose(h.landmarks, false) !== 'fist');
    const wanted: HandMode = twoOpen ? 'zoom' : pose === 'open' ? 'orbit' : pose;
    if (wanted === this.candidate) this.candidateFrames++;
    else {
      this.candidate = wanted;
      this.candidateFrames = 1;
    }
    const previous = this.mode;
    if (this.candidateFrames >= g.confirmFrames) this.mode = this.candidate;

    // Cursor: the index fingertip (between thumb and index while pinching), mirrored like a selfie.
    const lm = primary.landmarks;
    const tip = this.pinching ? { x: (lm[4]!.x + lm[8]!.x) / 2, y: (lm[4]!.y + lm[8]!.y) / 2 } : lm[8]!;
    const m = HAND_CONFIG.cursorMargin;
    const c = this.cursorFilter.filter(clamp01((1 - tip.x - m) / (1 - 2 * m)), clamp01((tip.y - m) / (1 - 2 * m)), ts);
    // A pinch keeps the cursor where it started, so closing the fingers does not drag it off target.
    if (!(this.mode === 'pinch' && previous === 'pinch')) this.cursor = c;
    out.cursor = this.cursor;

    // Orbit: an open hand moving across the frame.
    const palm = palmCenter(lm);
    const p = this.palmFilter.filter(1 - palm.x, palm.y, ts);
    if (this.mode === 'orbit' && this.lastPalm) {
      const o = HAND_CONFIG.orbit;
      out.orbit.theta = -deadZone(p.x - this.lastPalm.x, o.deadZone) * o.speed;
      out.orbit.phi = -deadZone(p.y - this.lastPalm.y, o.deadZone) * o.speed;
    }
    this.lastPalm = p;

    // Zoom: two hands spreading apart (closer) or coming together (farther).
    if (hands.length >= 2) {
      const a = palmCenter(hands[0]!.landmarks);
      const b = palmCenter(hands[1]!.landmarks);
      const spread = this.spreadFilter.filter(Math.hypot(a.x - b.x, a.y - b.y), ts);
      if (this.mode === 'zoom' && this.lastSpread !== null) {
        out.zoom = deadZone(spread - this.lastSpread, HAND_CONFIG.zoom.deadZone) * HAND_CONFIG.zoom.speed;
      }
      this.lastSpread = spread;
    } else {
      this.lastSpread = null;
      this.spreadFilter.reset();
    }

    // Select once when a pinch is confirmed, then wait for the cooldown.
    if (this.mode === 'pinch' && previous !== 'pinch' && t - this.lastSelect > g.pinchCooldownMs) {
      out.select = true;
      this.lastSelect = t;
    }
    out.mode = this.mode;
    return out;
  }

  reset() {
    this.cursorFilter.reset();
    this.palmFilter.reset();
    this.spreadFilter.reset();
    this.lastPalm = null;
    this.lastSpread = null;
    this.pinching = false;
    this.candidate = 'none';
    this.candidateFrames = 0;
    this.mode = 'none';
    this.cursor = null;
  }
}
