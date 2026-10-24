import type { Organelle, Source } from './schema';
import { loadContent } from './load';

/** The slice of content the explorer needs on the client (serialisable JSON). */
export interface ExplorerContent {
  organelles: Organelle[];
  sources: Source[];
}

/** Server / build time only. */
export function explorerContent(): ExplorerContent {
  const { content, issues } = loadContent();
  if (issues.length) throw new Error(`Contenu invalide : ${issues.map((i) => `${i.file}: ${i.message}`).join('; ')}`);
  return { organelles: content.organelles, sources: content.sources };
}
