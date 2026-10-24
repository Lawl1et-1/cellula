'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import {
  Bloom,
  ChromaticAberration,
  DepthOfField,
  EffectComposer,
  N8AO,
  Noise,
  SMAA,
  ToneMapping,
  Vignette,
} from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode, type DepthOfFieldEffect } from 'postprocessing';
import { PerspectiveCamera, Vector2 } from 'three';
import { usePreset } from '@/state/quality';
import { focusPoint } from '../camera/focus';
import { CytoplasmVolumeEffect } from './CytoplasmVolumeEffect';

function CytoplasmVolume({ steps }: { steps: number }) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const effect = useMemo(() => new CytoplasmVolumeEffect(camera, steps), [camera]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    effect.steps = steps;
  }, [effect, steps]);
  useEffect(() => () => effect.dispose(), [effect]);
  return <primitive object={effect} dispose={null} />;
}

/** The documentary look: AO → volumetric haze → depth of field → bloom → lens → AgX → vignette → grain. */
export function PostFX() {
  const preset = usePreset();
  const dof = useRef<DepthOfFieldEffect>(null);
  const caOffset = useMemo(() => new Vector2(0.0007, 0.0009), []);

  useEffect(() => {
    if (dof.current) dof.current.target = focusPoint;
  });

  return (
    <EffectComposer multisampling={0} key={`${preset.ao}-${preset.dof}-${preset.volumeSteps > 0}-${preset.chromatic}`}>
      <>{preset.ao && <N8AO aoRadius={8} distanceFalloff={1.5} intensity={2.2} quality="medium" halfRes />}</>
      <>{preset.volumeSteps > 0 && <CytoplasmVolume steps={preset.volumeSteps} />}</>
      <>
        {preset.dof && (
          <DepthOfField ref={dof} worldFocusRange={70} bokehScale={3.2} resolutionScale={0.5} />
        )}
      </>
      <Bloom mipmapBlur intensity={1.05} luminanceThreshold={0.55} luminanceSmoothing={0.35} radius={0.78} />
      <>
        {preset.chromatic && (
          <ChromaticAberration offset={caOffset} radialModulation modulationOffset={0.35} />
        )}
      </>
      <ToneMapping mode={ToneMappingMode.AGX} />
      {/* Grain and vignette act on display-referred values: before tone mapping, soft-light
          blending of HDR values > 1 goes negative and AgX turns it into cyan/blue holes. */}
      <Vignette offset={0.22} darkness={0.72} />
      <Noise blendFunction={BlendFunction.OVERLAY} opacity={0.09} />
      <SMAA />
    </EffectComposer>
  );
}
