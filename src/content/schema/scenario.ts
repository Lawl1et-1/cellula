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

/** Named places in the cell that actors travel between (resolved to coordinates by the scene). */
export const ANCHOR_IDS = [
  'outside',
  'membrane',
  'cytoplasm',
  'endosome',
  'nucleus',
  'nucleus.pore',
  'rough-er',
  'golgi.cis',
  'golgi.trans',
  'mitochondrion',
  'lysosome',
  'peroxisome',
] as const;
export const AnchorId = z.enum(ANCHOR_IDS);
export type AnchorId = z.infer<typeof AnchorId>;

/** What an actor carries; each kind has its own look (colour, size, glow). */
export const CargoKind = z.enum(['mrna', 'protein', 'vesicle', 'glucose', 'pyruvate', 'atp', 'ldl', 'oxygen', 'virion', 'cytokine']);
export type CargoKind = z.infer<typeof CargoKind>;

const timing = {
  at: z.number().min(0).max(1),
  until: z.number().min(0).max(1).optional(),
};

/**
 * Visual primitives a scenario can call. New primitives need code; new scenarios only need data.
 * - path: cargo travelling through anchors (mRNA export, vesicle traffic, endocytosis…)
 * - burst: cargo released from one place (ATP from mitochondria…)
 * - pulse: a glow marking where something happens (translation on the RER…)
 * - mitosis: the whole-cell choreography of division (chromosomes, spindle, furrow)
 */
export const ActorCue = z.discriminatedUnion('actor', [
  z.object({
    actor: z.literal('path'),
    ...timing,
    params: z.object({ path: z.array(AnchorId).min(2), cargo: CargoKind, count: z.number().int().min(1).max(16).default(1) }),
  }),
  z.object({
    actor: z.literal('burst'),
    ...timing,
    params: z.object({ from: AnchorId, cargo: CargoKind, count: z.number().int().min(1).max(40).default(12) }),
  }),
  z.object({ actor: z.literal('pulse'), ...timing, params: z.object({ at: AnchorId }) }),
  z.object({ actor: z.literal('mitosis'), ...timing, params: z.object({}).default({}) }),
]);
export type ActorCue = z.infer<typeof ActorCue>;

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
  /** Organelle the camera frames during this stage. */
  focus: OrganelleId.optional(),
  camera: z
    .object({
      /** Framing radius override (scene units, 1 = 0.1 µm). */
      radius: z.number().positive().optional(),
      /** 'cell' frames the whole cell instead of the focus organelle. */
      view: z.enum(['organelle', 'cell']).default('organelle'),
      /** Axis to look across (side-on), e.g. the mitotic spindle. */
      sideOn: z.tuple([z.number(), z.number(), z.number()]).optional(),
    })
    .optional(),
});
export type Stage = z.infer<typeof Stage>;

export const Process = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: LocalizedText,
  summary: Claim,
  /** Playback length at normal speed. */
  durationSeconds: z.number().positive(),
  stages: z.array(Stage).min(2),
  tracks: z.array(ChannelTrack).default([]),
  actors: z.array(ActorCue).default([]),
  review: z.object({ status: z.enum(['draft', 'reviewed']), lastChecked: z.iso.date() }),
});
export type Process = z.infer<typeof Process>;
