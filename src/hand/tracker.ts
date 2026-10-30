import { HAND_CONFIG } from './config';
import { handBridge, resetBridge } from './bridge';
import { GestureEngine, type DetectedHand } from './gestures';
import type { HandError } from './store';

type VideoWithFrames = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: () => void) => number;
  cancelVideoFrameCallback?: (id: number) => void;
};

/**
 * Starts the webcam and the detection worker. Each new camera frame (not a timer) is downscaled on the GPU
 * (createImageBitmap) and sent to the worker, which never has more than one frame in hand, so detection can
 * never fall behind and the 3D scene keeps its frame rate. Everything stays in the browser.
 * Returns a function that stops it all.
 */
export async function startHandTracking(callbacks: {
  onReady: () => void;
  onError: (error: Exclude<HandError, null>) => void;
}): Promise<() => void> {
  const cam = HAND_CONFIG.camera;
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: cam.width }, height: { ideal: cam.height }, facingMode: 'user' },
      audio: false,
    });
  } catch (err) {
    const name = err instanceof DOMException ? err.name : '';
    callbacks.onError(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unsupported');
    return () => {};
  }

  const video = document.createElement('video') as VideoWithFrames;
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play().catch(() => {});

  const worker = new Worker(new URL('./hand.worker.ts', import.meta.url), { type: 'module' });
  const engine = new GestureEngine();
  let stopped = false;
  let ready = false;
  let busySince = 0; // 0 = idle
  // A camera frame arrived that has not been analysed yet (sent as soon as the worker is free).
  let pending = false;
  let count = 0;
  let since = performance.now();
  let frameRequest = 0;
  let fallbackTimer = 0;

  worker.onmessage = (e: MessageEvent) => {
    const msg = e.data as { type: string; hands?: DetectedHand[]; t?: number; ms?: number; message?: string; backend?: 'GPU' | 'CPU' };
    if (stopped) return;
    if (msg.type === 'ready') {
      ready = true;
      handBridge.active = true;
      handBridge.video = video;
      handBridge.backend = msg.backend ?? '';
      // Development only: lets automated checks inspect detection and inject gestures.
      if (process.env.NODE_ENV !== 'production') (window as unknown as { __cellulaHand: typeof handBridge }).__cellulaHand = handBridge;
      callbacks.onReady();
      schedule();
    } else if (msg.type === 'error') {
      console.warn('Hand tracking failed to start:', msg.message);
      callbacks.onError('failed');
    } else if (msg.type === 'result') {
      busySince = 0;
      // Do not wait for the next camera frame: analyse the newest one right away.
      if (pending) void send();
      const hands = msg.hands ?? [];
      // The capture time of the frame, not the arrival time: the filters need the real interval.
      const frame = engine.update(hands, msg.t ?? performance.now());
      handBridge.raw = hands;
      handBridge.hands = frame.hands;
      if (frame.zoom) {
        handBridge.zoomSteps += frame.zoom;
        handBridge.lastZoom = { dir: Math.sign(frame.zoom), at: performance.now() };
      }
      handBridge.panning = !!frame.pan;
      handBridge.panHand = frame.panHand;
      handBridge.pan = frame.pan ?? { x: 0, y: 0 };
      handBridge.updatedAt = performance.now();
      if (msg.ms !== undefined) handBridge.detectMs += (msg.ms - handBridge.detectMs) * 0.2;
      count++;
      const now = performance.now();
      if (now - since > 1000) {
        handBridge.fps = Math.round((count * 1000) / (now - since));
        count = 0;
        since = now;
      }
    }
  };
  worker.onerror = (e) => {
    console.warn('Hand tracking worker error:', e.message);
    if (!stopped) callbacks.onError('failed');
  };
  worker.postMessage({
    type: 'init',
    wasmPath: new URL(HAND_CONFIG.wasmPath, window.location.href).href,
    modelUrl: HAND_CONFIG.modelUrl,
    delegate: cam.delegate,
    ...HAND_CONFIG.detection,
  });

  /** Sends the current camera frame if the worker is free (or has not answered for too long). */
  const send = async () => {
    const now = performance.now();
    const free = busySince === 0 || now - busySince > HAND_CONFIG.workerTimeoutMs;
    if (!ready || !free || video.readyState < 2 || document.hidden) return;
    busySince = now;
    pending = false;
    try {
      const bitmap = await createImageBitmap(video, {
        resizeWidth: cam.analysisWidth,
        resizeHeight: cam.analysisHeight,
        resizeQuality: 'medium',
      });
      if (stopped) bitmap.close();
      else worker.postMessage({ type: 'frame', bitmap, t: now }, [bitmap]);
    } catch {
      busySince = 0;
    }
  };

  /** One detection attempt per new camera frame when the browser supports it, otherwise ~30 times a second. */
  function schedule() {
    if (stopped) return;
    if (video.requestVideoFrameCallback) {
      frameRequest = video.requestVideoFrameCallback(() => {
        pending = true;
        void send();
        schedule();
      });
    } else {
      fallbackTimer = window.setTimeout(() => {
        pending = true;
        void send();
        schedule();
      }, 33);
    }
  }

  return () => {
    stopped = true;
    if (frameRequest) video.cancelVideoFrameCallback?.(frameRequest);
    window.clearTimeout(fallbackTimer);
    worker.terminate();
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
    resetBridge();
  };
}
