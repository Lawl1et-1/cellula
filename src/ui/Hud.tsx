'use client';

import { motion } from 'framer-motion';
import { QUALITY_PRESETS, type QualityLevel } from '@/engine/quality/presets';
import { fr } from '@/i18n/fr';
import { useQuality } from '@/state/quality';
import { useScene, type CameraMode, type ScaleMode } from '@/state/scene';
import { useSelection } from '@/state/selection';
import { useScenario } from '@/state/scenario';
import { useTour } from '@/state/tour';
import { useUi } from '@/state/ui';
import { usePhone, useTouch } from './usePhone';
import styles from './ui.module.css';

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}

function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className={styles.control} role="radiogroup" aria-label={label}>
      <span className="label">{label}</span>
      <div className={styles.segmented}>
        {options.map((o) => (
          <button
            key={o.value}
            role="radio"
            aria-checked={value === o.value}
            className={styles.segment}
            data-active={value === o.value}
            onClick={() => onChange(o.value)}
          >
            {value === o.value && (
              <motion.span
                layoutId={`seg-${label}`}
                className={styles.segmentPill}
                transition={{ type: 'spring', stiffness: 420, damping: 36 }}
              />
            )}
            <span className={styles.segmentText}>{o.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const fade = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { delay: 1.2, duration: 0.8, ease: [0.22, 1, 0.36, 1] as const } },
  exit: { opacity: 0 },
};

export function Hud() {
  const mode = useScene((s) => s.cameraMode);
  const setMode = useScene((s) => s.setCameraMode);
  const scale = useScene((s) => s.scaleMode);
  const setScale = useScene((s) => s.setScaleMode);
  const level = useQuality((s) => s.level);
  const motionMode = useScene((s) => s.motion);
  const setMotion = useScene((s) => s.setMotion);
  const setLevel = useQuality((s) => s.setLevel);
  const phone = usePhone();
  const touchDevice = useTouch();
  const settingsOpen = useUi((s) => s.settingsOpen);
  const setSettingsOpen = useUi((s) => s.setSettingsOpen);
  // On a phone, the bottom of the screen belongs to whatever is open (panel, player, tour, library).
  const hasSelection = useSelection((s) => !!s.selected);
  const hasScenario = useScenario((s) => !!s.scenario);
  const hasTour = useTour((s) => !!s.tour);
  const libraryOpen = useUi((s) => s.libraryOpen);
  const busy = hasSelection || hasScenario || hasTour || libraryOpen;
  const showDock = !phone || (settingsOpen && !busy);

  return (
    <motion.div className={styles.hud} {...fade}>
      <header className={styles.topbar}>
        <span className={styles.wordmark}>{fr.brand}</span>
        <span className={`label ${styles.scaleChip}`} title={fr.hud.scaleNote}>
          {scale === 'artistic'
            ? `${fr.hud.scale} ${fr.hud.artistic.toLowerCase()}`
            : `${fr.hud.scale} ${fr.hud.real.toLowerCase()}`}
        </span>
      </header>

      {phone && !busy && (
        <button
          className={`glass ${styles.settingsButton}`}
          aria-expanded={settingsOpen}
          onClick={() => setSettingsOpen(!settingsOpen)}
        >
          {settingsOpen ? fr.hud.closeSettings : fr.hud.settings}
        </button>
      )}

      {showDock && (
        <div className={`glass ${styles.dock}`}>
          {/* Free flight needs a keyboard: not offered on touch devices. */}
          {!touchDevice && (
            <>
              <Segmented<CameraMode>
                label={fr.hud.camera}
                value={mode}
                onChange={setMode}
                options={[
                  { value: 'orbit', label: fr.hud.orbit },
                  { value: 'flight', label: fr.hud.flight },
                ]}
              />
              <span className={styles.divider} aria-hidden />
            </>
          )}
          <Segmented<ScaleMode>
            label={fr.hud.scale}
            value={scale}
            onChange={setScale}
            options={[
              { value: 'artistic', label: fr.hud.artistic },
              { value: 'real', label: fr.hud.real },
            ]}
          />
          <span className={styles.divider} aria-hidden />
          <Segmented<'normal' | 'reduced' | 'paused'>
            label={fr.hud.motion}
            value={motionMode}
            onChange={setMotion}
            options={[
              { value: 'normal', label: fr.hud.motionNormal },
              { value: 'reduced', label: fr.hud.motionReduced },
              { value: 'paused', label: fr.hud.motionPaused },
            ]}
          />
          <span className={styles.divider} aria-hidden />
          <Segmented<QualityLevel>
            label={fr.hud.quality}
            value={level}
            onChange={(l) => setLevel(l, true)}
            options={(Object.keys(QUALITY_PRESETS) as QualityLevel[]).map((k) => ({
              value: k,
              label: QUALITY_PRESETS[k].label,
            }))}
          />
        </div>
      )}

      <p className={styles.help}>{mode === 'flight' ? fr.hud.flightHelp : fr.hud.orbitHelp}</p>
      <p className={styles.disclaimer}>{fr.hud.disclaimer}</p>
    </motion.div>
  );
}
