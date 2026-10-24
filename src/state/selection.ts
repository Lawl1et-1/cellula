import { create } from 'zustand';
import type { OrganelleId } from '@/content/schema/common';

export interface Target {
  organelle: OrganelleId;
  /** Index of the instance for instanced organelles (mitochondria, lysosomes…). */
  instance?: number;
}

export interface Focus extends Target {
  position: [number, number, number];
  /** Approximate radius, used to frame the camera. */
  radius: number;
  /** Long axis of elongated organelles: the camera frames them side-on. */
  axis?: [number, number, number];
}

interface SelectionState {
  hovered: Target | null;
  selected: Focus | null;
  /** Camera target without opening the info panel (processes, guided tour). */
  framing: Focus | null;
  /** Organelle lit up by a process or the tour. */
  spotlight: OrganelleId | null;
  hover: (t: Target | null) => void;
  select: (f: Focus | null) => void;
  frame: (f: Focus | null, spotlight?: OrganelleId | null) => void;
}

const same = (a: Target | null, b: Target | null) =>
  a?.organelle === b?.organelle && a?.instance === b?.instance;

export const useSelection = create<SelectionState>((set, get) => ({
  hovered: null,
  selected: null,
  framing: null,
  spotlight: null,
  hover: (t) => {
    if (!same(get().hovered, t)) set({ hovered: t });
  },
  select: (selected) => set({ selected }),
  frame: (framing, spotlight = framing?.organelle ?? null) => set({ framing, spotlight }),
}));
