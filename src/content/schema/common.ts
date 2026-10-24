import { z } from 'zod';

/** Localised text. French is required; other locales are optional and fall back to French. */
export const LocalizedText = z.object({
  fr: z.string().min(1),
  en: z.string().min(1).optional(),
});
export type LocalizedText = z.infer<typeof LocalizedText>;

export const SourceRef = z.object({
  id: z.string().min(1),
  /** Chapter, page or figure inside the source. */
  locator: z.string().optional(),
});
export type SourceRef = z.infer<typeof SourceRef>;

/** Any scientific statement shown in the UI. A claim without a source does not validate. */
export const Claim = z.object({
  text: LocalizedText,
  sources: z.array(SourceRef).min(1, 'Une affirmation doit citer au moins une source'),
  simplification: LocalizedText.optional(),
});
export type Claim = z.infer<typeof Claim>;

export const ORGANELLE_IDS = [
  'plasma-membrane',
  'nucleus',
  'nucleolus',
  'rough-er',
  'smooth-er',
  'golgi',
  'mitochondrion',
  'lysosome',
  'peroxisome',
  'ribosome',
  'cytoskeleton',
  'centrosome',
  'vesicle',
  'cytoplasm',
] as const;
export const OrganelleId = z.enum(ORGANELLE_IDS);
export type OrganelleId = z.infer<typeof OrganelleId>;

export const CameraHint = z.object({
  distance: z.number().positive(),
  /** Offset direction from the organelle centre, normalised at runtime. */
  direction: z.tuple([z.number(), z.number(), z.number()]).optional(),
});
