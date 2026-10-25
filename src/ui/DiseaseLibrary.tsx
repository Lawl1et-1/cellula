'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { DISEASE_CATEGORIES, type Disease } from '@/content/schema';
import { searchDiseases } from '@/content/search';
import { DICTIONARIES, pick, useL, useLocale, useT } from '@/i18n/locale';
import { useScenario } from '@/state/scenario';
import { useScene } from '@/state/scene';
import { useSelection } from '@/state/selection';
import { useTour } from '@/state/tour';
import { useUi } from '@/state/ui';
import { useContent } from './ContentContext';
import styles from './disease.module.css';

const CATEGORY_LABELS = [DICTIONARIES.fr.diseases.categories, DICTIONARIES.en.diseases.categories];

export function startDisease(d: Disease) {
  useSelection.getState().select(null);
  useTour.getState().stop();
  if (useScene.getState().cameraMode === 'flight') useScene.getState().setCameraMode('orbit');
  useScenario.getState().start({ kind: 'disease', ...d });
}

/** Searchable, filterable library of diseases, opened from the top menu. */
export function DiseaseLibrary() {
  const t = useT();
  const l = useL();
  const content = useContent();
  const open = useUi((s) => s.libraryOpen);
  const setOpen = useUi((s) => s.setLibraryOpen);
  const running = useScenario((s) => (s.scenario?.kind === 'disease' ? s.scenario.id : null));
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const locale = useLocale();
  // Alphabetical in the language being read.
  const results = useMemo(
    () =>
      searchDiseases(content.diseases, query, category, CATEGORY_LABELS).sort((a, b) =>
        pick(a.name, locale).localeCompare(pick(b.name, locale), locale),
      ),
    [content.diseases, query, category, locale],
  );
  const present = useMemo(
    () => DISEASE_CATEGORIES.filter((c) => content.diseases.some((d) => d.categories.includes(c))),
    [content.diseases],
  );

  // Deep link: /explorer?disease=<slug>&t=0.5
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const d = content.diseases.find((x) => x.slug === params.get('disease') || x.id === params.get('disease'));
    if (!d) return;
    startDisease(d);
    const at = Number(params.get('t'));
    if (params.has('t') && Number.isFinite(at)) {
      useScenario.getState().setT(at);
      useScenario.getState().setPlaying(false);
    }
  }, [content.diseases]);

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setOpen]);

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          className={`glass ${styles.library}`}
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] } }}
          exit={{ opacity: 0, x: -24, transition: { duration: 0.2 } }}
          aria-label={t.diseases.title}
        >
          <header className={styles.libraryHeader}>
            <div>
              <h2 className={styles.libraryTitle}>{t.diseases.title}</h2>
              <p className={styles.libraryLead}>{t.diseases.lead}</p>
            </div>
            <button className={styles.close} onClick={() => setOpen(false)} aria-label={t.player.close}>
              ×
            </button>
          </header>

          <input
            ref={input}
            className={styles.search}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.diseases.search}
            aria-label={t.diseases.search}
          />

          <div className={styles.filters} role="radiogroup" aria-label={t.diseases.categoriesLabel}>
            {[null, ...present].map((c) => (
              <button
                key={c ?? 'all'}
                role="radio"
                aria-checked={category === c}
                data-active={category === c}
                onClick={() => setCategory(c)}
              >
                {c ? t.diseases.categories[c] : t.diseases.all}
              </button>
            ))}
          </div>

          <p className="label" aria-live="polite">
            {t.diseases.count(results.length)}
          </p>

          <ul className={styles.results}>
            {results.map((d) => (
              <li key={d.id}>
                <button
                  className={styles.card}
                  aria-current={running === d.id}
                  onClick={() => {
                    startDisease(d);
                    setOpen(false);
                  }}
                >
                  <strong>{l(d.name)}</strong>
                  <span className={styles.cardMeta}>
                    {d.categories.map((c) => t.diseases.categories[c]).join(' · ')} — {t.diseases.cellTypes[d.cellContext.cellType]}
                  </span>
                  <span className={styles.cardText}>{l(d.summary.text)}</span>
                </button>
              </li>
            ))}
            {!results.length && <li className={styles.empty}>{t.diseases.empty}</li>}
          </ul>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
