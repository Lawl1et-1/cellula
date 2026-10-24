'use client';

import { Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr, PerformanceMonitor } from '@react-three/drei';
import { NoToneMapping, SRGBColorSpace } from 'three';
import type { QualityLevel } from '@/engine/quality/presets';
import { initQuality, useQuality, usePreset } from '@/state/quality';
import { PALETTE } from './palette';
import { CellScene } from './CellScene';
import { CameraRig } from './camera/CameraRig';
import { PostFX } from './postfx/PostFX';

const ORDER: QualityLevel[] = ['low', 'medium', 'high', 'ultra'];

/** Steps quality down when the frame rate collapses (never up beyond the user's choice). */
function AdaptiveQuality() {
  const step = (dir: -1 | 1) => {
    const { level, locked, setLevel } = useQuality.getState();
    if (locked) return;
    const next = ORDER[Math.min(Math.max(ORDER.indexOf(level) + dir, 0), ORDER.length - 2)];
    if (next && next !== level) setLevel(next);
  };
  return <PerformanceMonitor flipflops={3} onDecline={() => step(-1)} onIncline={() => step(1)} />;
}

export default function CellCanvas() {
  const preset = usePreset();
  useEffect(() => initQuality(), []);

  return (
    <Canvas
      dpr={[1, preset.dpr]}
      gl={{
        antialias: false,
        powerPreference: 'high-performance',
        stencil: false,
        toneMapping: NoToneMapping,
        outputColorSpace: SRGBColorSpace,
      }}
      camera={{ fov: 38, near: 0.1, far: 2400, position: [40, 140, 1150] }}
      style={{ position: 'absolute', inset: 0 }}
      aria-label="Vue 3D interactive d'une cellule humaine"
    >
      <color attach="background" args={[PALETTE.background]} />
      <AdaptiveQuality />
      <AdaptiveDpr pixelated={false} />
      <Suspense fallback={null}>
        <CellScene />
      </Suspense>
      <CameraRig />
      <PostFX />
    </Canvas>
  );
}
