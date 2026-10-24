import { describe, expect, it } from 'vitest';
import {
  activeCues,
  evaluateChannels,
  latestCue,
  sampleTrack,
  stageIndexAt,
} from '@/engine/timeline/evaluate';
import { CHANNELS } from '@/engine/channels/registry';

describe('timeline', () => {
  it('holds the first and last key outside the keyed range', () => {
    const keys = [
      { t: 0.2, v: 1 },
      { t: 0.8, v: 3 },
    ];
    expect(sampleTrack(keys, 0)).toBe(1);
    expect(sampleTrack(keys, 1)).toBe(3);
  });

  it('interpolates linearly and with easing', () => {
    expect(sampleTrack([{ t: 0, v: 0 }, { t: 1, v: 10, ease: 'linear' }], 0.25)).toBeCloseTo(2.5);
    const eased = sampleTrack([{ t: 0, v: 0 }, { t: 1, v: 10, ease: 'inOut' }], 0.25);
    expect(eased).toBeLessThan(2.5);
    expect(sampleTrack([{ t: 0, v: 0 }, { t: 1, v: 10, ease: 'inOut' }], 0.5)).toBeCloseTo(5);
  });

  it('is a pure function of t (scrubbing back gives the same value)', () => {
    const keys = [
      { t: 0, v: 0 },
      { t: 0.5, v: 1 },
      { t: 1, v: 0 },
    ];
    const forward = [0.1, 0.4, 0.9].map((t) => sampleTrack(keys, t));
    const backward = [0.9, 0.4, 0.1].map((t) => sampleTrack(keys, t)).reverse();
    expect(forward).toEqual(backward);
  });

  it('leaves untracked channels at rest and clamps tracked ones to their range', () => {
    const v = evaluateChannels([{ channel: 'er.stress', keys: [{ t: 0, v: 5 }] }], 0.5);
    expect(v['er.stress']).toBe(1);
    expect(v['cell.viability']).toBe(CHANNELS['cell.viability'].rest);
  });

  it('finds the stage, latest cue and active cues at t', () => {
    const stages = [{ range: [0, 0.5] as [number, number] }, { range: [0.5, 1] as [number, number] }];
    expect(stageIndexAt(stages, 0.2)).toBe(0);
    expect(stageIndexAt(stages, 0.5)).toBe(1);
    expect(stageIndexAt(stages, 1)).toBe(1);

    const cues = [{ at: 0 }, { at: 0.3 }, { at: 0.7 }];
    expect(latestCue(cues, 0.5)?.at).toBe(0.3);

    const actors = [{ at: 0.2, until: 0.6 }, { at: 0.5 }];
    const active = activeCues(actors, 0.4);
    expect(active).toHaveLength(1);
    expect(active[0]!.progress).toBeCloseTo(0.5);
  });
});
