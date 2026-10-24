'use client';

import { useMemo } from 'react';
import type { Disease, Source } from '@/content/schema';
import { fr } from '@/i18n/fr';
import { CitationContext, CitationIndex, Claim } from './Claim';
import styles from './disease.module.css';

function SourceItem({ source, n }: { source: Source; n: number }) {
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
        {source.authors?.length ? `. ${source.authors[0]}${source.authors.length > 1 ? ' et al.' : ''}` : ''}
        {`, ${source.year}.`}
        {source.pmid && ` PMID ${source.pmid}.`}
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

/**
 * Everything known about a disease, with numbered citations. Shared by the explorer panel and the
 * static disease pages. `stage` highlights what is visible at the current moment of the timeline.
 */
export function DiseaseDetails({
  disease,
  sources,
  stage,
}: {
  disease: Disease;
  sources: Source[];
  stage?: number;
}) {
  const citations = useMemo(() => new CitationIndex(), [disease]); // eslint-disable-line react-hooks/exhaustive-deps
  const byId = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);
  const current = stage !== undefined ? disease.stages[stage] : undefined;

  return (
    <CitationContext.Provider value={citations}>
      <div className={styles.details}>
        <ul className={styles.chips}>
          {disease.categories.map((c) => (
            <li key={c}>{fr.diseases.categories[c] ?? c}</li>
          ))}
        </ul>

        <section className={styles.lead}>
          <Claim claim={disease.summary} />
        </section>

        {current && current.cellularSigns.length > 0 && (
          <section className={styles.now}>
            <h3 className="label">
              {fr.diseases.signs} · {current.title.fr}
            </h3>
            {current.cellularSigns.map((s, i) => (
              <Claim key={i} claim={s} />
            ))}
          </section>
        )}

        <section>
          <h3 className="label">{fr.diseases.cell}</h3>
          <p className={styles.cellType}>{fr.diseases.cellTypes[disease.cellContext.cellType]}</p>
          {disease.cellContext.note && <Claim claim={disease.cellContext.note} />}
        </section>

        <section>
          <h3 className="label">{fr.diseases.cause}</h3>
          {disease.cause.map((c, i) => (
            <Claim key={i} claim={c} />
          ))}
        </section>

        <section>
          <h3 className="label">{fr.diseases.mechanism}</h3>
          <ol className={styles.mechanism}>
            {disease.mechanism.map((m, i) => (
              <li key={i}>
                <strong>{m.title.fr}</strong>
                <Claim claim={m.explanation} />
              </li>
            ))}
          </ol>
        </section>

        {disease.treatmentsNote && (
          <section>
            <h3 className="label">{fr.diseases.treatment}</h3>
            <Claim claim={disease.treatmentsNote} />
          </section>
        )}

        <p className={styles.disclaimer}>{fr.diseases.disclaimer}</p>

        <Sources citations={citations} byId={byId} />
      </div>
    </CitationContext.Provider>
  );
}

/** Rendered last, so every citation above has been numbered. */
function Sources({ citations, byId }: { citations: CitationIndex; byId: Map<string, Source> }) {
  return (
    <section>
      <h3 className="label">{fr.panel.sources}</h3>
      <ol className={styles.sources}>
        {citations.ids.map((id, i) => {
          const s = byId.get(id);
          return s ? <SourceItem key={id} source={s} n={i + 1} /> : null;
        })}
      </ol>
    </section>
  );
}
