import { describe, expect, it } from 'vitest';
import { Claim } from '@/content/schema';
import { checkIntegrity, collectMissingEnglish, collectSourceRefs, loadContent } from '@/content/load';

describe('content', () => {
  it('rejects a claim without sources', () => {
    expect(Claim.safeParse({ text: { fr: 'x' }, sources: [] }).success).toBe(false);
  });

  it('collects nested source references', () => {
    const refs = collectSourceRefs({ a: { sources: [{ id: 's1' }] }, b: [{ c: { sources: [{ id: 's2' }] } }] });
    expect(refs.sort()).toEqual(['s1', 's2']);
  });

  it('flags text without an English translation', () => {
    const missing = collectMissingEnglish({ name: { fr: 'Noyau', en: 'Nucleus' }, stages: [{ title: { fr: 'Étape' } }] });
    expect(missing).toEqual(['stages[0].title']);
  });

  it('repository content is valid', () => {
    const { content, issues } = loadContent();
    expect([...issues, ...checkIntegrity(content)]).toEqual([]);
    expect(content.organelles.length).toBeGreaterThanOrEqual(14);
  });
});
