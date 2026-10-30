# Review — Hand-tracking control

Status: **reworked; off by default.** Mouse and touch stay the default; hand mode is switched on from the
settings ("Contrôle : Souris | Mains").

## Gestures

| Gesture | Effect |
|---|---|
| Right hand: open, then close | One eased zoom-in step |
| Left hand: open, then close | One eased zoom-out step |
| Right hand, open and steady, moving | Pan the view the same way (with inertia), clamped to the cell |
| Left hand, open and steady, moving | Rotate the cell on itself: left/right = yaw, up/down = pitch (clamped, never upside down) |

- A zoom step needs a full open → closed cycle: keeping the fist closed does nothing more.
- Open / closed comes from finger curl with two thresholds (hysteresis), so a half-closed hand does not
  flicker.
- Panning and rotating only happen once the hand has been open for a moment and is not changing shape, so
  opening and closing for zoom never moves the view.
- Both hands can act at once: the right hand pans while the left rotates.
- Rotation turns the camera and the point it looks at together around the cell's centre: on screen the cell
  spins in place and any pan offset is kept. Zoom steps, pan and rotation are all applied frame by frame, so
  they combine without cancelling each other.
- Left and right are the user's real hands: MediaPipe labels hands as if the image were mirrored and we
  analyse the raw camera image, so its labels are swapped (`handedness.swap` in the config can undo that).

On screen: an **L / R** (FR **G / D**) badge per hand shows whether it is detected and open, closed or half;
the actions next to it show *panning* (right hand, blue), *rotating* (left hand, violet), *zoom in* or
*zoom out*; a large magnifier flashes in the middle of
the screen on each zoom step. The status chip also shows the detection rate.

The old gestures (open hand to orbit, pinch to select, two hands to zoom, fist to freeze) and the hand
cursor were removed: they conflicted with the new mapping. Orbiting and selecting stay on the mouse / touch.

## Pipeline fixes (audit)

| Problem | Fix |
|---|---|
| Left and right hands reversed | Labels corrected for the unmirrored image, with a config switch |
| Slow detection (~7/s): frames polled on a timer, worker idle until the next tick | One detection per new camera frame (`requestVideoFrameCallback`), and the newest frame is sent as soon as the worker answers: ~15/s while searching for hands, faster once a hand is tracked |
| Tiny analysis frames (256×192): jittery landmarks | 320×240 |
| Filters timed on result arrival, not capture | Capture time passed through the worker |
| Double smoothing (One Euro + the camera's 0.45 s easing) made moves lag | Pan applied directly each frame with its own short follow / inertia; zoom steps keep a deliberate ease |
| A lost worker answer could stall detection forever | Watchdog (`workerTimeoutMs`) |
| Several gestures fighting over the same hand | Single, separated mapping (above) |

GPU detection is available (`camera.delegate: 'GPU'`) but off: in a worker it competes with the 3D scene
for the GPU, and in testing it stalled the scene. The CPU path keeps the scene at 60 fps.

## Tuning (`src/hand/config.ts`)

| Feels… | Change |
|---|---|
| Zoom steps too big / small | `zoom.step` (fraction of the distance per step) |
| Zoom too abrupt / slow | `zoom.easeSeconds` |
| Fist not recognised | raise `curl.closedBelow` (e.g. 1.35) |
| Open hand not recognised | lower `curl.openAbove` (e.g. 1.5) |
| Flickers between open and closed | widen the gap between `openAbove` and `closedBelow` |
| Pan too fast / slow | `pan.speed` |
| Pans on small tremors | raise `pan.deadZone` |
| Pans when opening or closing the hand | raise `pan.stableMs`, lower `pan.maxOpennessRate` |
| Too much / too little glide after stopping | `pan.inertiaSeconds` |
| Pan direction feels backwards | `pan.invert: true` (drag-the-cell feel) |
| Rotation too fast / slow | `rotate.speed` (3.2 ≈ half a turn across the frame) |
| Rotates on small tremors | raise `rotate.deadZone` |
| Too much / too little spin after stopping | `rotate.inertiaSeconds` |
| Vertical rotation too limited / too free | `rotate.maxPitchDegrees` |
| Rotation direction feels backwards | `rotate.invert: true` |
| Left / right reversed | `handedness.swap` |
| Jittery | lower `filter.minCutoff` (smoother) — laggy: raise `filter.beta` |
| Cell lost too easily / exploration too limited | `pan.clampToCell` |

## Privacy

All video processing stays in the browser: no image is sent or recorded, and the UI says so (status chip,
tutorial). The only download is the hand-detection model file, fetched once from Google's MediaPipe storage
(`modelUrl`; point it at a self-hosted copy to avoid any third-party request). The WASM runtime is served by
the app itself (`scripts/copy-mediapipe.mjs`).

## Checked

- 17 unit tests on the gesture engine (rotation: left hand rotates and never pans, right hand pans and never
  rotates, both at once, closing the left hand zooms out without rotating); openness, side mapping and swap, same-label hands, one zoom step per
  cycle (none while the fist stays closed, none for a hand that starts closed), hysteresis, pan direction
  (right, up), dead zone, no pan while closing or just after opening.
- Headless Chrome with a fake camera, desktop and phone: detection rate, 60 fps scene, zoom step (eased, with
  the flash), pan direction, clamp after a long pan, status chip and tutorial layout.
- Not checkable here: real hands in front of a real webcam.
