/// <reference lib="webworker" />
/**
 * Hand detection off the main thread: the page sends webcam frames (ImageBitmap), the worker runs MediaPipe's
 * hand landmarker (on the GPU when possible, otherwise the CPU) and sends back the landmarks. Frames never
 * leave the browser.
 */
import { FilesetResolver, HandLandmarker, type HandLandmarkerOptions } from '@mediapipe/tasks-vision';

type InitMessage = {
  type: 'init';
  wasmPath: string;
  modelUrl: string;
  delegate: 'GPU' | 'CPU';
  numHands: number;
  minDetectionConfidence: number;
  minPresenceConfidence: number;
  minTrackingConfidence: number;
};
type FrameMessage = { type: 'frame'; bitmap: ImageBitmap; t: number };

let landmarker: HandLandmarker | null = null;
let lastT = 0;

/** `importScripts` exists in both kinds of worker but only works in classic ones. */
function isModuleWorker() {
  try {
    importScripts();
    return false;
  } catch {
    return true;
  }
}

async function create(msg: InitMessage, delegate: 'GPU' | 'CPU') {
  // The bundler may emit a classic or a module worker: pick the runtime build that loads in this one.
  const fileset = await FilesetResolver.forVisionTasks(msg.wasmPath, isModuleWorker());
  const options: HandLandmarkerOptions = {
    baseOptions: { modelAssetPath: msg.modelUrl, delegate },
    runningMode: 'VIDEO',
    numHands: msg.numHands,
    minHandDetectionConfidence: msg.minDetectionConfidence,
    minHandPresenceConfidence: msg.minPresenceConfidence,
    minTrackingConfidence: msg.minTrackingConfidence,
  };
  // The GPU backend needs a WebGL context; a worker has no DOM, so it gets an offscreen canvas.
  if (delegate === 'GPU') options.canvas = new OffscreenCanvas(1, 1);
  return HandLandmarker.createFromOptions(fileset, options);
}

self.onmessage = async (e: MessageEvent<InitMessage | FrameMessage>) => {
  const msg = e.data;
  if (msg.type === 'init') {
    let backend: 'GPU' | 'CPU' = msg.delegate;
    try {
      try {
        landmarker = await create(msg, backend);
      } catch (err) {
        if (backend !== 'GPU') throw err;
        backend = 'CPU';
        landmarker = await create(msg, backend);
      }
      postMessage({ type: 'ready', backend });
    } catch (err) {
      postMessage({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    }
    return;
  }
  if (msg.type === 'frame') {
    const { bitmap } = msg;
    try {
      if (!landmarker) return;
      // Timestamps must increase strictly.
      const t = Math.max(Math.round(msg.t), lastT + 1);
      lastT = t;
      const r = landmarker.detectForVideo(bitmap, t);
      const hands = r.landmarks.map((points, i) => ({
        landmarks: points.map((p) => ({ x: p.x, y: p.y, z: p.z })),
        label: r.handedness[i]?.[0]?.categoryName === 'Left' ? 'Left' : 'Right',
      }));
      postMessage({ type: 'result', hands, t: msg.t });
    } catch (err) {
      postMessage({ type: 'result', hands: [], t: msg.t, warning: err instanceof Error ? err.message : String(err) });
    } finally {
      bitmap.close();
    }
  }
};
