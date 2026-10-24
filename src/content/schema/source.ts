import { z } from 'zod';

export const Source = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    type: z.enum(['article', 'review', 'book', 'chapter', 'database', 'guideline', 'website']),
    title: z.string().min(1),
    /** Book (or journal) that contains this section or chapter. */
    container: z.string().optional(),
    authors: z.array(z.string()).optional(),
    year: z.number().int().min(1800).max(2100),
    publisher: z.string().optional(),
    edition: z.string().optional(),
    pmid: z.string().regex(/^\d+$/).optional(),
    doi: z.string().regex(/^10\.\d{4,9}\/\S+$/).optional(),
    isbn: z.string().optional(),
    url: z.url().optional(),
    verified: z
      .object({ on: z.iso.date(), via: z.enum(['pubmed', 'crossref', 'ncbi-bookshelf', 'manual']) })
      .optional(),
  })
  .refine((s) => s.pmid || s.doi || s.isbn || s.url, {
    message: 'Une source doit avoir au moins un identifiant (PMID, DOI, ISBN ou URL)',
  });
export type Source = z.infer<typeof Source>;
