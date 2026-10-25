import { create } from 'zustand';
import type { Disease, Process } from '@/content/schema';
import { stageIndexAt } from '@/engine/timeline/evaluate';

/** Anything that plays on the timeline: a biological process or a disease. */
export type Scenario = ({ kind: 'process' } & Process) | ({ kind: 'disease' } & Disease);

/** Just inside a stage, so that the stage index is unambiguous at its boundaries. */
const EPS = 1e-4;

interface ScenarioState {
  scenario: Scenario | null;
  /** Normalised time in [0, 1]; each stage owns its own range of it. */
  t: number;
  playing: boolean;
  speed: number;
  /** Chain the steps without waiting for "Next". */
  autoplay: boolean;
  start: (s: Scenario) => void;
  stop: () => void;
  setT: (t: number) => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: number) => void;
  setAutoplay: (autoplay: boolean) => void;
  /** Focus mode: jump to the start of a step and play it. */
  goToStep: (index: number) => void;
}

export const useScenario = create<ScenarioState>((set, get) => ({
  scenario: null,
  t: 0,
  playing: false,
  speed: 1,
  autoplay: false,
  start: (scenario) => set({ scenario, t: 0, playing: true }),
  stop: () => set({ scenario: null, t: 0, playing: false }),
  setT: (t) => set({ t: Math.min(1, Math.max(0, t)) }),
  setPlaying: (playing) =>
    set((s) => {
      if (!playing || !s.scenario) return { playing };
      // Play at the end of a step replays that step.
      const stages = s.scenario.stages;
      const i = stageIndexAt(stages, s.t);
      const [a, b] = stages[i]!.range;
      const atEnd = s.t >= b - 2 * EPS || s.t >= 1;
      return { playing, t: atEnd ? a + EPS : s.t };
    }),
  setSpeed: (speed) => set({ speed }),
  setAutoplay: (autoplay) => set({ autoplay }),
  goToStep: (index) => {
    const stages = get().scenario?.stages;
    const stage = stages?.[Math.max(0, Math.min(stages.length - 1, index))];
    if (stage) set({ t: stage.range[0] + EPS, playing: true });
  },
}));

export const STEP_EPSILON = EPS;
