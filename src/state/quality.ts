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

export function initQuality() {
  if (!useQuality.getState().locked) useQuality.setState({ level: detectInitialQuality() });
}
