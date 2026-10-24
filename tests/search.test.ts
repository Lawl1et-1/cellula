import { describe, expect, it } from 'vitest';
import { loadContent } from '@/content/load';
import { searchDiseases } from '@/content/search';
import { fr } from '@/i18n/fr';

const { content } = loadContent();
const labels = fr.diseases.categories;

describe('disease search', () => {
  it('ignores accents and case', () => {
    const r = searchDiseases(content.diseases, 'TAY sachs', null, labels);
    expect(r.map((d) => d.id)).toContain('tay-sachs');
    expect(searchDiseases(content.diseases, 'stéatose', null, labels).map((d) => d.id)).toContain('masld');
    expect(searchDiseases(content.diseases, 'steatose', null, labels).map((d) => d.id)).toContain('masld');
  });

  it('finds diseases by gene and by category', () => {
    expect(searchDiseases(content.diseases, 'CFTR', null, labels).map((d) => d.id)).toContain('mucoviscidose');
    const lysosomal = searchDiseases(content.diseases, '', 'lysosomal-storage', labels);
    expect(lysosomal.length).toBeGreaterThanOrEqual(6);
    expect(lysosomal.every((d) => d.categories.includes('lysosomal-storage'))).toBe(true);
  });

  it('every disease has a label for each of its categories', () => {
    for (const d of content.diseases) for (const c of d.categories) expect(labels[c]).toBeTruthy();
  });
});
