'use client';

import Link from 'next/link';
import { useL, useT } from '@/i18n/locale';
import { useContent } from './ContentContext';
import { LanguageSwitch } from './LanguageSwitch';
import styles from './page.module.css';

/** Text version of the explorer for browsers without WebGL 2: the knowledge stays accessible. */
export function NoWebGL() {
  const t = useT();
  const l = useL();
  const content = useContent();
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.top}>
          <span className={styles.brand}>{t.brand}</span>
          <nav className={styles.nav}>
            <Link href="/maladies">{t.menu.diseases}</Link>
            <LanguageSwitch placement="inline" />
          </nav>
        </header>
        <h1 className={styles.title}>{t.a11y.noWebgl}</h1>
        <p className={styles.lead}>{t.a11y.noWebglLead}</p>
        <h2 className="label">{t.a11y.organelles}</h2>
        <ul className={styles.grid}>
          {content.organelles.map((o) => (
            <li key={o.id} className={`glass ${styles.cardItem}`}>
              <div className={styles.cardLink}>
                <strong>{l(o.name)}</strong>
                <span className={styles.cardText}>{l(o.summary.text)}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
