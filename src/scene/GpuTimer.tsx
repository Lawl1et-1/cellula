'use client';

import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

interface TimerExt {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

/**
 * Measures real GPU time per frame with EXT_disjoint_timer_query_webgl2 (independent of the display's
 * refresh cap). The rolling average is shown in a small overlay and exposed as `window.__cellulaGpuMs`.
 */
export function GpuTimer() {
  const gl = useThree((s) => s.gl.getContext()) as WebGL2RenderingContext;
  const state = useMemo(() => {
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerExt | null;
    const el = document.createElement('div');
    Object.assign(el.style, {
      position: 'fixed',
      top: '52px',
      left: '0',
      padding: '4px 8px',
      font: '11px/1.3 ui-monospace, monospace',
      color: '#8fe3ff',
      background: 'rgba(0,10,20,0.8)',
      zIndex: '10',
      pointerEvents: 'none',
    });
    return { ext, el, pending: [] as WebGLQuery[], active: null as WebGLQuery | null, samples: [] as number[] };
  }, [gl]);

  const scene = useThree((s) => s.scene);
  useEffect(() => {
    document.body.appendChild(state.el);
    // Debug handle for profiling (toggle groups from the console). Stats mode only.
    (window as unknown as { __cellulaScene: unknown }).__cellulaScene = scene;
    return () => state.el.remove();
  }, [state, scene]);

  // Runs before the scene and the composer (negative priority).
  useFrame(() => {
    const { ext } = state;
    if (!ext || state.active) return;
    const q = gl.createQuery();
    if (!q) return;
    gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
    state.active = q;
  }, -1000);

  // Runs after the composer has rendered (priority 1), then collects finished queries.
  useFrame(() => {
    const { ext } = state;
    if (!ext) {
      state.el.textContent = 'GPU: timer non disponible';
      return;
    }
    if (state.active) {
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      state.pending.push(state.active);
      state.active = null;
    }
    const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
    while (state.pending.length) {
      const q = state.pending[0]!;
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      if (!disjoint) state.samples.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
      gl.deleteQuery(q);
      state.pending.shift();
    }
    if (state.samples.length > 60) state.samples.splice(0, state.samples.length - 60);
    if (state.samples.length) {
      const avg = state.samples.reduce((a, b) => a + b, 0) / state.samples.length;
      (window as unknown as { __cellulaGpuMs: number }).__cellulaGpuMs = avg;
      state.el.textContent = `GPU ${avg.toFixed(1)} ms · budget 60 fps = 16.7 ms`;
    }
  }, 1000);

  return null;
}
