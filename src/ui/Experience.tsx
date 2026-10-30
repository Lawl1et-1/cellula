'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useScene } from '@/state/scene';
import { IntroOverlay } from './IntroOverlay';
import { Hud } from './Hud';
import { ContentProvider } from './ContentContext';
import { InfoPanel } from './InfoPanel';
import { OrganelleList } from './OrganelleList';
import { HoverLabel } from './HoverLabel';
import { ScenarioMenu } from './ScenarioMenu';
import { StepPlayer } from './StepPlayer';
import { SceneTags } from './SceneTags';
import { HandController, HandStatus, HandTutorial } from './HandMode';
import { TourCard } from './TourCard';
import { DnaStepper } from './DnaStepper';
import { DiseasePanel } from './DiseasePanel';
import { DiseaseLibrary } from './DiseaseLibrary';
import { Announcer } from './Announcer';
import { NoWebGL } from './NoWebGL';
import { LanguageSwitch } from './LanguageSwitch';
import { PageMeta } from './PageMeta';
import { DICTIONARIES } from '@/i18n/locale';
import type { ExplorerContent } from '@/content/bundle';

const CellCanvas = dynamic(() => import('@/scene/CellCanvas'), { ssr: false });

export function Experience({ intro, content }: { intro: boolean; content: ExplorerContent }) {
  const mode = useScene((s) => s.cameraMode);
  const setCameraMode = useScene((s) => s.setCameraMode);
  const ready = useScene((s) => s.ready);

  useEffect(() => {
    if (!intro) setCameraMode('orbit');
  }, [intro, setCameraMode]);

  // Checked once on the client: without WebGL 2, show a text version instead of a black screen.
  const [webgl, setWebgl] = useState<boolean | null>(null);
  useEffect(() => {
    let ok = false;
    try {
      ok = !!document.createElement('canvas').getContext('webgl2');
    } catch {
      ok = false;
    }
    setWebgl(ok); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  // The landing page keeps the site title; /explorer has its own.
  const meta = intro ? undefined : { fr: DICTIONARIES.fr.meta.explorer, en: DICTIONARIES.en.meta.explorer };

  if (webgl === false) {
    return (
      <ContentProvider content={content}>
        <PageMeta title={meta} />
        <NoWebGL />
      </ContentProvider>
    );
  }

  return (
    <ContentProvider content={content}>
      <PageMeta title={meta} />
      <main style={{ position: 'fixed', inset: 0 }}>
        {/* The scene fades in once its shaders are compiled instead of popping in. */}
        <div
          style={{ position: 'absolute', inset: 0, opacity: ready ? 1 : 0, transition: 'opacity 1.6s ease' }}
        >
          <CellCanvas />
        </div>
        <SceneTags />
        <AnimatePresence mode="wait">
          {mode === 'intro' ? (
            <IntroOverlay key="intro" onEnter={() => setCameraMode('orbit')} />
          ) : (
            <Hud key="hud" />
          )}
        </AnimatePresence>
        <LanguageSwitch />
        {mode !== 'intro' && (
          <>
            <OrganelleList />
            <InfoPanel />
            <HoverLabel />
            <ScenarioMenu />
            <Announcer />
            <DiseasePanel />
            <DiseaseLibrary />
            <AnimatePresence>
              <StepPlayer key="focus" />
            </AnimatePresence>
            <AnimatePresence>
              <TourCard key="tour" />
            </AnimatePresence>
            <AnimatePresence>
              <DnaStepper key="dna" />
            </AnimatePresence>
            <HandController />
            <HandStatus />
            <HandTutorial />
          </>
        )}
      </main>
    </ContentProvider>
  );
}
