import type { Disease, LocalizedText } from './schema';

/** Accent- and case-insensitive text, so « maladie de gaucher » finds « Maladie de Gaucher ». */
export const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const both = (t: LocalizedText) => [t.fr, t.en ?? ''];

/**
 * Everything a reader might type, in every language: names, aliases, causes (genes), summary, organelles,
 * categories. A French reader typing « gène » and an English one typing "gene" both find it.
 */
function haystack(d: Disease, labels: Record<string, string>[]) {
  return fold(
    [
      ...both(d.name),
      ...d.aliases,
      ...both(d.summary.text),
      ...d.cause.flatMap((c) => both(c.text)),
      ...d.affectedOrganelles,
      ...d.affectedPathways,
      ...d.categories.flatMap((c) => labels.map((l) => l[c] ?? c)),
    ].join(' '),
  );
}

/** Every word of the query must appear somewhere (simple, predictable, fast enough for thousands of entries). */
export function searchDiseases(
  diseases: Disease[],
  query: string,
  category: string | null,
  labels: Record<string, string>[],
) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  return diseases.filter((d) => {
    if (category && !d.categories.includes(category as Disease['categories'][number])) return false;
    if (!words.length) return true;
    const text = haystack(d, labels);
    return words.every((w) => text.includes(w));
  });
}
