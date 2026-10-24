'use client';

import { useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { OrganelleId, Source } from '@/content/schema';
import { fr } from '@/i18n/fr';
import { useSelection } from '@/state/selection';
import { cameraPosition } from '@/scene/camera/focus';
import { anchorFor } from '@/scene/interaction/anchors';
import { ORGANELLE_SWATCHES } from '@/scene/palette';
import { useContent } from './ContentContext';
import { CitationContext, CitationIndex, Claim } from './Claim';
import styles from './panel.module.css';

const swatch = (id: OrganelleId) => ORGANELLE_SWATCHES.find(([k]) => k === id)?.[1] ?? '#8fe3ff';

function SourceEntry({ source, n }: { source: Source; n: number }) {
  return (
    <li id={`source-${n}`} className={styles.source}>
      <span className={styles.sourceN}>{n}</span>
      <span>
        <span className={styles.sourceTitle}>{source.title}</span>
        {source.container && (
          <>
            {' — '}
            <em>{source.container}</em>
          </>
        )}
        {source.edition && `, ${source.edition}`}
        {source.authors?.length ? `. ${source.authors[0]} et al.` : ''}
        {source.publisher && `, ${source.publisher}`}
        {`, ${source.year}.`}
        {source.url && (
          <>
            {' '}
            <a href={source.url} target="_blank" rel="noreferrer">
              {fr.panel.read} ↗
            </a>
          </>
        )}
      </span>
    </li>
  );
}

export function InfoPanel() {
  const selected = useSelection((s) => s.selected);
  const select = useSelection((s) => s.select);
  const hover = useSelection((s) => s.hover);
  const content = useContent();
  const organelle = selected ? content.organelle(selected.organelle) : undefined;

  // Escape closes the panel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && select(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [select]);

  // A fresh citation index per organelle; filled while rendering, read by the sources list below.
  const citations = useMemo(() => new CitationIndex(), [organelle]); // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = (id: OrganelleId) => select(anchorFor(id, cameraPosition));

  return (
    <AnimatePresence>
      {organelle && (
        <motion.aside
          key={organelle.id}
          className={`glass ${styles.panel}`}
          style={{ ['--accent' as string]: swatch(organelle.id) }}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }}
          exit={{ opacity: 0, x: 24, transition: { duration: 0.25 } }}
          aria-labelledby="panel-title"
        >
          <CitationContext.Provider value={citations}>
            <header className={styles.header}>
              <span className="label">{fr.panel.kicker}</span>
              <h2 id="panel-title" className={styles.title}>
                {organelle.name.fr}
              </h2>
              <p className={styles.tagline}>{organelle.tagline.fr}</p>
              <button className={styles.close} onClick={() => select(null)} aria-label={fr.panel.close}>
                ×
              </button>
            </header>

            <div className={styles.body}>
              <section className={styles.lead}>
                <Claim claim={organelle.summary} />
              </section>

              {organelle.function.length > 0 && (
                <section>
                  <h3 className="label">{fr.panel.function}</h3>
                  {organelle.function.map((c, i) => (
                    <Claim key={i} claim={c} />
                  ))}
                </section>
              )}

              {organelle.structure.length > 0 && (
                <section>
                  <h3 className="label">{fr.panel.structure}</h3>
                  {organelle.structure.map((c, i) => (
                    <Claim key={i} claim={c} />
                  ))}
                </section>
              )}

              {organelle.keyMolecules.length > 0 && (
                <section>
                  <h3 className="label">{fr.panel.molecules}</h3>
                  <dl className={styles.molecules}>
                    {organelle.keyMolecules.map((m) => (
                      <div key={m.name}>
                        <dt>{m.name}</dt>
                        <dd>
                          <Claim claim={m.role} as="span" />
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>
              )}

              {organelle.interactions.length > 0 && (
                <section>
                  <h3 className="label">{fr.panel.interactions}</h3>
                  <ul className={styles.interactions}>
                    {organelle.interactions.map((it) => (
                      <li key={it.with}>
                        <button
                          className={styles.link}
                          style={{ ['--dot' as string]: swatch(it.with) }}
                          onClick={() => goTo(it.with)}
                          onMouseEnter={() => hover({ organelle: it.with })}
                          onMouseLeave={() => hover(null)}
                        >
                          {content.organelle(it.with)?.name.fr ?? it.with}
                        </button>
                        <Claim claim={it.description} as="span" />
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <SourcesList citations={citations} />
            </div>
          </CitationContext.Provider>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

/** Rendered last, so every citation above has been numbered. */
function SourcesList({ citations }: { citations: CitationIndex }) {
  const content = useContent();
  return (
    <section>
      <h3 className="label">{fr.panel.sources}</h3>
      <ol className={styles.sources}>
        {citations.ids.map((id, i) => {
          const s = content.source(id);
          return s ? <SourceEntry key={id} source={s} n={i + 1} /> : null;
        })}
      </ol>
    </section>
  );
}
