import Link from 'next/link';
import type { Metadata } from 'next';
import { explorerContent } from '@/content/bundle';
import { fr } from '@/i18n/fr';
import { DiseaseIndex } from '@/ui/DiseaseIndex';
import styles from '@/ui/page.module.css';

export const metadata: Metadata = {
  title: 'Bibliothèque des maladies — Cellula',
  description:
    'Ce que les maladies font à la cellule humaine, étape par étape : surcharges lysosomales, maladies mitochondriales, neurodégénératives, infections, cancers… Chaque affirmation est sourcée.',
};

export default function DiseasesPage() {
  const { diseases } = explorerContent();
  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.top}>
          <Link className={styles.brand} href="/">
            {fr.brand}
          </Link>
          <nav className={styles.nav}>
            <Link href="/explorer">Explorer la cellule</Link>
            <Link href="/maladies">{fr.menu.diseases}</Link>
          </nav>
        </header>
        <span className="label">{fr.diseases.kicker}s</span>
        <h1 className={styles.title}>{fr.diseases.title}</h1>
        <p className={styles.lead}>{fr.diseases.lead}</p>
        <div className={styles.tools}>
          <DiseaseIndex diseases={diseases} />
        </div>
      </div>
    </main>
  );
}
