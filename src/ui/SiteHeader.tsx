'use client';

import Link from 'next/link';
import { useT } from '@/i18n/locale';
import { LanguageSwitch } from './LanguageSwitch';
import styles from './page.module.css';

/** Header of the reading pages: wordmark, navigation, language switch. */
export function SiteHeader({ back }: { back?: boolean }) {
  const t = useT();
  return (
    <header className={styles.top}>
      <Link className={styles.brand} href="/">
        {t.brand}
      </Link>
      <nav className={styles.nav}>
        {back ? (
          <Link href="/maladies">← {t.diseases.back}</Link>
        ) : (
          <Link href="/maladies">{t.menu.diseases}</Link>
        )}
        <Link href="/explorer">{t.nav.explore}</Link>
        <LanguageSwitch placement="inline" />
      </nav>
    </header>
  );
}
