/**
 * Hand-tracking control: every tunable value in one place.
 * Hand positions are in normalised image units (0..1 across the webcam frame) unless stated otherwise.
 *
 * Gestures:
 * - right hand open → closed: one eased zoom-in step
 * - left hand open → closed: one eased zoom-out step
 * - the right hand, open and steady, moving: pan the view the same way (with inertia, clamped to the cell)
 * - the left hand, open and steady, moving: rotate the cell on itself (yaw / pitch, pitch clamped)
 */
export const HAND_CONFIG = {
  /** MediaPipe hand landmarker model, fetched once by the browser. No video ever leaves the device. */
  modelUrl: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  /** Where the WASM runtime is served from (copied from node_modules by scripts/copy-mediapipe.mjs). */
  wasmPath: '/mediapipe',

  camera: {
    /** Webcam capture size requested from the browser. */
    width: 640,
    height: 480,
    /** Frames are downscaled to this before detection (bigger = steadier landmarks, slower). */
    analysisWidth: 320,
    analysisHeight: 240,
    /** Detection on the GPU (WebGL in the worker), falling back to the CPU if unavailable. */
    delegate: 'CPU' as 'GPU' | 'CPU',
  },

  detection: {
    numHands: 2,
    minDetectionConfidence: 0.6,
    minPresenceConfidence: 0.6,
    minTrackingConfidence: 0.5,
  },

  handedness: {
    /**
     * MediaPipe labels hands as if the image were a mirrored selfie; we analyse the raw camera image, so its
     * "Left" is your real right hand. `true` corrects that. If left and right still come out reversed on your
     * camera (some webcams mirror their own output), set it to `false`.
     */
    swap: true,
  },

  /**
   * Open / closed hand, from how curled the fingers are. Openness = average, over the four fingers, of
   * (wrist → fingertip) ÷ (wrist → knuckle): about 1.9 for an open hand, about 1.0 for a fist.
   * Two thresholds (hysteresis) so a hand halfway does not flicker between the two.
   */
  curl: {
    /** Above this the hand counts as open… */
    openAbove: 1.6,
    /** …and below this as closed. In between, it keeps its previous state. */
    closedBelow: 1.25,
  },

  zoom: {
    /** Fraction of the camera distance covered by one zoom step (0.3 = 30 % closer). */
    step: 0.3,
    /** Duration of the eased zoom movement, in seconds. */
    easeSeconds: 0.55,
    /** Limits of the camera distance from what it looks at (scene units; the cell is ~200 wide). */
    minDistance: 8,
    maxDistance: 700,
  },

  pan: {
    /** View movement per unit of hand movement across the frame, as a fraction of the camera distance. */
    speed: 1.4,
    /** Hand movement per detection below which nothing happens (tremor). */
    deadZone: 0.003,
    /**
     * The hand must have been open this long (ms) before it pans (or rotates, for the left hand), so opening /
     * closing for zoom never moves the view.
     */
    stableMs: 220,
    /** …and its openness must change slower than this (per second): a hand that is closing does not move it. */
    maxOpennessRate: 1.2,
    /** How long the view keeps gliding after the hand stops (s): higher = more inertia. */
    inertiaSeconds: 0.3,
    /** How quickly the view catches up with the hand (s): lower = snappier. */
    followSeconds: 0.06,
    /** Reverse the direction (moving the hand left then moves the view right, like dragging the cell). */
    invert: false,
    /** The point the camera looks at stays inside the cell, scaled by this (1 = the cell's own size). */
    clampToCell: 0.7,
  },

  rotate: {
    /**
     * Rotation per unit of hand movement across the frame, in radians: 3.2 turns the cell about 180° for a
     * movement across the whole frame.
     */
    speed: 3.2,
    /** Hand movement per detection below which the cell does not turn (tremor). */
    deadZone: 0.003,
    /** How long the cell keeps turning after the hand stops (s): higher = more inertia. */
    inertiaSeconds: 0.35,
    /** How quickly the rotation catches up with the hand (s): lower = snappier. */
    followSeconds: 0.06,
    /**
     * Vertical rotation limit, in degrees above or below the cell's equator as seen by the camera, so the
     * cell never flips upside down.
     */
    maxPitchDegrees: 70,
    /** Reverse the direction (hand to the right then turns the cell's front to the left). */
    invert: false,
  },

  /** One Euro filter (Casiez et al., 2012): low jitter when still, low lag when moving. */
  filter: {
    /** Lower = smoother when the hand is still (more lag). */
    minCutoff: 1.5,
    /** Higher = less lag on fast movements. */
    beta: 12,
    dCutoff: 1,
  },

  /** A hand not seen for longer than this (ms) is forgotten. */
  lostAfterMs: 300,
  /** If the worker has not answered for this long (ms), the next frame is sent anyway. */
  workerTimeoutMs: 1000,
} as const;
