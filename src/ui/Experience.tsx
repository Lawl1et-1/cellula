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

  useEffect(() => {
    if (!intro) setCameraMode('orbit');
  }, [intro, setCameraMode]);

  return (
    <main style={{ position: 'fixed', inset: 0 }}>
      <CellCanvas />
      <AnimatePresence mode="wait">
        {mode === 'intro' ? <IntroOverlay key="intro" onEnter={() => setCameraMode('orbit')} /> : <Hud key="hud" />}
      </AnimatePresence>
    </main>
  );
}
