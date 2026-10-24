'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { DISEASE_CATEGORIES, type Disease } from '@/content/schema';
import { searchDiseases } from '@/content/search';
import { fr } from '@/i18n/fr';
import styles from './page.module.css';
import lib from './disease.module.css';

/** Static, crawlable library page (/maladies) with client-side search. */
export function DiseaseIndex({ diseases }: { diseases: Disease[] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const results = useMemo(
    () => searchDiseases(diseases, query, category, fr.diseases.categories),
    [diseases, query, category],
  );
  const present = DISEASE_CATEGORIES.filter((c) => diseases.some((d) => d.categories.includes(c)));

  return (
    <>
      <input
        className={lib.search}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={fr.diseases.search}
        aria-label={fr.diseases.search}
      />
      <div className={lib.filters} role="radiogroup" aria-label="Catégories">
        {[null, ...present].map((c) => (
          <button key={c ?? 'all'} role="radio" aria-checked={category === c} data-active={category === c} onClick={() => setCategory(c)}>
            {c ? fr.diseases.categories[c] : fr.diseases.all}
          </button>
        ))}
      </div>
      <p className="label" aria-live="polite">
        {fr.diseases.count(results.length)}
      </p>
      <ul className={styles.grid}>
        {results.map((d) => (
          <li key={d.id} className={`glass ${styles.cardItem}`}>
            <Link className={styles.cardLink} href={`/maladies/${d.slug}`}>
              <strong>{d.name.fr}</strong>
              <span className={lib.cardMeta}>{d.categories.map((c) => fr.diseases.categories[c]).join(' · ')}</span>
              <span className={styles.cardText}>{d.summary.text.fr}</span>
            </Link>
            <Link className={styles.view} href={`/explorer?disease=${d.slug}`}>
              {fr.diseases.view} →
            </Link>
          </li>
        ))}
        {!results.length && <li className={lib.empty}>{fr.diseases.empty}</li>}
      </ul>
    </>
  );
}
