'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { easing } from 'maath';
import { sharedUniforms } from './shaders/organicMaterial';
import { useScene } from '@/state/scene';
import { updateHighlights } from './interaction/highlight';
import { liveChannels } from '@/engine/timeline/live';
import { PickTargets } from './interaction/PickTargets';
import { ScenarioActors } from './actors/ScenarioActors';
import { useQuality } from '@/state/quality';
import { QUALITY_PRESETS } from '@/engine/quality/presets';
import { Membrane } from './organelles/Membrane';
import { Nucleus } from './organelles/Nucleus';
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
    u.uTime.value = state.clock.elapsedTime;
    u.uDetail.value = QUALITY_PRESETS[useQuality.getState().level].shading;
    updateHighlights(delta);
    easing.damp(u.uDim, 'value', liveChannels['view.focusDim'], 0.4, delta);
    const target = MOLECULAR_SCALE[useScene.getState().scaleMode];
    easing.damp(u.uMolecularScale, 'value', target, 0.35, delta);
  });
  return null;
}

export function CellScene() {
  return (
    <>
      <Clock />
      <Nucleus />
      <EndoplasmicReticulum />
      <Golgi />
      <Mitochondria />
      <SmallOrganelles />
      <Cytoskeleton />
      <Cytoplasm />
      <Membrane />
      <PickTargets />
      <ScenarioActors />
    </>
  );
}
