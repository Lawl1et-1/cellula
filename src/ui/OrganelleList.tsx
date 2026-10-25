'use client';

import { useState } from 'react';
import { useL, useT } from '@/i18n/locale';
import { useSelection } from '@/state/selection';
import { useUi } from '@/state/ui';
import { useScenario } from '@/state/scenario';
import { cameraPosition } from '@/scene/camera/focus';
import { anchorFor } from '@/scene/interaction/anchors';
import { ORGANELLE_SWATCHES } from '@/scene/palette';
import { useContent } from './ContentContext';
import styles from './panel.module.css';

/** Keyboard-accessible index of every organelle; hovering an entry lights it up in the scene. */
export function OrganelleList() {
  const t = useT();
  const l = useL();
  const content = useContent();
  const selected = useSelection((s) => s.selected?.organelle);
  const select = useSelection((s) => s.select);
  const hover = useSelection((s) => s.hover);
  // Collapsed by default on small screens, where it would cover the cell.
  const [open, setOpen] = useState(() => typeof window === 'undefined' || window.innerWidth > 900);

  const libraryOpen = useUi((s) => s.libraryOpen);
  // The library drawer and the disease narration use the same space on the left…
  const diseasePlaying = useScenario((s) => s.scenario?.kind === 'disease');
  // So does the DNA close-up card.
  const dnaCloseup = useUi((s) => s.dnaLevel !== null);
  if (libraryOpen || diseasePlaying || dnaCloseup) return null;

  return (
    <nav className={`glass ${styles.list}`} aria-label={t.list.title} data-open={open}>
      <button className={styles.listToggle} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="label">{t.list.title}</span>
        <span aria-hidden>{open ? '–' : '+'}</span>
      </button>
      {open && (
        <ul>
          {ORGANELLE_SWATCHES.map(([id, color]) => {
            const o = content.organelle(id);
            if (!o) return null;
            return (
              <li key={id}>
                <button
                  className={styles.listItem}
                  aria-current={selected === id}
                  style={{ ['--dot' as string]: color }}
                  onClick={() => {
                    select(anchorFor(id, cameraPosition));
                    // On a phone the info sheet takes over the screen: fold the list away.
                    if (window.matchMedia('(max-width: 640px)').matches) setOpen(false);
                  }}
                  onMouseEnter={() => hover({ organelle: id })}
                  onMouseLeave={() => hover(null)}
                  onFocus={() => hover({ organelle: id })}
                  onBlur={() => hover(null)}
                >
                  {l(o.name)}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
