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
  keyMolecules: z.array(z.object({ name: LocalizedText, role: Claim })).default([]),
  interactions: z.array(z.object({ with: OrganelleId, description: Claim })).default([]),
  dimensions: z
    .object({ min: z.number().positive(), max: z.number().positive(), unit: z.enum(['nm', 'µm']), note: Claim })
    .optional(),
  camera: CameraHint.optional(),
  /**
   * Successive magnified views (e.g. DNA compaction). Each id names a 3D model provided by the scene;
   * the caption is a sourced claim like everything else.
   */
  zoomLevels: z
    .array(
      z.object({
        id: z.enum(['helix', 'nucleosome', 'fiber', 'chromosome']),
        title: LocalizedText,
        scale: LocalizedText,
        claim: Claim,
      }),
    )
    .default([]),
  /** Id of a process that shows this organelle at work (button in the panel). */
  relatedProcess: z.string().optional(),
});
export type Organelle = z.infer<typeof Organelle>;
