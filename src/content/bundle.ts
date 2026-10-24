import type { Disease, Organelle, Process, Source, Tour } from './schema';
import { loadContent } from './load';

/** The slice of content the explorer needs on the client (serialisable JSON). */
export interface ExplorerContent {
  organelles: Organelle[];
  processes: Process[];
  tours: Tour[];
  diseases: Disease[];
  sources: Source[];
}

/** Server / build time only. */
export function explorerContent(): ExplorerContent {
  const { content, issues } = loadContent();
  if (issues.length) throw new Error(`Contenu invalide : ${issues.map((i) => `${i.file}: ${i.message}`).join('; ')}`);
  const { organelles, processes, tours, diseases, sources } = content;
  return { organelles, processes, tours, diseases: [...diseases].sort((a, b) => a.name.fr.localeCompare(b.name.fr, 'fr')), sources };
}
