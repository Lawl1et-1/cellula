import type { DetectedHand, HandMode } from './gestures';

/**
 * Hand input shared with the 3D scene and the overlays, updated by the tracker ~30 times a second and read
 * every frame. Plain mutable data (no React state): nothing re-renders at tracking rate.
 */
export const handBridge = {
  active: false,
  /** Cursor on screen in pixels (null when no hand is seen). */
  cursor: null as { x: number; y: number } | null,
  mode: 'none' as HandMode,
  /** Camera moves accumulated since the scene last consumed them. */
  orbit: { theta: 0, phi: 0 },
  zoom: 0,
  /** Increases on every pinch-to-select. */
  selectSeq: 0,
  /** Latest raw detections (for the webcam preview). */
  hands: [] as DetectedHand[],
  /** The live webcam stream (for the preview). */
  video: null as HTMLVideoElement | null,
  /** Detections per second actually achieved. */
  fps: 0,
};

export function resetBridge() {
  handBridge.active = false;
  handBridge.cursor = null;
  handBridge.mode = 'none';
  handBridge.orbit.theta = handBridge.orbit.phi = 0;
  handBridge.zoom = 0;
  handBridge.hands = [];
  handBridge.video = null;
  handBridge.fps = 0;
}
