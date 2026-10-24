'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useScene } from '@/state/scene';
import { IntroOverlay } from './IntroOverlay';
import { Hud } from './Hud';

const CellCanvas = dynamic(() => import('@/scene/CellCanvas'), { ssr: false });

export function Experience({ intro }: { intro: boolean }) {
  const mode = useScene((s) => s.cameraMode);
  const setCameraMode = useScene((s) => s.setCameraMode);
  const ready = useScene((s) => s.ready);

  useEffect(() => {
    if (!intro) setCameraMode('orbit');
  }, [intro, setCameraMode]);

  return (
    <main style={{ position: 'fixed', inset: 0 }}>
      {/* The scene fades in once its shaders are compiled instead of popping in. */}
      <div style={{ position: 'absolute', inset: 0, opacity: ready ? 1 : 0, transition: 'opacity 1.6s ease' }}>
        <CellCanvas />
      </div>
      <AnimatePresence mode="wait">
        {mode === 'intro' ? <IntroOverlay key="intro" onEnter={() => setCameraMode('orbit')} /> : <Hud key="hud" />}
      </AnimatePresence>
    </main>
  );
}
