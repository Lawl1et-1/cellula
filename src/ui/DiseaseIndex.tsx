'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { DISEASE_CATEGORIES, type Disease } from '@/content/schema';
import { searchDiseases } from '@/content/search';
import { DICTIONARIES, pick, useL, useLocale, useT } from '@/i18n/locale';
import styles from './page.module.css';
import lib from './disease.module.css';

const CATEGORY_LABELS = [DICTIONARIES.fr.diseases.categories, DICTIONARIES.en.diseases.categories];

/** Static, crawlable library page (/maladies) with client-side search. */
export function DiseaseIndex({ diseases }: { diseases: Disease[] }) {
  const t = useT();
  const l = useL();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const locale = useLocale();
  // Alphabetical in the language being read.
  const results = useMemo(
    () =>
      searchDiseases(diseases, query, category, CATEGORY_LABELS).sort((a, b) =>
        pick(a.name, locale).localeCompare(pick(b.name, locale), locale),
      ),
    [diseases, query, category, locale],
  );
  const present = DISEASE_CATEGORIES.filter((c) => diseases.some((d) => d.categories.includes(c)));

  return (
    <>
      <input
        className={lib.search}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t.diseases.search}
        aria-label={t.diseases.search}
      />
      <div className={lib.filters} role="radiogroup" aria-label={t.diseases.categoriesLabel}>
        {[null, ...present].map((c) => (
          <button key={c ?? 'all'} role="radio" aria-checked={category === c} data-active={category === c} onClick={() => setCategory(c)}>
            {c ? t.diseases.categories[c] : t.diseases.all}
          </button>
        ))}
      </div>
      <p className="label" aria-live="polite">
        {t.diseases.count(results.length)}
      </p>
      <ul className={styles.grid}>
        {results.map((d) => (
          <li key={d.id} className={`glass ${styles.cardItem}`}>
            <Link className={styles.cardLink} href={`/maladies/${d.slug}`}>
              <strong>{l(d.name)}</strong>
              <span className={lib.cardMeta}>{d.categories.map((c) => t.diseases.categories[c]).join(' · ')}</span>
              <span className={styles.cardText}>{l(d.summary.text)}</span>
            </Link>
            <Link className={styles.view} href={`/explorer?disease=${d.slug}`}>
              {t.diseases.view} →
            </Link>
          </li>
        ))}
        {!results.length && <li className={lib.empty}>{t.diseases.empty}</li>}
      </ul>
    </>
  );
}
