import { create } from 'zustand';
import { QUALITY_PRESETS, detectInitialQuality, type QualityLevel } from '@/engine/quality/presets';

interface QualityState {
  level: QualityLevel;
  /** True once the user picked a level by hand: the adaptive monitor then stops changing it. */
  locked: boolean;
  setLevel: (level: QualityLevel, byUser?: boolean) => void;
}

export const useQuality = create<QualityState>((set) => ({
  level: 'high',
  locked: false,
  setLevel: (level, byUser = false) => set((s) => ({ level, locked: s.locked || byUser })),
}));

export const usePreset = () => QUALITY_PRESETS[useQuality((s) => s.level)];

const LEVELS = Object.keys(QUALITY_PRESETS) as QualityLevel[];

/** `?q=low|medium|high|ultra` forces a level (profiling, sharing); otherwise guess from the GPU. */
export function initQuality() {
  const forced = new URLSearchParams(window.location.search).get('q') as QualityLevel | null;
  if (forced && LEVELS.includes(forced)) useQuality.getState().setLevel(forced, true);
  else if (!useQuality.getState().locked) useQuality.setState({ level: detectInitialQuality() });
}
