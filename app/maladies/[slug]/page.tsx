import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { explorerContent } from '@/content/bundle';
import { fr } from '@/i18n/fr';
import { DiseaseDetails } from '@/ui/DiseaseDetails';
import styles from '@/ui/page.module.css';

export function generateStaticParams() {
  return explorerContent().diseases.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const d = explorerContent().diseases.find((x) => x.slug === slug);
  if (!d) return {};
  return { title: `${d.name.fr} — Cellula`, description: d.summary.text.fr };
}

export default async function DiseasePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { diseases, sources } = explorerContent();
  const d = diseases.find((x) => x.slug === slug);
  if (!d) notFound();

  return (
    <main className={styles.page}>
      <div className={styles.inner}>
        <header className={styles.top}>
          <Link className={styles.brand} href="/">
            {fr.brand}
          </Link>
          <nav className={styles.nav}>
            <Link href="/maladies">← {fr.diseases.back}</Link>
            <Link href="/explorer">Explorer la cellule</Link>
          </nav>
        </header>
        <span className="label">{fr.diseases.kicker}</span>
        <h1 className={styles.title}>{d.name.fr}</h1>
        {d.aliases.length > 0 && <p className={styles.lead}>{d.aliases.join(' · ')}</p>}
        <div className={styles.sheet}>
          <article>
            <DiseaseDetails disease={d} sources={sources} />
          </article>
          <aside className={`glass ${styles.aside}`}>
            <Link className={styles.cta} href={`/explorer?disease=${d.slug}`}>
              {fr.diseases.view} →
            </Link>
            <span className="label">Étapes</span>
            <ol className={styles.stages}>
              {d.stages.map((s) => (
                <li key={s.id}>{s.title.fr}</li>
              ))}
            </ol>
          </aside>
        </div>
      </div>
    </main>
  );
}
