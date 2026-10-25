import type { HeroModel } from './schema/scenario';

/**
 * Real size of each enlarged object and the size it is drawn at (both as a diameter or length, in
 * nanometres; 1 scene unit = 100 nm). `null`: drawn close to its real size, or a strand whose
 * "size" would mislead (RNA, light), so no enlargement is announced.
 */
export const HERO_SIZES: Record<HeroModel, { realNm: number; shownNm: number } | null> = {
  coronavirus: { realNm: 100, shownNm: 700 },
  influenza: { realNm: 100, shownNm: 600 },
  hiv: { realNm: 120, shownNm: 700 },
  listeria: null,
  mycobacterium: null,
  receptor: { realNm: 10, shownNm: 300 },
  'viral-rna': null,
  mrna: null,
  protein: { realNm: 5, shownNm: 160 },
  misfolded: { realNm: 20, shownNm: 300 },
  enzyme: { realNm: 5, shownNm: 200 },
  substrate: { realNm: 2, shownNm: 80 },
  ldl: { realNm: 22, shownNm: 220 },
  glucose: { realNm: 1, shownNm: 80 },
  insulin: { realNm: 3, shownNm: 120 },
  't-cell': null,
  uv: null,
};

/** Enlargement factor announced to the reader, rounded to a readable number (or null below ×2). */
export function enlargement(model: HeroModel): number | null {
  const s = HERO_SIZES[model];
  if (!s) return null;
  const f = s.shownNm / s.realNm;
  if (f < 2) return null;
  return f < 10 ? Math.round(f) : Math.round(f / 5) * 5;
}
