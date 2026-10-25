'use client';

import type { Claim } from '@/content/schema';
import { useT } from '@/i18n/locale';
import { useContent } from './ContentContext';
import styles from './player.module.css';

/** Compact source list under a narrated statement (players have no room for a numbered bibliography). */
export function SourceLine({ claim }: { claim: Claim }) {
  const t = useT();
  const content = useContent();
  return (
    <p className={styles.sourceLine}>
      <span className="label">{t.panel.sources}</span>
      {claim.sources.map((ref) => {
        const s = content.source(ref.id);
        if (!s) return null;
        return (
          <a key={ref.id} href={s.url} target="_blank" rel="noreferrer">
            {s.title}
            {s.container ? ` — ${s.container}` : ''} ↗
          </a>
        );
      })}
    </p>
  );
}
