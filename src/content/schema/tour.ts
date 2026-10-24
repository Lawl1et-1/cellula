import { z } from 'zod';
import { Claim, LocalizedText, OrganelleId } from './common';

/** A guided tour: a sequence of organelles; each step shows the organelle's own sourced summary unless overridden. */
export const Tour = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: LocalizedText,
  intro: LocalizedText,
  steps: z
    .array(
      z.object({
        focus: OrganelleId,
        text: Claim.optional(),
        seconds: z.number().positive().default(9),
      }),
    )
    .min(2),
});
export type Tour = z.infer<typeof Tour>;
