/**
 * Scenario evaluation. A scenario (biological process or disease) is data; its state at time t ∈ [0, 1]
 * is a pure function of t, so scrubbing backwards and forwards always gives the same picture.
 */
import { CHANNELS, type ChannelIdT } from '../channels/registry';

export type EaseName = 'linear' | 'in' | 'out' | 'inOut' | 'step';

export interface Key {
  t: number;
  v: number;
  ease?: EaseName;
}

export interface Track {
  channel: ChannelIdT;
  keys: Key[];
}

export interface Cue {
  at: number;
  until?: number;
}

const EASES: Record<EaseName, (x: number) => number> = {
  linear: (x) => x,
  in: (x) => x * x * x,
  out: (x) => 1 - (1 - x) ** 3,
  inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2),
  step: () => 0,
};

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Value of a keyframed track at t. The ease of a key shapes the segment that ends on it. */
export function sampleTrack(keys: Key[], t: number): number {
  if (!keys.length) return 0;
  const first = keys[0]!;
  if (t <= first.t) return first.v;
  for (let i = 1; i < keys.length; i++) {
    const b = keys[i]!;
    if (t <= b.t) {
      const a = keys[i - 1]!;
      const span = b.t - a.t;
      const x = span > 0 ? (t - a.t) / span : 1;
      return a.v + (b.v - a.v) * EASES[b.ease ?? 'inOut'](x);
    }
  }
  return keys[keys.length - 1]!.v;
}

export type ChannelValues = Record<ChannelIdT, number>;

export function restValues(): ChannelValues {
  const out = {} as ChannelValues;
  for (const id of Object.keys(CHANNELS) as ChannelIdT[]) out[id] = CHANNELS[id].rest;
  return out;
}

/** Every channel at t: tracked channels are sampled (and clamped to their range), others stay at rest. */
export function evaluateChannels(tracks: Track[], t: number, out = restValues()): ChannelValues {
  for (const id of Object.keys(CHANNELS) as ChannelIdT[]) out[id] = CHANNELS[id].rest;
  for (const track of tracks) {
    const [lo, hi] = CHANNELS[track.channel].range;
    out[track.channel] = Math.min(hi, Math.max(lo, sampleTrack(track.keys, t)));
  }
  return out;
}

/** Index of the stage whose range contains t (last stage owns t = 1). */
export function stageIndexAt(stages: { range: [number, number] }[], t: number): number {
  for (let i = 0; i < stages.length; i++) {
    const [a, b] = stages[i]!.range;
    if (t >= a && (t < b || (i === stages.length - 1 && t <= b))) return i;
  }
  return t < (stages[0]?.range[0] ?? 0) ? 0 : stages.length - 1;
}

/** The most recent cue that has started at t (narration lines, camera moves). */
export function latestCue<C extends Cue>(cues: C[], t: number): C | undefined {
  let best: C | undefined;
  for (const c of cues) if (c.at <= t && (!best || c.at >= best.at)) best = c;
  return best;
}

/** Cues running at t with their local progress in [0, 1] (actors). A cue without `until` lasts to the end. */
export function activeCues<C extends Cue>(cues: C[], t: number): { cue: C; progress: number }[] {
  const out: { cue: C; progress: number }[] = [];
  for (const cue of cues) {
    const end = cue.until ?? 1;
    if (t >= cue.at && t <= end) out.push({ cue, progress: end > cue.at ? (t - cue.at) / (end - cue.at) : 1 });
  }
  return out;
}
