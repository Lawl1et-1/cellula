import { describe, expect, it } from 'vitest';
import { Claim } from '@/content/schema';
import { checkIntegrity, collectSourceRefs, loadContent } from '@/content/load';

describe('content', () => {
  it('rejects a claim without sources', () => {
    expect(Claim.safeParse({ text: { fr: 'x' }, sources: [] }).success).toBe(false);
  });

  it('collects nested source references', () => {
    const refs = collectSourceRefs({ a: { sources: [{ id: 's1' }] }, b: [{ c: { sources: [{ id: 's2' }] } }] });
    expect(refs.sort()).toEqual(['s1', 's2']);
  });

  it('repository content is valid', () => {
    const { content, issues } = loadContent();
    expect([...issues, ...checkIntegrity(content)]).toEqual([]);
    expect(content.organelles.length).toBeGreaterThanOrEqual(14);
  });
});
