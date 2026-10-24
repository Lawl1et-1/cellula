import { create } from 'zustand';

export type CameraMode = 'intro' | 'orbit' | 'flight';
export type ScaleMode = 'artistic' | 'real';

interface SceneState {
  cameraMode: CameraMode;
  scaleMode: ScaleMode;
  /** Set when the user starts interacting; drives idle auto-rotation. */
  lastInteraction: number;
  /** True once the first frames are on screen (shaders compiled). */
  ready: boolean;
  /** Ambient motion: 'normal', 'reduced' (prefers-reduced-motion) or 'paused' (WCAG 2.2.2). */
  motion: 'normal' | 'reduced' | 'paused';
  setMotion: (motion: 'normal' | 'reduced' | 'paused') => void;
  setCameraMode: (mode: CameraMode) => void;
  setScaleMode: (mode: ScaleMode) => void;
  touch: () => void;
}

export const useScene = create<SceneState>((set) => ({
  cameraMode: 'intro',
  scaleMode: 'artistic',
  lastInteraction: 0,
  ready: false,
  motion:
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'reduced' : 'normal',
  setMotion: (motion) => set({ motion }),
  setCameraMode: (cameraMode) => set({ cameraMode, lastInteraction: performance.now() }),
  setScaleMode: (scaleMode) => set({ scaleMode }),
  touch: () => set({ lastInteraction: performance.now() }),
}));
