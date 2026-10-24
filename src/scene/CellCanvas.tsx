'use client';

import { Suspense, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerformanceMonitor, Preload, Stats } from '@react-three/drei';
import { NoToneMapping, SRGBColorSpace } from 'three';
import type { QualityLevel } from '@/engine/quality/presets';
import { initQuality, useQuality, usePreset } from '@/state/quality';
import { PALETTE } from './palette';
import { CellScene } from './CellScene';
import { CameraRig } from './camera/CameraRig';
import { PostFX } from './postfx/PostFX';
import { GpuTimer } from './GpuTimer';

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
const hasParam = (name: string) => typeof window !== 'undefined' && new URLSearchParams(window.location.search).has(name);
const showStats = () => hasParam('stats');
/** `?nofx` disables post-processing (profiling). */
const noFx = () => hasParam('nofx');

/** Without the composer, something must still render once other callbacks have taken over the loop. */
function PlainRender() {
  useFrame(({ gl, scene, camera }) => gl.render(scene, camera), 1);
  return null;
}

export default function CellCanvas() {
  const preset = usePreset();
  // The canvas is client-only (loaded with ssr: false), so reading the URL at init is safe.
  const [stats] = useState(showStats);
  const [fx] = useState(() => !noFx());
  useEffect(() => initQuality(), []);

  return (
    <Canvas
      dpr={Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio, preset.dpr) * preset.resolution}
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
      <Suspense fallback={null}>
        <CellScene />
        {/* Compiles every shader up front (incl. hidden LOD layers) so close-ups never stutter. */}
        <Preload all />
      </Suspense>
      <CameraRig />
      {fx ? <PostFX /> : <PlainRender />}
      {stats && <Stats />}
      {stats && <GpuTimer />}
    </Canvas>
  );
}
