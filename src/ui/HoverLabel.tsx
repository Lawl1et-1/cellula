'use client';

import { useEffect, useRef } from 'react';
import { useL } from '@/i18n/locale';
import { useSelection } from '@/state/selection';
import { useContent } from './ContentContext';
import styles from './panel.module.css';

/** Small label that follows the pointer while it rests on an organelle in the scene. */
export function HoverLabel() {
  const l = useL();
  const hovered = useSelection((s) => s.hovered);
  const content = useContent();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (ref.current) ref.current.style.transform = `translate(${e.clientX + 16}px, ${e.clientY + 14}px)`;
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, []);

  const o = hovered ? content.organelle(hovered.organelle) : undefined;
  return (
    <div ref={ref} className={styles.hover} data-visible={!!o} aria-hidden>
      {o && (
        <>
          <strong>{l(o.name)}</strong>
          <span>{l(o.tagline)}</span>
        </>
      )}
    </div>
  );
}
