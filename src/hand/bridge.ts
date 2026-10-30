import type { DetectedHand, HandReport, HandSide } from './gestures';

/**
 * Hand input shared with the 3D scene and the overlays, updated after each detection and read every frame.
 * Plain mutable data (no React state): nothing re-renders at tracking rate.
 */
export const handBridge = {
  active: false,
  /** What each of the user's hands is doing (null when not seen). */
  hands: { left: null, right: null } as Record<HandSide, HandReport | null>,
  /** Zoom steps waiting for the camera (+ in, − out). */
  zoomSteps: 0,
  /** Last zoom step, for the on-screen feedback. */
  lastZoom: { dir: 0, at: 0 },
  /** Pan velocity wanted by the hand, in frame widths per second (zero when not panning). */
  pan: { x: 0, y: 0 },
  panning: false,
  panHand: null as HandSide | null,
  /** When the last detection arrived (performance.now()). */
  updatedAt: 0,
  /** Latest raw detections (webcam preview). */
  raw: [] as DetectedHand[],
  /** The live webcam stream (webcam preview). */
  video: null as HTMLVideoElement | null,
  /** Detections per second actually achieved, and the backend in use. */
  fps: 0,
  backend: '' as '' | 'GPU' | 'CPU',
};

export function resetBridge() {
  handBridge.active = false;
  handBridge.hands = { left: null, right: null };
  handBridge.zoomSteps = 0;
  handBridge.lastZoom = { dir: 0, at: 0 };
  handBridge.pan = { x: 0, y: 0 };
  handBridge.panning = false;
  handBridge.panHand = null;
  handBridge.updatedAt = 0;
  handBridge.raw = [];
  handBridge.video = null;
  handBridge.fps = 0;
  handBridge.backend = '';
}
