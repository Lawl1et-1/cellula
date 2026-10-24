import { create } from 'zustand';
import type { Tour } from '@/content/schema';

interface TourState {
  tour: Tour | null;
  step: number;
  playing: boolean;
  start: (tour: Tour) => void;
  stop: () => void;
  go: (step: number) => void;
  setPlaying: (playing: boolean) => void;
}

export const useTour = create<TourState>((set, get) => ({
  tour: null,
  step: 0,
  playing: false,
  start: (tour) => set({ tour, step: 0, playing: true }),
  stop: () => set({ tour: null, step: 0, playing: false }),
  go: (step) => {
    const tour = get().tour;
    if (!tour) return;
    if (step >= tour.steps.length) set({ tour: null, step: 0, playing: false });
    else set({ step: Math.max(0, step) });
  },
  setPlaying: (playing) => set({ playing }),
}));
