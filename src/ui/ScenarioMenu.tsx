'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { fr } from '@/i18n/fr';
import { useScenario } from '@/state/scenario';
import { useSelection } from '@/state/selection';
import { useTour } from '@/state/tour';
import { useScene } from '@/state/scene';
import { useContent } from './ContentContext';
import styles from './player.module.css';

/** Entry points: the guided tour and the animated processes. */
export function ScenarioMenu() {
  const content = useContent();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const running = useScenario((s) => s.process?.id);

  // Deep link: `?process=<id>&t=0.4` opens a process paused at that moment (sharing, review captures).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const p = content.processes.find((x) => x.id === params.get('process'));
    if (!p) return;
    useScenario.getState().start(p);
    const t = Number(params.get('t'));
    if (params.has('t') && Number.isFinite(t)) {
      useScenario.getState().setT(t);
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
          {fr.menu.tour}
        </button>
      )}
      <button className={`glass ${styles.menuButton}`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {fr.menu.processes} <span aria-hidden>▾</span>
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
                    useScenario.getState().start(p);
                    setOpen(false);
                  }}
                >
                  <strong>{p.name.fr}</strong>
                  <span>{p.summary.text.fr}</span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
