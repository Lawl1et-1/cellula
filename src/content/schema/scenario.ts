import { z } from 'zod';
import { Claim, LocalizedText, OrganelleId } from './common';
import { CHANNEL_IDS } from '@/engine/channels/registry';

export const ChannelId = z.enum(CHANNEL_IDS);

export const Ease = z.enum(['linear', 'in', 'out', 'inOut', 'step']);

export const ChannelTrack = z.object({
  channel: ChannelId,
  keys: z
    .array(z.object({ t: z.number().min(0).max(1), v: z.number(), ease: Ease.optional() }))
    .min(1)
    .refine((ks) => ks.every((k, i) => i === 0 || k.t >= ks[i - 1]!.t), 'Les clés doivent être triées par t'),
});
export type ChannelTrack = z.infer<typeof ChannelTrack>;

export const ActorCue = z.object({
  actor: z.string(),
  at: z.number().min(0).max(1),
  until: z.number().min(0).max(1).optional(),
  params: z.record(z.string(), z.unknown()).default({}),
});

export const NarrationCue = z.object({
  at: z.number().min(0).max(1),
  text: Claim,
  focus: OrganelleId.optional(),
});

export const Stage = z.object({
  id: z.string(),
  title: LocalizedText,
  range: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),
  description: Claim,
  cellularSigns: z.array(Claim).default([]),
  narration: z.array(NarrationCue).default([]),
});
export type Stage = z.infer<typeof Stage>;
