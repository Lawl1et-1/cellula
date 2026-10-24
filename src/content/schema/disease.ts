import { z } from 'zod';
import { Claim, LocalizedText, OrganelleId } from './common';
import { ActorCue, ChannelTrack, Stage } from './scenario';

export const DISEASE_CATEGORIES = [
  'genetic',
  'metabolic',
  'infectious',
  'cancer',
  'neurodegenerative',
  'autoimmune',
  'mitochondrial',
  'lysosomal-storage',
  'peroxisomal',
] as const;
export const DiseaseCategory = z.enum(DISEASE_CATEGORIES);

export const CELL_TYPES = [
  'generic',
  'neuron',
  'hepatocyte',
  'beta-cell',
  'muscle-fiber',
  'macrophage',
  't-lymphocyte',
  'epithelial',
  'fibroblast',
  'erythrocyte',
] as const;
export const CellType = z.enum(CELL_TYPES);

export const Disease = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  name: LocalizedText,
  aliases: z.array(z.string()).default([]),
  categories: z.array(DiseaseCategory).min(1),
  identifiers: z
    .object({ omim: z.string(), icd11: z.string(), orpha: z.string(), mesh: z.string() })
    .partial()
    .default({}),
  cellContext: z.object({ cellType: CellType, note: Claim.optional() }),
  summary: Claim,
  cause: z.array(Claim).min(1),
  affectedOrganelles: z.array(OrganelleId).min(1),
  affectedPathways: z.array(z.string()).default([]),
  mechanism: z
    .array(z.object({ title: LocalizedText, explanation: Claim, organelle: OrganelleId.optional() }))
    .min(1),
  /** Playback length at normal speed. */
  durationSeconds: z.number().positive().default(50),
  stages: z.array(Stage).min(2),
  tracks: z.array(ChannelTrack).default([]),
  actors: z.array(ActorCue).default([]),
  treatmentsNote: Claim.optional(),
  review: z.object({ status: z.enum(['draft', 'reviewed']), lastChecked: z.iso.date() }),
});
export type Disease = z.infer<typeof Disease>;
