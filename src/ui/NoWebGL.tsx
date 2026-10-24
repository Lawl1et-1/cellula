'use client';

import Link from 'next/link';
import { fr } from '@/i18n/fr';
import { useContent } from './ContentContext';
import styles from './page.module.css';

/** Text version of the explorer for browsers without WebGL 2: the knowledge stays accessible. */
export function NoWebGL() {
  const content = useContent();
  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.top}>
          <span className={styles.brand}>{fr.brand}</span>
          <nav className={styles.nav}>
            <Link href="/maladies">{fr.menu.diseases}</Link>
          </nav>
        </header>
        <h1 className={styles.title}>{fr.a11y.noWebgl}</h1>
        <p className={styles.lead}>{fr.a11y.noWebglLead}</p>
        <h2 className="label">{fr.a11y.organelles}</h2>
        <ul className={styles.grid}>
          {content.organelles.map((o) => (
            <li key={o.id} className={`glass ${styles.cardItem}`}>
              <div className={styles.cardLink}>
                <strong>{o.name.fr}</strong>
                <span className={styles.cardText}>{o.summary.text.fr}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
