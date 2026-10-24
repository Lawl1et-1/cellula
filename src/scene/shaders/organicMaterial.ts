import { AdditiveBlending, Color, DoubleSide, FrontSide, NormalBlending, ShaderMaterial, Vector2, Vector3 } from 'three';
import { commonChunks } from './chunks';

/** Uniform objects shared by reference across every material: updating them once updates the whole cell. */
export const sharedUniforms = {
  uTime: { value: 0 },
  uKeyDir: { value: new Vector3(0.55, 0.75, 0.35).normalize() },
  uKeyColor: { value: new Color('#ffe2c4').multiplyScalar(1.35) },
  uRimColor: { value: new Color('#5fd4ff').multiplyScalar(0.8) },
  uAmbient: { value: new Color('#1a2a44').multiplyScalar(0.35) },
  uFogColor: { value: new Color('#06101c') },
  uFogDensity: { value: 0.0016 },
  uCausticStrength: { value: 0.22 },
  /** Shading detail level from the quality preset (see QualityPreset.shading). */
  uDetail: { value: 2 },
  /** Size multiplier for molecular-scale objects ('artistic' vs 'real' scale). */
  uMolecularScale: { value: 1 },
};

/**
 * Surface patterns, evaluated in the object's local space so they stick to the surface while it moves.
 * Each must define `vec3 surface(inout float emissive)` returning the albedo.
 */
export const PATTERNS = {
  plain: /* glsl */ `
    vec3 surface(inout float emissive) {
      float n = fbm3(vLocal * uPatternScale + vSeed * 7.0);
      return mix(uColor, uColor2, smoothstep(-0.4, 0.6, n));
    }`,
  /** Mitochondria: inner membrane folds (cristae) glowing through the translucent outer membrane. */
  cristae: /* glsl */ `
    vec3 surface(inout float emissive) {
      // Lamellar cristae run across the long axis; slight warping keeps them organic.
      float warp = snoise(vLocal * vec3(0.25, 0.08, 0.25) + vSeed * 13.0) * 0.9;
      float tilt = vLocal.x * 0.35 * sin(vSeed * 20.0) + vLocal.z * 0.25 * cos(vSeed * 13.0);
      float folds = abs(sin((vLocal.y + tilt) * uPatternScale + warp + vSeed * 6.0));
      float ridge = smoothstep(0.94, 0.998, folds) * smoothstep(-0.6, 0.2, snoise(vLocal * 0.4 + vSeed * 4.0));
      float body = smoothstep(0.0, 0.6, 1.0 - folds);
      float pulse = 0.6 + 0.4 * sin(uTime * 1.1 + vSeed * 40.0 + vLocal.y * 0.2);
      // Seen from inside (cut-away), the real cristae take over: fade the painted ones.
      if (!gl_FrontFacing) { ridge *= 0.15; body *= 0.3; }
      // Inner glow (membrane potential) breathes behind the folds.
      emissive += (ridge * 0.6 + body * 0.15) * pulse;
      return mix(uColor, uColor2, ridge * 0.35);
    }`,
  /** Lysosomes: dense granular, partly digested content. */
  granular: /* glsl */ `
    vec3 surface(inout float emissive) {
      float g = snoise(vLocal * uPatternScale * 3.0 + vSeed * 9.0);
      float specks = smoothstep(0.45, 0.8, g);
      float body = fbm3(vLocal * uPatternScale + uTime * 0.05);
      emissive += smoothstep(0.2, 0.7, body) * 0.25;
      return mix(uColor, uColor2, specks * 0.7 + smoothstep(-0.3, 0.6, body) * 0.3);
    }`,
  /** Peroxisomes: crystalline urate-oxidase core glowing inside. */
  crystal: /* glsl */ `
    vec3 surface(inout float emissive) {
      vec3 V = normalize(cameraPosition - vWorld);
      float core = pow(clamp(dot(normalize(vNormal), V), 0.0, 1.0), 9.0);
      emissive += core * (0.8 + 0.2 * sin(uTime * 2.0 + vSeed * 30.0));
      return mix(uColor, uColor2, core * 0.6);
    }`,
  /** Chromatin and nucleolus: dense, softly glowing fibrous mass. */
  fibrous: /* glsl */ `
    vec3 surface(inout float emissive) {
      float n = fbm3(vLocal * uPatternScale + vec3(0.0, uTime * 0.04, 0.0));
      emissive += smoothstep(0.0, 0.7, n) * 0.6;
      return mix(uColor, uColor2, smoothstep(-0.5, 0.7, n));
    }`,
  /** Vertex-coloured geometry (Golgi cis → trans gradient, merged networks). */
  vertexColor: /* glsl */ `
    vec3 surface(inout float emissive) {
      float n = fbm3(vLocal * uPatternScale + vSeed);
      return vColor * mix(0.8, 1.15, smoothstep(-0.5, 0.5, n));
    }`,
} as const;
export type PatternName = keyof typeof PATTERNS;

export interface OrganicOptions {
  color: string;
  color2?: string;
  sssColor?: string;
  sss?: number;
  gloss?: number;
  emissive?: string;
  emissiveStrength?: number;
  pattern?: PatternName;
  patternScale?: number;
  /** Surface undulation amplitude (scene units) and frequency. */
  wobble?: number;
  wobbleFreq?: number;
  wobbleSpeed?: number;
  /** Per-instance Brownian drift amplitude (scene units). */
  drift?: number;
  /** Scale instances by the molecular-scale uniform (ribosomes, filaments). */
  molecular?: boolean;
  /** Bend capsule-like instances along their length (mitochondria). */
  bend?: number;
  transparent?: boolean;
  opacity?: number;
  /** Opacity contributed by the fresnel rim when transparent. */
  rimOpacity?: number;
  additive?: boolean;
  doubleSide?: boolean;
  /** Discard surface where noise exceeds the threshold (ER fenestrations). 0 = off. */
  holes?: number;
  /** Weight of direct diffuse light (lower = more translucent, glow-driven look). */
  diffuse?: number;
  rim?: number;
  vertexColors?: boolean;
  /** Per-vertex seed attribute (merged geometries) instead of per-instance. */
  vertexSeed?: boolean;
  /** Dynamic instability: discard beyond an animated length along uv.x (microtubules). */
  growth?: boolean;
  /** Instances shrink to nothing between these camera distances (macro-distance LOD). */
  fade?: [number, number];
  /** Cross-section opens when the camera comes within these distances of the instance. */
  cutaway?: [number, number];
  cutawayEdge?: string;
}

const vertexShader = /* glsl */ `
${commonChunks}
uniform float uWobble;
uniform float uWobbleFreq;
uniform float uWobbleSpeed;
uniform float uDrift;
uniform float uBend;
uniform float uMolecularScale;
uniform vec2 uFade;

#if defined(USE_SEED) || defined(USE_VERTEX_SEED)
attribute float aSeed;
#endif
#ifdef USE_COLOR
varying vec3 vColor;
#endif

varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vLocal;
varying float vSeed;
varying vec2 vUv;
#ifdef USE_CUTAWAY
varying vec3 vCenter;
#endif

void main() {
  float seed = 0.0;
  #if defined(USE_SEED) || defined(USE_VERTEX_SEED)
  seed = aSeed;
  #endif
  vSeed = seed;
  vUv = uv;
  #ifdef USE_COLOR
  vColor = color;
  #endif

  vec3 pos = position;
  vec3 nrm = normal;

  #ifdef USE_BEND
  float b = sin(pos.y * 0.16 + seed * 6.28 + uTime * 0.15) * uBend;
  pos.x += b;
  pos.z += cos(pos.y * 0.11 + seed * 3.0) * uBend * 0.5;
  #endif

  #ifdef USE_WOBBLE
  float w = snoise(pos * uWobbleFreq + vec3(seed * 17.0, uTime * uWobbleSpeed, seed * 5.0));
  pos += nrm * w * uWobble;
  #endif
  vLocal = pos;

  // Object centre in world space (drift included): drives distance LOD and cut-aways.
  #ifdef USE_INSTANCING
  vec3 center = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #else
  vec3 center = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  #endif
  vec3 drifted = vec3(0.0);
  #ifdef USE_SEED
  drifted = brownian(seed, uTime, uDrift);
  center += drifted;
  #endif
  #ifdef USE_CUTAWAY
  vCenter = center;
  #endif
  #ifdef USE_FADE
  // Collapsed triangles are discarded by the rasteriser: far instances cost almost nothing.
  pos *= 1.0 - smoothstep(uFade.x, uFade.y, length(cameraPosition - center));
  #endif

  #ifdef USE_MOLECULAR
  pos *= uMolecularScale;
  #endif

  vec4 wp = vec4(pos, 1.0);
  #ifdef USE_INSTANCING
  wp = instanceMatrix * wp;
  nrm = mat3(instanceMatrix) * nrm;
  #endif
  wp = modelMatrix * wp;
  wp.xyz += drifted;

  vNormal = normalize(mat3(modelMatrix) * nrm);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

function fragmentShader(pattern: PatternName) {
  return /* glsl */ `
${commonChunks}
uniform vec3 uColor;
uniform vec3 uColor2;
uniform vec3 uSssColor;
uniform vec3 uEmissive;
uniform float uEmissiveStrength;
uniform float uSss;
uniform float uGloss;
uniform float uPatternScale;
uniform float uOpacity;
uniform float uRimOpacity;
uniform float uHoles;
uniform vec2 uCutaway;
uniform vec3 uCutEdge;

#ifdef USE_COLOR
varying vec3 vColor;
#endif
varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vLocal;
varying float vSeed;
varying vec2 vUv;
#ifdef USE_CUTAWAY
varying vec3 vCenter;
#endif

${PATTERNS[pattern]}

void main() {
  #ifdef USE_HOLES
  if (snoise(vLocal * 0.22 + vSeed * 3.0) > uHoles) discard;
  #endif
  #ifdef USE_GROWTH
  float len = 0.72 + 0.28 * sin(uTime * (0.18 + hash11(vSeed * 13.0) * 0.25) + vSeed * 40.0);
  if (vUv.x > len) discard;
  #endif

  float edge = 0.0;
  #ifdef USE_CUTAWAY
  // A plane through the object, facing the camera, slides in as the camera approaches.
  vec3 toCam = cameraPosition - vCenter;
  float open = 1.0 - smoothstep(uCutaway.x, uCutaway.y, length(toCam));
  float cut = dot(vWorld - vCenter, normalize(toCam)) - mix(12.0, -0.4, open);
  if (cut > 0.0) discard;
  edge = smoothstep(-0.35, 0.0, cut) * step(0.001, open);
  #endif

  vec3 V = normalize(cameraPosition - vWorld);
  vec3 N = normalize(vNormal);
  if (!gl_FrontFacing) N = -N;

  // Fine wet bump from a single noise sample, using screen-space derivatives (surface gradient).
  if (uDetail > 1.5) {
    float h = snoise(vLocal * 0.9 + vec3(0.0, uTime * 0.2, 0.0)) * 0.05;
    vec3 dpdx = dFdx(vWorld), dpdy = dFdy(vWorld);
    vec3 r1 = cross(dpdy, N), r2 = cross(N, dpdx);
    float det = dot(dpdx, r1);
    vec3 grad = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
    N = normalize(abs(det) * N - grad);
  }

  float emissive = 0.0;
  vec3 albedo = surface(emissive);
  vec3 col = organicShade(albedo, N, V, vWorld, uSss, uSssColor, uGloss);
  col += uEmissive * emissive * uEmissiveStrength;
  col += uCutEdge * edge * 2.5;

  float dist = length(cameraPosition - vWorld);
  col = applyFog(col, dist);

  float alpha = 1.0;
  #ifdef USE_TRANSPARENT
  float fres = pow(1.0 - abs(dot(N, V)), 2.5);
  alpha = clamp(uOpacity + fres * uRimOpacity + edge, 0.0, 1.0);
  #endif
  gl_FragColor = vec4(col, alpha);
}
`;
}

export function createOrganicMaterial(o: OrganicOptions, instanced = false) {
  const defines: Record<string, string> = {};
  if (instanced) defines.USE_SEED = '';
  if (o.vertexSeed) defines.USE_VERTEX_SEED = '';
  if (o.bend) defines.USE_BEND = '';
  if (o.molecular) defines.USE_MOLECULAR = '';
  if (o.transparent) defines.USE_TRANSPARENT = '';
  if (o.holes) defines.USE_HOLES = '';
  if (o.growth) defines.USE_GROWTH = '';
  if (o.wobble) defines.USE_WOBBLE = '';
  if (o.fade) defines.USE_FADE = '';
  if (o.cutaway) defines.USE_CUTAWAY = '';

  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader: fragmentShader(o.pattern ?? 'plain'),
    defines,
    vertexColors: o.vertexColors ?? false,
    transparent: o.transparent ?? false,
    depthWrite: !o.transparent,
    blending: o.additive ? AdditiveBlending : NormalBlending,
    side: o.doubleSide ? DoubleSide : FrontSide,
    uniforms: {
      ...sharedUniforms,
      uColor: { value: new Color(o.color) },
      uColor2: { value: new Color(o.color2 ?? o.color) },
      uSssColor: { value: new Color(o.sssColor ?? o.color) },
      uEmissive: { value: new Color(o.emissive ?? '#000000') },
      uEmissiveStrength: { value: o.emissiveStrength ?? 0 },
      uSss: { value: o.sss ?? 0.5 },
      uGloss: { value: o.gloss ?? 0.6 },
      uPatternScale: { value: o.patternScale ?? 0.3 },
      uWobble: { value: o.wobble ?? 0 },
      uWobbleFreq: { value: o.wobbleFreq ?? 0.2 },
      uWobbleSpeed: { value: o.wobbleSpeed ?? 0.25 },
      uDrift: { value: o.drift ?? 0 },
      uBend: { value: o.bend ?? 0 },
      uOpacity: { value: o.opacity ?? 1 },
      uRimOpacity: { value: o.rimOpacity ?? 0 },
      uHoles: { value: o.holes ?? 1 },
      uDiffuse: { value: o.diffuse ?? 0.7 },
      uRimStrength: { value: o.rim ?? 1 },
      uFade: { value: new Vector2(...(o.fade ?? [1e5, 1e5 + 1])) },
      uCutaway: { value: new Vector2(...(o.cutaway ?? [0, 1])) },
      uCutEdge: { value: new Color(o.cutawayEdge ?? '#ffd2a0') },
    },
  });
  return material;
}
