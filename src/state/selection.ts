import { create } from 'zustand';
import type { OrganelleId } from '@/content/schema/common';
import type { FocusKey } from '@/content/schema/scenario';

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
  /** Direction to look from (camera side), instead of keeping the current viewing direction. */
  from?: [number, number, number];
}

interface SelectionState {
  hovered: Target | null;
  selected: Focus | null;
  /** Camera target without opening the info panel (processes, guided tour). */
  framing: Focus | null;
  /** Organelle lit up by a process or the tour. */
  spotlight: OrganelleId | null;
  /** Focus mode: everything a scenario step involves (kept in colour while the rest is ghosted). */
  focusKeys: FocusKey[];
  setFocusKeys: (keys: FocusKey[]) => void;
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
  focusKeys: [],
  setFocusKeys: (focusKeys) => set({ focusKeys }),
  hover: (t) => {
    if (!same(get().hovered, t)) set({ hovered: t });
  },
  select: (selected) => set({ selected }),
  frame: (framing, spotlight = framing?.organelle ?? null) => set({ framing, spotlight }),
}));
