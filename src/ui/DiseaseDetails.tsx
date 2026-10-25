'use client';

import { useMemo } from 'react';
import type { Disease, Source } from '@/content/schema';
import { useL, useT } from '@/i18n/locale';
import { CitationContext, CitationIndex, Claim } from './Claim';
import styles from './disease.module.css';

function SourceItem({ source, n }: { source: Source; n: number }) {
  const t = useT();
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
              {t.panel.read} ↗
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
  headingLevel = 3,
}: {
  disease: Disease;
  sources: Source[];
  stage?: number;
  /** 3 inside the explorer panel (under its h2), 2 on the disease page (under the h1). */
  headingLevel?: 2 | 3;
}) {
  const t = useT();
  const l = useL();
  const H = `h${headingLevel}` as 'h2' | 'h3';
  const citations = useMemo(() => new CitationIndex(), [disease]); // eslint-disable-line react-hooks/exhaustive-deps
  const byId = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);
  const current = stage !== undefined ? disease.stages[stage] : undefined;

  return (
    <CitationContext.Provider value={citations}>
      <div className={styles.details}>
        <ul className={styles.chips}>
          {disease.categories.map((c) => (
            <li key={c}>{t.diseases.categories[c] ?? c}</li>
          ))}
        </ul>

        <section className={styles.lead}>
          <Claim claim={disease.summary} />
        </section>

        {current && current.cellularSigns.length > 0 && (
          <section className={styles.now}>
            <H className="label">
              {t.diseases.signs} · {l(current.title)}
            </H>
            {current.cellularSigns.map((s, i) => (
              <Claim key={i} claim={s} />
            ))}
          </section>
        )}

        <section>
          <H className="label">{t.diseases.cell}</H>
          <p className={styles.cellType}>{t.diseases.cellTypes[disease.cellContext.cellType]}</p>
          {disease.cellContext.note && <Claim claim={disease.cellContext.note} />}
        </section>

        <section>
          <H className="label">{t.diseases.cause}</H>
          {disease.cause.map((c, i) => (
            <Claim key={i} claim={c} />
          ))}
        </section>

        <section>
          <H className="label">{t.diseases.mechanism}</H>
          <ol className={styles.mechanism}>
            {disease.mechanism.map((m, i) => (
              <li key={i}>
                <strong>{l(m.title)}</strong>
                <Claim claim={m.explanation} />
              </li>
            ))}
          </ol>
        </section>

        {disease.treatmentsNote && (
          <section>
            <H className="label">{t.diseases.treatment}</H>
            <Claim claim={disease.treatmentsNote} />
          </section>
        )}

        <p className={styles.disclaimer}>{t.diseases.disclaimer}</p>

        <Sources citations={citations} byId={byId} heading={H} />
      </div>
    </CitationContext.Provider>
  );
}

/** Rendered last, so every citation above has been numbered. */
function Sources({ citations, byId, heading: H }: { citations: CitationIndex; byId: Map<string, Source>; heading: 'h2' | 'h3' }) {
  const t = useT();
  return (
    <section>
      <H className="label">{t.panel.sources}</H>
      <ol className={styles.sources}>
        {citations.ids.map((id, i) => {
          const s = byId.get(id);
          return s ? <SourceItem key={id} source={s} n={i + 1} /> : null;
        })}
      </ol>
    </section>
  );
}
