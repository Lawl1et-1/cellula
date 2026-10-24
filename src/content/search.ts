import type { Disease } from './schema';

/** Accent- and case-insensitive text, so « maladie de gaucher » finds « Maladie de Gaucher ». */
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Everything a reader might type: names, aliases, causes (genes), summary, organelles, categories. */
function haystack(d: Disease, labels: Record<string, string>) {
  return fold(
    [
      d.name.fr,
      ...d.aliases,
      d.summary.text.fr,
      ...d.cause.map((c) => c.text.fr),
      ...d.affectedOrganelles,
      ...d.affectedPathways,
      ...d.categories.map((c) => labels[c] ?? c),
    ].join(' '),
  );
}

/** Every word of the query must appear somewhere (simple, predictable, fast enough for thousands of entries). */
export function searchDiseases(diseases: Disease[], query: string, category: string | null, labels: Record<string, string>) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  return diseases.filter((d) => {
    if (category && !d.categories.includes(category as Disease['categories'][number])) return false;
    if (!words.length) return true;
    const text = haystack(d, labels);
    return words.every((w) => text.includes(w));
  });
}
