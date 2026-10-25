'use client';

import Link from 'next/link';
import type { Disease, Source } from '@/content/schema';
import { DICTIONARIES, useL, useT } from '@/i18n/locale';
import { DiseaseDetails } from './DiseaseDetails';
import { DiseaseIndex } from './DiseaseIndex';
import { PageMeta } from './PageMeta';
import { SiteHeader } from './SiteHeader';
import styles from './page.module.css';

/** /maladies: the crawlable library with client-side search. */
export function DiseasesPage({ diseases }: { diseases: Disease[] }) {
  const t = useT();
  return (
    <main className={styles.page}>
      <PageMeta
        title={{ fr: DICTIONARIES.fr.meta.diseases, en: DICTIONARIES.en.meta.diseases }}
        description={{ fr: DICTIONARIES.fr.meta.diseasesDescription, en: DICTIONARIES.en.meta.diseasesDescription }}
      />
      <div className={styles.inner}>
        <SiteHeader />
        <span className="label">{t.diseases.kickerPlural}</span>
        <h1 className={styles.title}>{t.diseases.title}</h1>
        <p className={styles.lead}>{t.diseases.lead}</p>
        <div className={styles.tools}>
          <DiseaseIndex diseases={diseases} />
        </div>
      </div>
    </main>
  );
}

/** /maladies/[slug]: everything about one disease, with a link into the 3D view. */
export function DiseasePage({ disease: d, sources }: { disease: Disease; sources: Source[] }) {
  const t = useT();
  const l = useL();
  return (
    <main className={styles.page}>
      <PageMeta
        title={{ fr: `${d.name.fr} — Cellula`, en: `${d.name.en ?? d.name.fr} — Cellula` }}
        description={d.summary.text}
      />
      <div className={styles.inner}>
        <SiteHeader back />
        <span className="label">{t.diseases.kicker}</span>
        <h1 className={styles.title}>{l(d.name)}</h1>
        {d.aliases.length > 0 && <p className={styles.lead}>{d.aliases.join(' · ')}</p>}
        <div className={styles.sheet}>
          <article>
            <DiseaseDetails disease={d} sources={sources} headingLevel={2} />
          </article>
          <aside className={`glass ${styles.aside}`}>
            <Link className={styles.cta} href={`/explorer?disease=${d.slug}`}>
              {t.diseases.view} →
            </Link>
            <span className="label">{t.diseases.stages}</span>
            <ol className={styles.stages}>
              {d.stages.map((s) => (
                <li key={s.id}>{l(s.title)}</li>
              ))}
            </ol>
          </aside>
        </div>
      </div>
    </main>
  );
}
