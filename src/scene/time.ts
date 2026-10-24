import { useScene } from '@/state/scene';

const SCALE = { normal: 1, reduced: 0.2, paused: 0 } as const;

/** Multiplier for ambient motion (drift, streaming, motors, bacteria, idle camera). */
export const timeScale = () => SCALE[useScene.getState().motion];
