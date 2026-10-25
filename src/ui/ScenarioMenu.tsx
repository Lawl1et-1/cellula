'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useL, useT } from '@/i18n/locale';
import { useScenario } from '@/state/scenario';
import { useSelection } from '@/state/selection';
import { useTour } from '@/state/tour';
import { useScene } from '@/state/scene';
import { useUi } from '@/state/ui';
import { useContent } from './ContentContext';
import styles from './player.module.css';

/** Entry points: the guided tour and the animated processes. */
export function ScenarioMenu() {
  const t = useT();
  const l = useL();
  const content = useContent();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const running = useScenario((s) => s.scenario?.id);
  const libraryOpen = useUi((s) => s.libraryOpen);
  const setLibraryOpen = useUi((s) => s.setLibraryOpen);

  // Deep link: `?process=<id>&t=0.4` opens a process paused at that moment (sharing, review captures).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = content.processes.find((x) => x.id === params.get('process'));
    if (!p) return;
    useScenario.getState().start({ kind: 'process', ...p });
    const at = Number(params.get('t'));
    if (params.has('t') && Number.isFinite(at)) {
      useScenario.getState().setT(at);
      useScenario.getState().setPlaying(false);
    }
  }, [content.processes]);

  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);

  const prepare = () => {
    useSelection.getState().select(null);
    useTour.getState().stop();
    useScenario.getState().stop();
    if (useScene.getState().cameraMode === 'flight') useScene.getState().setCameraMode('orbit');
  };

  return (
    <div className={styles.menu} ref={ref}>
      {content.tours[0] && (
        <button
          className={`glass ${styles.menuButton}`}
          onClick={() => {
            prepare();
            useTour.getState().start(content.tours[0]!);
          }}
        >
          {t.menu.tour}
        </button>
      )}
      <button className={`glass ${styles.menuButton}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {t.menu.processes} <span aria-hidden>▾</span>
      </button>
      <button
        className={`glass ${styles.menuButton} ${styles.menuAccent}`}
        aria-expanded={libraryOpen}
        onClick={() => setLibraryOpen(!libraryOpen)}
      >
        {t.menu.diseases}
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul
            className={`glass ${styles.dropdown}`}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
          >
            {content.processes.map((p) => (
              <li key={p.id}>
                <button
                  aria-current={running === p.id}
                  onClick={() => {
                    prepare();
                    useScenario.getState().start({ kind: 'process', ...p });
                    setOpen(false);
                  }}
                >
                  <strong>{l(p.name)}</strong>
                  <span>{l(p.summary.text)}</span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
