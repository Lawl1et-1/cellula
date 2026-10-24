'use client';

import { Suspense, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { AdaptiveDpr, PerformanceMonitor, Stats } from '@react-three/drei';
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

/** `?stats` shows an FPS / frame-time panel. */
const showStats = () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('stats');

export default function CellCanvas() {
  const preset = usePreset();
  // The canvas is client-only (loaded with ssr: false), so reading the URL at init is safe.
  const [stats] = useState(showStats);
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
      camera={{ fov: 38, near: 0.1, far: 2400, position: [-90, 80, 560] }}
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
      {stats && <Stats />}
    </Canvas>
  );
}
