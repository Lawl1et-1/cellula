/**
 * Hand-tracking control: every tunable value in one place.
 * Positions are in normalised image units (0..1 across the webcam frame) unless stated otherwise.
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
    /** Frames are downscaled to this before detection: small = fast. */
    analysisWidth: 256,
    analysisHeight: 192,
    /** Upper bound on detections per second (the worker also never gets more than one frame at a time). */
    maxFps: 30,
  },

  detection: {
    numHands: 2,
    minDetectionConfidence: 0.6,
    minPresenceConfidence: 0.6,
    minTrackingConfidence: 0.5,
  },

  /** One Euro filter (Casiez et al., 2012): low jitter when still, low lag when moving. */
  filter: {
    /** Lower = smoother when the hand is still (more lag). */
    minCutoff: 1.2,
    /** Higher = less lag on fast movements. */
    beta: 8,
    dCutoff: 1,
  },

  /** Part of the webcam frame mapped to the whole screen (a margin makes the edges reachable). */
  cursorMargin: 0.15,

  orbit: {
    /** Radians of camera rotation per unit of hand movement across the frame. */
    speed: 4.2,
    /** Movement per frame below which the hand is considered still (jitter). */
    deadZone: 0.0035,
  },

  zoom: {
    /** Fraction of the camera distance travelled per unit of change in the distance between the two hands. */
    speed: 2.6,
    /** Change in hand distance per frame below which nothing happens. */
    deadZone: 0.004,
  },

  gestures: {
    /** Thumb–index distance, relative to the hand size, that starts a pinch… */
    pinchOn: 0.32,
    /** …and the larger distance that ends it (hysteresis: no flicker at the threshold). */
    pinchOff: 0.48,
    /** A finger counts as extended when its tip is this much farther from the wrist than its middle joint. */
    extendedRatio: 1.12,
    /** Frames a new gesture must persist before it takes effect (false triggers). */
    confirmFrames: 3,
    /** Minimum time between two selections by pinching, in ms. */
    pinchCooldownMs: 700,
    /** Hands lost for longer than this (ms) are forgotten. */
    lostAfterMs: 400,
  },
} as const;
