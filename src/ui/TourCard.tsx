'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useL, useT } from '@/i18n/locale';
import { useSelection } from '@/state/selection';
import { useTour } from '@/state/tour';
import { cameraPosition } from '@/scene/camera/focus';
import { anchorFor } from '@/scene/interaction/anchors';
import { Claim } from './Claim';
import { useContent } from './ContentContext';
import { SourceLine } from './SourceLine';
import styles from './player.module.css';

/** Guided tour: frames each organelle in turn and narrates its sourced summary. */
export function TourCard() {
  const t = useT();
  const l = useL();
  const tour = useTour((s) => s.tour);
  const step = useTour((s) => s.step);
  const playing = useTour((s) => s.playing);
  const { go, setPlaying, stop } = useTour.getState();
  const content = useContent();
  const current = tour?.steps[step];

  // Frame the organelle of each step.
  useEffect(() => {
    if (!current) return;
    useSelection.getState().frame(anchorFor(current.focus, cameraPosition));
  }, [current]);

  // Autoplay.
  useEffect(() => {
    if (!current || !playing) return;
    const id = setTimeout(() => go(step + 1), current.seconds * 1000);
    return () => clearTimeout(id);
  }, [current, playing, step, go]);

  // Leaving the tour releases the camera and the spotlight.
  useEffect(() => {
    if (!tour) useSelection.getState().frame(null, null);
  }, [tour]);

  if (!tour || !current) return null;
  const organelle = content.organelle(current.focus);
  const claim = current.text ?? organelle?.summary;

  return (
    <motion.section
      className={`glass ${styles.tour}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      aria-label={l(tour.name)}
      aria-live="polite"
    >
      <div className={styles.tourHead}>
        <span className="label">
          {l(tour.name)} · {step + 1}/{tour.steps.length}
        </span>
        <button className={styles.closeBtn} onClick={stop} aria-label={t.player.close}>
          ×
        </button>
      </div>
      <motion.div key={step} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
        <h3 className={styles.stageTitle}>{organelle && l(organelle.name)}</h3>
        {claim && (
          <>
            <Claim claim={claim} />
            <SourceLine claim={claim} />
          </>
        )}
      </motion.div>
      <div className={styles.progress} aria-hidden>
        {tour.steps.map((s, i) => (
          <span key={i} data-done={i <= step} />
        ))}
      </div>
      <div className={styles.tourControls}>
        <button onClick={() => go(step - 1)} disabled={step === 0}>
          ← {t.player.prev}
        </button>
        <button onClick={() => setPlaying(!playing)}>{playing ? t.player.pause : t.player.play}</button>
        <button onClick={() => go(step + 1)}>
          {step === tour.steps.length - 1 ? t.player.finish : t.player.next} →
        </button>
      </div>
    </motion.section>
  );
}
