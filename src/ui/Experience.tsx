'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useScene } from '@/state/scene';
import { IntroOverlay } from './IntroOverlay';
import { Hud } from './Hud';
import { ContentProvider } from './ContentContext';
import { InfoPanel } from './InfoPanel';
import { OrganelleList } from './OrganelleList';
import { HoverLabel } from './HoverLabel';
import { ScenarioMenu } from './ScenarioMenu';
import { ProcessPlayer } from './ProcessPlayer';
import { TourCard } from './TourCard';
import type { ExplorerContent } from '@/content/bundle';

const CellCanvas = dynamic(() => import('@/scene/CellCanvas'), { ssr: false });

export function Experience({ intro, content }: { intro: boolean; content: ExplorerContent }) {
  const mode = useScene((s) => s.cameraMode);
  const setCameraMode = useScene((s) => s.setCameraMode);
  const ready = useScene((s) => s.ready);

  useEffect(() => {
    if (!intro) setCameraMode('orbit');
  }, [intro, setCameraMode]);

  return (
    <ContentProvider content={content}>
      <main style={{ position: 'fixed', inset: 0 }}>
        {/* The scene fades in once its shaders are compiled instead of popping in. */}
        <div
          style={{ position: 'absolute', inset: 0, opacity: ready ? 1 : 0, transition: 'opacity 1.6s ease' }}
        >
          <CellCanvas />
        </div>
        <AnimatePresence mode="wait">
          {mode === 'intro' ? (
            <IntroOverlay key="intro" onEnter={() => setCameraMode('orbit')} />
          ) : (
            <Hud key="hud" />
          )}
        </AnimatePresence>
        {mode !== 'intro' && (
          <>
            <OrganelleList />
            <InfoPanel />
            <HoverLabel />
            <ScenarioMenu />
            <AnimatePresence>
              <ProcessPlayer key="process" />
            </AnimatePresence>
            <AnimatePresence>
              <TourCard key="tour" />
            </AnimatePresence>
          </>
        )}
      </main>
    </ContentProvider>
  );
}
