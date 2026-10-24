'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { fr } from '@/i18n/fr';
import { useSelection } from '@/state/selection';
import { useUi } from '@/state/ui';
import { CELL } from '@/scene/layout/cellLayout';
import { cameraPosition } from '@/scene/camera/focus';
import { anchorFor } from '@/scene/interaction/anchors';
import { Claim } from './Claim';
import { useContent } from './ContentContext';
import { SourceLine } from './SourceLine';
import styles from './player.module.css';

/** DNA compaction close-up: steps from the double helix to the condensed chromosome. */
export function DnaStepper() {
  const level = useUi((s) => s.dnaLevel);
  const setLevel = useUi((s) => s.setDnaLevel);
  const selected = useSelection((s) => s.selected?.organelle);
  const levels = useContent().organelle('dna')?.zoomLevels ?? [];
  const open = level !== null;

  // Opening frames the magnified models; closing hands the camera back to the DNA selection.
  useEffect(() => {
    if (!open) return;
    const c = CELL.nucleus.center;
    // Narrow screens: the card covers the lower half, so aim below the models to lift them on screen.
    const narrow = window.innerWidth <= 900;
    useSelection
      .getState()
      .frame({ organelle: 'dna', position: [c.x, c.y - (narrow ? 7 : 0), c.z], radius: narrow ? 19 : 12 }, 'dna');
    return () => {
      // Back to the regular DNA framing, just outside the (faded) envelope.
      const back = useSelection.getState().selected?.organelle === 'dna';
      useSelection.getState().frame(back ? anchorFor('dna', cameraPosition) : null, null);
    };
  }, [open]);

  // Leaving DNA (another organelle, closing the panel) closes the close-up.
  useEffect(() => {
    if (selected !== 'dna') setLevel(null);
  }, [selected, setLevel]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setLevel(Math.min(levels.length - 1, (level ?? 0) + 1));
      if (e.key === 'ArrowLeft') setLevel(Math.max(0, (level ?? 0) - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, level, levels.length, setLevel]);

  const current = level !== null ? levels[level] : undefined;
  if (!current || level === null) return null;

  return (
    <motion.section
      className={`glass ${styles.tour} ${styles.dna}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      aria-label={fr.dna.title}
      aria-live="polite"
    >
      <div className={styles.tourHead}>
        <span className="label">
          {fr.dna.title} · {level + 1}/{levels.length}
        </span>
        <button className={styles.closeBtn} onClick={() => setLevel(null)} aria-label={fr.dna.close}>
          ×
        </button>
      </div>
      <motion.div key={current.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
        <h3 className={styles.stageTitle}>{current.title.fr}</h3>
        <p className={styles.scale}>{current.scale.fr}</p>
        <Claim claim={current.claim} />
        <SourceLine claim={current.claim} />
      </motion.div>
      <div className={styles.progress} role="tablist" aria-label={fr.dna.levels}>
        {levels.map((l, i) => (
          <button
            key={l.id}
            role="tab"
            aria-selected={i === level}
            aria-label={l.title.fr}
            data-done={i <= level}
            onClick={() => setLevel(i)}
          />
        ))}
      </div>
      <div className={styles.tourControls}>
        <button onClick={() => setLevel(level - 1)} disabled={level === 0}>
          ← {fr.dna.finer}
        </button>
        <button onClick={() => setLevel(level + 1)} disabled={level === levels.length - 1}>
          {fr.dna.coarser} →
        </button>
      </div>
    </motion.section>
  );
}
