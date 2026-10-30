# Review — Hand-tracking control

Status: **built; off by default.** Mouse and touch stay the default; hand mode is switched on from the
settings ("Contrôle : Souris | Mains").

## Gestures

| Gesture | Effect |
|---|---|
| Open hand, moving | Orbit the cell |
| Relaxed hand (fingers slightly bent) | Move the cursor without rotating |
| Pinch (thumb + index) | Select the organelle under the cursor |
| Two hands spreading / closing | Zoom in / out |
| Closed fist | Freeze the camera |

A short tutorial opens the first time hand mode is switched on, and again from the "Gestes" button.

## How it works

- **Webcam → worker.** The page captures the webcam at 640×480, downscales each frame to 256×192 on the GPU
  (`createImageBitmap`) and hands it to a Web Worker (`src/hand/hand.worker.ts`) that runs MediaPipe's hand
  landmarker on the CPU. The worker never receives a new frame before answering the previous one, so it can
  never pile up work. Measured: the 3D scene stays at 60 fps with tracking running; tracking is ready in
  about 3–5 s.
- **Gestures** (`src/hand/gestures.ts`): poses from the 21 landmarks (pinch with hysteresis, extended
  fingers for open hand and fist), a few frames of confirmation before a gesture takes effect, dead zones on
  movement and zoom, a cooldown between pinch selections, and a One Euro filter on the cursor, the palm and
  the distance between the hands.
- **Scene**: orbit and zoom feed the camera controller (a framed focus-mode step keeps its camera unless
  freed); the hand cursor hovers and a pinch selects through the same picking as the mouse.
- **Tuning**: every sensitivity, threshold and the detection frame rate live in `src/hand/config.ts`.

## Privacy

All video processing stays in the browser: no image is sent or recorded, and the UI says so (status chip,
tutorial). The only download is the hand-detection model file, fetched once from Google's MediaPipe storage
(`HAND_CONFIG.modelUrl`; point it at a self-hosted copy to avoid any third-party request). The WASM runtime is
served by the app itself (`scripts/copy-mediapipe.mjs` copies it into `public/mediapipe` on install, dev and
build).

## Checked

- Unit tests for the One Euro filter and the gesture interpreter (poses, confirmation, dead zone, one
  selection per pinch, fist).
- Headless Chrome with a fake camera, desktop (1440×900) and phone (390×844): the model loads in the worker,
  the scene keeps 60 fps, the tutorial, status chip, preview and settings toggle do not overlap other UI;
  production build included.
- Not checkable here: real hands in front of a real webcam. See the manual checks below.

## Manual checks

1. Switch to "Mains", allow the camera, follow the tutorial.
2. Open hand: the cell turns; relaxed hand: only the cursor moves; pinch over an organelle: its panel opens.
3. Two hands apart / together: zoom; fist: the camera stays still.
4. If it feels too fast, too slow or jittery, adjust `orbit.speed`, `zoom.speed`, `filter.minCutoff` /
   `filter.beta` and the dead zones in `src/hand/config.ts`.
