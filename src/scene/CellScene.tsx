'use client';

import { useRef } from 'react';
import type { Group } from 'three';
import { useFrame } from '@react-three/fiber';
import { easing } from 'maath';
import { sharedUniforms } from './shaders/organicMaterial';
import { useScene } from '@/state/scene';
import { useUi } from '@/state/ui';
import { useScenario } from '@/state/scenario';
import { timeScale } from './time';
import { updateHighlights } from './interaction/highlight';
import { applyDiseaseLooks } from './disease/bindings';
import { liveChannels } from '@/engine/timeline/live';
import { PickTargets } from './interaction/PickTargets';
import { ScenarioActors } from './actors/ScenarioActors';
import { MrnaExport } from './actors/MrnaExport';
import { Heroes } from './actors/Heroes';
import { DiseaseParticles } from './disease/DiseaseParticles';
import { useQuality } from '@/state/quality';
import { QUALITY_PRESETS } from '@/engine/quality/presets';
import { Membrane } from './organelles/Membrane';
import { Nucleus } from './organelles/Nucleus';
import { DnaCompaction, DnaZoom } from './organelles/DnaCompaction';
import { dnaZoom } from './interaction/zoom';
import { projectLabels } from './actors/labels';
import { EndoplasmicReticulum } from './organelles/EndoplasmicReticulum';
import { Golgi } from './organelles/Golgi';
import { SmallOrganelles } from './organelles/SmallOrganelles';
import { Mitochondria } from './organelles/Mitochondria';
import { Cytoskeleton } from './organelles/Cytoskeleton';
import { Cytoplasm } from './organelles/Cytoplasm';

/** Molecular-scale objects are ×2.5 in artistic scale so they read from afar. */
const MOLECULAR_SCALE = { artistic: 1, real: 0.4 };

/** Drives the global clock and scene-wide uniforms; composes every organelle. */
function Clock() {
  const frames = useRef(0);
  useFrame((state, delta) => {
    if (++frames.current === 4) {
      useScene.setState({ ready: true });
      (window as unknown as { __cellulaReady: boolean }).__cellulaReady = true;
    }
    const u = sharedUniforms;
    // Ambient life slows down (reduced motion) or stops (paused); scenarios keep their own clock.
    u.uTime.value += Math.min(delta, 0.1) * timeScale();
    u.uDetail.value = QUALITY_PRESETS[useQuality.getState().level].shading;
    updateHighlights(delta);
    applyDiseaseLooks(delta);
    // The DNA close-up dims the rest of the cell like a scenario focus.
    // Focus mode (a process or disease is playing) ghosts whatever the current step does not involve.
    const closeup = useUi.getState().dnaLevel !== null ? 0.9 : 0;
    const focusMode = useScenario.getState().scenario ? 0.85 : 0;
    const zoom = dnaZoom.value * 0.92;
    easing.damp(u.uDim, 'value', Math.max(liveChannels['view.focusDim'], closeup, focusMode, zoom), 0.6, delta);
    projectLabels(state.camera, state.size.width, state.size.height);
    const target = MOLECULAR_SCALE[useScene.getState().scaleMode];
    easing.damp(u.uMolecularScale, 'value', target, 0.35, delta);
  });
  return null;
}

/** Apoptotic cells shrink as a whole (cell.shrinkage). */
function Body({ children }: { children: React.ReactNode }) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    ref.current?.scale.setScalar(1 - 0.3 * liveChannels['cell.shrinkage']);
  });
  return <group ref={ref}>{children}</group>;
}

export function CellScene() {
  return (
    <>
      <Clock />
      <Body>
        <Nucleus />
        <DnaCompaction />
        <DnaZoom />
        <EndoplasmicReticulum />
        <Golgi />
        <Mitochondria />
        <SmallOrganelles />
        <Cytoskeleton />
        <Cytoplasm />
        <Membrane />
      </Body>
      <PickTargets />
      <ScenarioActors />
      <MrnaExport />
      <Heroes />
      <DiseaseParticles />
    </>
  );
}
