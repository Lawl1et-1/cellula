import { z } from 'zod';
import { CameraHint, Claim, LocalizedText, OrganelleId } from './common';

export const Organelle = z.object({
  id: OrganelleId,
  name: LocalizedText,
  /** Short label used on hover. */
  tagline: LocalizedText,
  summary: Claim,
  function: z.array(Claim).default([]),
  structure: z.array(Claim).default([]),
  keyMolecules: z.array(z.object({ name: z.string(), role: Claim })).default([]),
  interactions: z.array(z.object({ with: OrganelleId, description: Claim })).default([]),
  dimensions: z
    .object({ min: z.number().positive(), max: z.number().positive(), unit: z.enum(['nm', 'µm']), note: Claim })
    .optional(),
  camera: CameraHint.optional(),
});
export type Organelle = z.infer<typeof Organelle>;
