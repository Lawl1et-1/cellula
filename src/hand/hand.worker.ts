/// <reference lib="webworker" />
/**
 * Hand detection off the main thread: the page sends small webcam frames (ImageBitmap), the worker runs
 * MediaPipe's hand landmarker on the CPU and sends back the landmarks. Frames never leave the browser.
 */
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

type InitMessage = {
  type: 'init';
  wasmPath: string;
  modelUrl: string;
  numHands: number;
  minDetectionConfidence: number;
  minPresenceConfidence: number;
  minTrackingConfidence: number;
};
type FrameMessage = { type: 'frame'; bitmap: ImageBitmap; t: number };

let landmarker: HandLandmarker | null = null;
let lastT = 0;

self.onmessage = async (e: MessageEvent<InitMessage | FrameMessage>) => {
  const msg = e.data;
  if (msg.type === 'init') {
    try {
      // `true`: the ES-module build of the runtime, which loads inside a module worker.
      const fileset = await FilesetResolver.forVisionTasks(msg.wasmPath, true);
      landmarker = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: msg.modelUrl, delegate: 'CPU' },
        runningMode: 'VIDEO',
        numHands: msg.numHands,
        minHandDetectionConfidence: msg.minDetectionConfidence,
        minHandPresenceConfidence: msg.minPresenceConfidence,
        minTrackingConfidence: msg.minTrackingConfidence,
      });
      postMessage({ type: 'ready' });
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
      const t = Math.max(msg.t, lastT + 1);
      lastT = t;
      const r = landmarker.detectForVideo(bitmap, t);
      const hands = r.landmarks.map((points, i) => ({
        landmarks: points.map((p) => ({ x: p.x, y: p.y, z: p.z })),
        handedness: r.handedness[i]?.[0]?.categoryName === 'Left' ? 'Left' : 'Right',
      }));
      postMessage({ type: 'result', hands, t: msg.t });
    } catch (err) {
      postMessage({ type: 'result', hands: [], t: msg.t, warning: err instanceof Error ? err.message : String(err) });
    } finally {
      bitmap.close();
    }
  }
};
