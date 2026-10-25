'use client';

import { motion } from 'framer-motion';
import { stageIndexAt } from '@/engine/timeline/evaluate';
import { useL, useT } from '@/i18n/locale';
import { useScenario } from '@/state/scenario';
import { useSelection } from '@/state/selection';
import { Claim } from './Claim';
import { SourceLine } from './SourceLine';
import { useUi } from '@/state/ui';
import { usePhone } from './usePhone';
import styles from './player.module.css';

const SPEEDS = [0.5, 1, 2];

/** Timeline scrubber + narration for a running process (and, in Phase 3, a disease). */
export function ProcessPlayer() {
  const t = useT();
  const l = useL();
  const process = useScenario((s) => s.scenario);
  const time = useScenario((s) => s.t);
  const playing = useScenario((s) => s.playing);
  const speed = useScenario((s) => s.speed);
  const { setT, setPlaying, setSpeed, stop } = useScenario.getState();
  const phone = usePhone();
  const setSheet = useUi((s) => s.setDiseaseSheet);

  if (!process) return null;
  const stageIndex = stageIndexAt(process.stages, time);
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
      aria-label={l(process.name)}
    >
      <motion.div key={stage.id} className={`glass ${styles.narration}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <span className="label">
          {l(process.name)} · {t.player.stage} {stageIndex + 1}/{process.stages.length}
        </span>
        <h3 className={styles.stageTitle}>{l(stage.title)}</h3>
        <Claim claim={stage.description} />
        <SourceLine claim={stage.description} />
      </motion.div>

      <div className={`glass ${styles.transport}`}>
        <button className={styles.play} onClick={() => setPlaying(!playing)} aria-label={playing ? t.player.pause : t.player.play}>
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
                title={l(s.title)}
              >
                <span>{l(s.title)}</span>
              </button>
            ))}
          </div>
          <input
            type="range"
            min={0}
            max={1000}
            value={Math.round(time * 1000)}
            onChange={(e) => {
              setPlaying(false);
              setT(Number(e.target.value) / 1000);
            }}
            aria-label={t.player.scrub}
            className={styles.range}
            style={{ ['--p' as string]: `${time * 100}%` }}
          />
        </div>

        {phone && process.kind === 'disease' && (
          <button className={styles.sheetButton} onClick={() => setSheet(true)}>
            {t.diseases.sheet}
          </button>
        )}
        <div className={styles.speeds} role="radiogroup" aria-label={t.player.speed}>
          {SPEEDS.map((v) => (
            <button key={v} role="radio" aria-checked={speed === v} data-active={speed === v} onClick={() => setSpeed(v)}>
              {v}×
            </button>
          ))}
        </div>

        <button className={styles.closeBtn} onClick={close} aria-label={t.player.close}>
          ×
        </button>
      </div>
    </motion.section>
  );
}
