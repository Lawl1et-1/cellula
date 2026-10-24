'use client';

import { useFrame } from '@react-three/fiber';
import { easing } from 'maath';
import { sharedUniforms } from './shaders/organicMaterial';
import { useScene } from '@/state/scene';
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
  useFrame((state, delta) => {
    const u = sharedUniforms;
    u.uTime.value = state.clock.elapsedTime;
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
    </>
  );
}
