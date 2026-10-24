'use client';

import { motion } from 'framer-motion';
import { stageIndexAt } from '@/engine/timeline/evaluate';
import { fr } from '@/i18n/fr';
import { useScenario } from '@/state/scenario';
import { useSelection } from '@/state/selection';
import { Claim } from './Claim';
import { SourceLine } from './SourceLine';
import styles from './player.module.css';

const SPEEDS = [0.5, 1, 2];

/** Timeline scrubber + narration for a running process (and, in Phase 3, a disease). */
export function ProcessPlayer() {
  const process = useScenario((s) => s.scenario);
  const t = useScenario((s) => s.t);
  const playing = useScenario((s) => s.playing);
  const speed = useScenario((s) => s.speed);
  const { setT, setPlaying, setSpeed, stop } = useScenario.getState();

  if (!process) return null;
  const stageIndex = stageIndexAt(process.stages, t);
  const stage = process.stages[stageIndex]!;

  const close = () => {
    stop();
    useSelection.getState().frame(null, null);
  };

  return (
    <motion.section
      className={styles.player}
      data-with-panel={process.kind === 'disease'}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      aria-label={process.name.fr}
    >
      <motion.div key={stage.id} className={`glass ${styles.narration}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <span className="label">
          {process.name.fr} · {fr.player.stage} {stageIndex + 1}/{process.stages.length}
        </span>
        <h3 className={styles.stageTitle}>{stage.title.fr}</h3>
        <Claim claim={stage.description} />
        <SourceLine claim={stage.description} />
      </motion.div>

      <div className={`glass ${styles.transport}`}>
        <button className={styles.play} onClick={() => setPlaying(!playing)} aria-label={playing ? fr.player.pause : fr.player.play}>
          {playing ? '❚❚' : '▶'}
        </button>

        <div className={styles.timeline}>
          <div className={styles.stages}>
            {process.stages.map((s, i) => (
              <button
                key={s.id}
                className={styles.stage}
                data-active={i === stageIndex}
                style={{ left: `${s.range[0] * 100}%`, width: `${(s.range[1] - s.range[0]) * 100}%` }}
                onClick={() => setT(s.range[0] + 0.001)}
                title={s.title.fr}
              >
                <span>{s.title.fr}</span>
              </button>
            ))}
          </div>
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(t * 1000)}
            onChange={(e) => {
              setPlaying(false);
              setT(Number(e.target.value) / 1000);
            }}
            aria-label={fr.player.scrub}
            className={styles.range}
            style={{ ['--p' as string]: `${t * 100}%` }}
          />
        </div>

        <div className={styles.speeds} role="radiogroup" aria-label={fr.player.speed}>
          {SPEEDS.map((v) => (
            <button key={v} role="radio" aria-checked={speed === v} data-active={speed === v} onClick={() => setSpeed(v)}>
              {v}×
            </button>
          ))}
        </div>

        <button className={styles.closeBtn} onClick={close} aria-label={fr.player.close}>
          ×
        </button>
      </div>
    </motion.section>
  );
}
