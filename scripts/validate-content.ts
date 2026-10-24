import { checkIntegrity, loadContent } from '../src/content/load';

const { content, issues } = loadContent();
issues.push(...checkIntegrity(content));

const counts = [
  `${content.sources.length} sources`,
  `${content.organelles.length} organites`,
  `${content.processes.length} processus`,
  `${content.tours.length} visite(s)`,
  `${content.diseases.length} maladies`,
].join(', ');

if (issues.length) {
  console.error(`✗ Contenu invalide (${issues.length} problème(s)) — ${counts}`);
  for (const i of issues) console.error(`  ${i.file}: ${i.message}`);
  process.exit(1);
}
console.log(`✓ Contenu valide — ${counts}`);
