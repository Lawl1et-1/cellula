'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor, Stats } from '@react-three/drei';
import type { Object3D } from 'three';
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

/**
 * Compiles every shader before the first frame without blocking the page (KHR_parallel_shader_compile:
 * the driver compiles on background threads while the intro is on screen). Hidden LOD layers are made
 * visible for the duration so close-ups never stutter later.
 */
function WarmUp({ onDone }: { onDone: () => void }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    let cancelled = false;
    const hidden: Object3D[] = [];
    scene.traverse((o) => {
      if (!o.visible) {
        hidden.push(o);
        o.visible = true;
      }
    });
    gl.compileAsync(scene, camera)
      .catch(() => undefined)
      .finally(() => {
        hidden.forEach((o) => (o.visible = false));
        if (!cancelled) onDone();
      });
    return () => {
      cancelled = true;
    };
  }, [gl, scene, camera, onDone]);
  return null;
}

export default function CellCanvas() {
  const preset = usePreset();
  // The canvas is client-only (loaded with ssr: false), so reading the URL at init is safe.
  const [stats] = useState(showStats);
  const [fx] = useState(() => !noFx());
  useEffect(() => initQuality(), []);
  // Nothing is rendered until the shaders are compiled (the page stays responsive meanwhile).
  const [compiled, setCompiled] = useState(false);
  const done = useCallback(() => setCompiled(true), []);

  return (
    <Canvas
      frameloop={compiled ? 'always' : 'never'}
      dpr={Math.min(typeof window === 'undefined' ? 1 : window.devicePixelRatio, preset.dpr) * preset.resolution}
      gl={{
        antialias: false,
        powerPreference: 'high-performance',
        stencil: false,
        toneMapping: NoToneMapping,
        outputColorSpace: SRGBColorSpace,
      }}
      camera={{ fov: 38, near: 0.1, far: 2400, position: [-90, 80, 560] }}
      onCreated={({ gl }) => {
        // Querying shader logs forces the driver to finish each compile synchronously, which defeats
        // parallel compilation (a cold first visit froze ~9 s). Errors are still reported in development.
        gl.debug.checkShaderErrors = process.env.NODE_ENV !== 'production';
      }}
      style={{ position: 'absolute', inset: 0 }}
      aria-label="Vue 3D interactive d'une cellule humaine"
    >
      <color attach="background" args={[PALETTE.background]} />
      <AdaptiveQuality />
      <Suspense fallback={null}>
        <CellScene />
        <WarmUp onDone={done} />
      </Suspense>
      <CameraRig />
      {fx ? <PostFX /> : <PlainRender />}
      {stats && <Stats />}
      {stats && <GpuTimer />}
    </Canvas>
  );
}
