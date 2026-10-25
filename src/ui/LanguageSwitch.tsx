'use client';

import { Fragment } from 'react';
import { LOCALES } from '@/i18n/config';
import { DICTIONARIES, setLocale, useLocale } from '@/i18n/locale';
import styles from './ui.module.css';

/** "FR | EN" toggle. Switching keeps the 3D scene, the camera and every open panel as they are. */
export function LanguageSwitch({ placement = 'floating' }: { placement?: 'floating' | 'inline' }) {
  const locale = useLocale();
  return (
    <div
      className={placement === 'floating' ? `glass ${styles.lang}` : styles.langInline}
      role="group"
      aria-label={`${DICTIONARIES.fr.language.label} / ${DICTIONARIES.en.language.label}`}
    >
      {LOCALES.map((l, i) => (
        <Fragment key={l}>
          {i > 0 && (
            <span className={styles.langSep} aria-hidden>
              |
            </span>
          )}
          <button
            className={styles.langButton}
            lang={l}
            aria-pressed={locale === l}
            aria-label={DICTIONARIES[l].language[l]}
            onClick={() => setLocale(l)}
          >
            {l.toUpperCase()}
          </button>
        </Fragment>
      ))}
    </div>
  );
}
