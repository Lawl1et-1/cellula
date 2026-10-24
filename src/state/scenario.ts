import { create } from 'zustand';
import type { Process } from '@/content/schema';

interface ScenarioState {
  process: Process | null;
  /** Normalised time in [0, 1]. */
  t: number;
  playing: boolean;
  speed: number;
  start: (p: Process) => void;
  stop: () => void;
  setT: (t: number) => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: number) => void;
}

export const useScenario = create<ScenarioState>((set) => ({
  process: null,
  t: 0,
  playing: false,
  speed: 1,
  start: (process) => set({ process, t: 0, playing: true }),
  stop: () => set({ process: null, t: 0, playing: false }),
  setT: (t) => set({ t: Math.min(1, Math.max(0, t)) }),
  setPlaying: (playing) => set((s) => ({ playing, t: playing && s.t >= 1 ? 0 : s.t })),
  setSpeed: (speed) => set({ speed }),
}));
