import { HAND_CONFIG } from './config';
import { handBridge, resetBridge } from './bridge';
import { HandInterpreter, type DetectedHand } from './gestures';
import type { HandError } from './store';

/**
 * Starts the webcam and the detection worker. Frames are downscaled on the GPU (createImageBitmap) and the
 * worker never receives a new frame before it has answered the previous one, so the 3D scene keeps its
 * frame rate. Everything stays in the browser. Returns a function that stops it all.
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

  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.srcObject = stream;
  await video.play().catch(() => {});

  const worker = new Worker(new URL('./hand.worker.ts', import.meta.url), { type: 'module' });
  const interpreter = new HandInterpreter();
  let stopped = false;
  let busy = true; // until the model is ready
  let timer = 0;
  let count = 0;
  let since = performance.now();

  worker.onmessage = (e: MessageEvent) => {
    const msg = e.data as { type: string; hands?: DetectedHand[]; message?: string };
    if (stopped) return;
    if (msg.type === 'ready') {
      busy = false;
      handBridge.active = true;
      handBridge.video = video;
      callbacks.onReady();
    } else if (msg.type === 'error') {
      console.warn('Hand tracking failed to start:', msg.message);
      callbacks.onError('failed');
    } else if (msg.type === 'result') {
      busy = false;
      const hands = msg.hands ?? [];
      const frame = interpreter.update(hands, performance.now());
      handBridge.hands = hands;
      handBridge.mode = frame.mode;
      handBridge.cursor = frame.cursor ? { x: frame.cursor.x * window.innerWidth, y: frame.cursor.y * window.innerHeight } : null;
      handBridge.orbit.theta += frame.orbit.theta;
      handBridge.orbit.phi += frame.orbit.phi;
      handBridge.zoom += frame.zoom;
      if (frame.select) handBridge.selectSeq++;
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
    ...HAND_CONFIG.detection,
  });

  const tick = async () => {
    if (stopped) return;
    if (!busy && video.readyState >= 2 && !document.hidden) {
      busy = true;
      try {
        const bitmap = await createImageBitmap(video, {
          resizeWidth: cam.analysisWidth,
          resizeHeight: cam.analysisHeight,
          resizeQuality: 'low',
        });
        if (stopped) bitmap.close();
        else worker.postMessage({ type: 'frame', bitmap, t: performance.now() }, [bitmap]);
      } catch {
        busy = false;
      }
    }
  };
  timer = window.setInterval(tick, 1000 / cam.maxFps);

  return () => {
    stopped = true;
    window.clearInterval(timer);
    worker.terminate();
    stream.getTracks().forEach((t) => t.stop());
    video.srcObject = null;
    resetBridge();
  };
}
