import type { Organelle, Process, Source, Tour } from './schema';
import { loadContent } from './load';

/** The slice of content the explorer needs on the client (serialisable JSON). */
export interface ExplorerContent {
  organelles: Organelle[];
  processes: Process[];
  tours: Tour[];
  sources: Source[];
}

/** Server / build time only. */
export function explorerContent(): ExplorerContent {
  const { content, issues } = loadContent();
  if (issues.length) throw new Error(`Contenu invalide : ${issues.map((i) => `${i.file}: ${i.message}`).join('; ')}`);
  const { organelles, processes, tours, sources } = content;
  return { organelles, processes, tours, sources };
}
