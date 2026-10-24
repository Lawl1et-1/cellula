'use client';

import { useMemo } from 'react';
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, ShaderMaterial, Vector3 } from 'three';
import { useThree } from '@react-three/fiber';
import { createRng } from '@/lib/random';
import { randomCytoplasmPoint } from '../layout/cellLayout';
import { PALETTE } from '../palette';
import { drift, sharedUniformsDecl } from '../shaders/chunks';
import { sharedUniforms } from '../shaders/organicMaterial';
import { usePreset } from '@/state/quality';

/**
 * Thousands of macromolecules and metabolites. Motion is entirely in the vertex shader:
 * Brownian jitter + cytoplasmic streaming (a slow divergence-free swirl around the cell).
 */
const vertexShader = /* glsl */ `
${sharedUniformsDecl}
${drift}
uniform float uPixelRatio;
uniform float uSize;
attribute float aSeed;
attribute vec3 aColor;
varying vec3 vColor;
varying float vFade;

/* Cheap swirling flow (no noise lookups: this runs for every particle, every frame). */
vec3 flow(vec3 p, float t) {
  return vec3(
    sin(p.y * 0.031 + t * 0.21) + sin(p.z * 0.047 - t * 0.13),
    sin(p.z * 0.029 + t * 0.17) + sin(p.x * 0.043 + t * 0.11),
    sin(p.x * 0.033 - t * 0.19) + sin(p.y * 0.041 + t * 0.15)
  );
}

void main() {
  vec3 p = position;
  // Streaming: rotate slowly around the vertical axis, faster near the cortex.
  float r = length(p.xz);
  float ang = uTime * 0.012 * (0.4 + r / 120.0) + aSeed * 0.02;
  float c = cos(ang), s = sin(ang);
  p.xz = mat2(c, -s, s, c) * p.xz;
  p += flow(p, uTime) * 2.4;
  p += brownian(aSeed * 311.0, uTime * 2.2, 0.9);

  vec4 mv = viewMatrix * modelMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = -mv.z;
  // Capped: huge sprites right at the lens are pure overdraw.
  gl_PointSize = min(uSize * uPixelRatio * (0.6 + aSeed) * (300.0 / max(depth, 1.0)), 18.0 * uPixelRatio);
  // Fade particles that get too close to the lens or too far into the fog.
  vFade = smoothstep(2.0, 14.0, depth) * (1.0 - smoothstep(220.0, 400.0, depth));
  vColor = aColor;
}
`;

const fragmentShader = /* glsl */ `
varying vec3 vColor;
varying float vFade;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d);
  if (r > 0.5) discard;
  float core = smoothstep(0.5, 0.0, r);
  gl_FragColor = vec4(vColor * core * core * vFade, 1.0);
}
`;

export function Cytoplasm() {
  const preset = usePreset();
  const dpr = useThree((s) => s.viewport.dpr);

  const { geometry, material } = useMemo(() => {
    const rng = createRng(2024);
    const n = preset.particles;
    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const seeds = new Float32Array(n);
    const p = new Vector3();
    const palette = PALETTE.particles.map((c) => new Color(c));
    for (let i = 0; i < n; i++) {
      randomCytoplasmPoint(rng, p, -3);
      positions.set([p.x, p.y, p.z], i * 3);
      const col = rng.pick(palette).clone().multiplyScalar(rng.range(0.15, 0.55));
      colors.set([col.r, col.g, col.b], i * 3);
      seeds[i] = rng.next();
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new BufferAttribute(colors, 3));
    geometry.setAttribute('aSeed', new BufferAttribute(seeds, 1));
    const material = new ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      uniforms: { ...sharedUniforms, uPixelRatio: { value: dpr }, uSize: { value: 1.6 } },
    });
    return { geometry, material };
  }, [preset.particles, dpr]);

  return <points geometry={geometry} material={material} frustumCulled={false} renderOrder={8} />;
}
