import { create } from 'zustand';
import type { Disease, Process } from '@/content/schema';

/** Anything that plays on the timeline: a biological process or a disease. */
export type Scenario = ({ kind: 'process' } & Process) | ({ kind: 'disease' } & Disease);

interface ScenarioState {
  scenario: Scenario | null;
  /** Normalised time in [0, 1]. */
  t: number;
  playing: boolean;
  speed: number;
  start: (s: Scenario) => void;
  stop: () => void;
  setT: (t: number) => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: number) => void;
}

export const useScenario = create<ScenarioState>((set) => ({
  scenario: null,
  t: 0,
  playing: false,
  speed: 1,
  start: (scenario) => set({ scenario, t: 0, playing: true }),
  stop: () => set({ scenario: null, t: 0, playing: false }),
  setT: (t) => set({ t: Math.min(1, Math.max(0, t)) }),
  setPlaying: (playing) => set((s) => ({ playing, t: playing && s.t >= 1 ? 0 : s.t })),
  setSpeed: (speed) => set({ speed }),
}));
