'use client';

import { createContext, useContext, useState } from 'react';
import type { Claim as ClaimData } from '@/content/schema';
import { useL, useT } from '@/i18n/locale';
import styles from './panel.module.css';

/** Numbers sources in order of first citation within one panel. */
export class CitationIndex {
  private order: string[] = [];
  number(id: string) {
    let i = this.order.indexOf(id);
    if (i < 0) i = this.order.push(id) - 1;
    return i + 1;
  }
  get ids() {
    return this.order;
  }
}

export const CitationContext = createContext<CitationIndex | null>(null);

/** A sourced statement: text, citation numbers, and an optional "simplification" disclosure. */
export function Claim({ claim, as: Tag = 'p' }: { claim: ClaimData; as?: 'p' | 'span' }) {
  const t = useT();
  const l = useL();
  const index = useContext(CitationContext);
  const [open, setOpen] = useState(false);
  const numbers = index ? claim.sources.map((s) => index.number(s.id)) : [];
  return (
    <Tag className={styles.claim}>
      {l(claim.text)}
      {numbers.length > 0 && (
        <sup className={styles.cite}>
          {numbers.map((n, i) => (
            <a key={n} href={`#source-${n}`} aria-label={`${t.panel.source} ${n}`}>
              {n}
              {i < numbers.length - 1 ? ',' : ''}
            </a>
          ))}
        </sup>
      )}
      {claim.simplification && (
        <>
          {' '}
          <button
            type="button"
            className={styles.simplified}
            aria-expanded={open}
            onClick={() => setOpen((o) => !o)}
          >
            {t.panel.simplified}
          </button>
          {open && <span className={styles.simplifiedText}>{l(claim.simplification)}</span>}
        </>
      )}
    </Tag>
  );
}
