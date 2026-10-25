'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { enlargement } from '@/content/heroScale';
import { stageIndexAt } from '@/engine/timeline/evaluate';
import { useL, useT } from '@/i18n/locale';
import { STEP_EPSILON, useScenario } from '@/state/scenario';
import { useSelection } from '@/state/selection';
import { useUi } from '@/state/ui';
import { stageFocus } from '@/scene/actors/anchors';
import { Claim } from './Claim';
import { SourceLine } from './SourceLine';
import styles from './focus.module.css';

/**
 * Focus mode: a disease or process told one step at a time. The reader moves at their own pace
 * (Previous / Play / Next, or the step dots); autoplay chains the steps. Exit restores the whole cell.
 */
export function StepPlayer() {
  const t = useT();
  const l = useL();
  const scenario = useScenario((s) => s.scenario);
  const time = useScenario((s) => s.t);
  const playing = useScenario((s) => s.playing);
  const autoplay = useScenario((s) => s.autoplay);
  const { setPlaying, setAutoplay, goToStep, stop } = useScenario.getState();
  const unlocked = useUi((s) => s.cameraUnlocked);
  const setUnlocked = useUi((s) => s.setCameraUnlocked);
  const details = useUi((s) => s.diseaseSheet);
  const setDetails = useUi((s) => s.setDiseaseSheet);

  const index = scenario ? stageIndexAt(scenario.stages, time) : 0;
  const count = scenario?.stages.length ?? 0;

  // Keyboard: ← → between steps, space to play or pause, Esc to leave (unless a panel is open).
  useEffect(() => {
    if (!scenario) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input, textarea, select, button')) return;
      if (e.key === 'ArrowRight') goToStep(index + 1);
      else if (e.key === 'ArrowLeft') goToStep(index - 1);
      else if (e.key === ' ') {
        e.preventDefault();
        setPlaying(!useScenario.getState().playing);
      } else if (e.key === 'Escape' && !useSelection.getState().selected && !useUi.getState().diseaseSheet) exit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!scenario) return null;
  const stage = scenario.stages[index]!;
  const [a, b] = stage.range;
  const stepProgress = Math.min(1, Math.max(0, (time - a) / (b - a)));
  const atEnd = !playing && stepProgress >= 1 - (2 * STEP_EPSILON) / (b - a);
  const notes = stage.heroes
    .map((h) => ({ n: enlargement(h.model), name: h.label ? l(h.label) : null }))
    .filter((x): x is { n: number; name: string | null } => x.n !== null)
    .filter((x, i, all) => all.findIndex((y) => y.name === x.name && y.n === x.n) === i);

  function exit() {
    stop();
    setDetails(false);
    useSelection.getState().frame(null, null);
  }

  return (
    <motion.section
      className={styles.root}
      data-with-panel={details && scenario.kind === 'disease'}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      aria-label={l(scenario.name)}
    >
      <motion.div
        key={stage.id}
        className={`glass ${styles.caption}`}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.5 } }}
        aria-live="polite"
      >
        <span className="label">
          {l(scenario.name)} · {t.focus.step(index + 1, count)}
        </span>
        <h3 className={styles.title}>{l(stage.title)}</h3>
        <Claim claim={stage.description} />
        <SourceLine claim={stage.description} />
        {notes.length > 0 && (
          <p className={styles.notes}>
            {notes.map((x) => (
              <span key={`${x.name}-${x.n}`}>{x.name ? t.focus.enlarged(x.name, x.n) : t.focus.enlargedGeneric(x.n)}</span>
            ))}
          </p>
        )}
      </motion.div>

      <div className={`glass ${styles.bar}`}>
        <div className={styles.transport}>
          <button className={styles.round} onClick={() => goToStep(index - 1)} disabled={index === 0} aria-label={t.focus.prev}>
            ‹
          </button>
          <button
            className={`${styles.round} ${styles.play}`}
            onClick={() => setPlaying(!playing)}
            aria-label={playing ? t.focus.pause : atEnd ? t.focus.replay : t.focus.play}
          >
            {playing ? '❚❚' : atEnd ? '↻' : '▶'}
          </button>
          <button
            className={styles.round}
            onClick={() => goToStep(index + 1)}
            disabled={index === count - 1}
            aria-label={t.focus.next}
          >
            ›
          </button>
        </div>

        <div className={styles.steps}>
          <span className={styles.counter}>{t.focus.step(index + 1, count)}</span>
          <ol className={styles.dots} aria-label={t.focus.steps}>
            {scenario.stages.map((s, i) => (
              <li key={s.id}>
                <button
                  data-state={i < index ? 'done' : i === index ? 'current' : 'todo'}
                  aria-current={i === index ? 'step' : undefined}
                  aria-label={t.focus.goTo(i + 1, l(s.title))}
                  title={l(s.title)}
                  onClick={() => goToStep(i)}
                  style={i === index ? { ['--p' as string]: `${stepProgress * 100}%` } : undefined}
                />
              </li>
            ))}
          </ol>
        </div>

        <div className={styles.options}>
          <button className={styles.toggle} aria-pressed={autoplay} title={t.focus.autoplayHint} onClick={() => setAutoplay(!autoplay)}>
            {t.focus.autoplay}
          </button>
          <button
            className={styles.toggle}
            aria-pressed={unlocked}
            onClick={() => {
              setUnlocked(!unlocked);
              // Locking again flies back to the step's framing.
              if (unlocked && stage.focus) useSelection.getState().frame(stageFocus(stage.focus, stage.camera), null);
            }}
          >
            {unlocked ? t.focus.lock : t.focus.unlock}
          </button>
          {scenario.kind === 'disease' && (
            <button className={styles.toggle} aria-pressed={details} onClick={() => setDetails(!details)}>
              {t.focus.details}
            </button>
          )}
          <button className={styles.exit} onClick={exit} aria-label={t.focus.exitLabel}>
            {t.focus.exit} ×
          </button>
        </div>
      </div>
    </motion.section>
  );
}
