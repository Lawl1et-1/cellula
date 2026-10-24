/**
 * Shared GLSL chunks. Every organic material uses the same light model so the whole cell reads as
 * one coherent, wet, translucent world.
 */

/* 3D simplex noise — Ashima Arts / Stefan Gustavson (MIT licence). */
export const noise = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

/* Two octaves only: simplex noise is the dominant per-pixel cost of the scene. */
float fbm3(vec3 p) {
  float n = snoise(p) * 0.67;
  if (uDetail > 1.5) n += snoise(p * 2.03 + 11.7) * 0.33;
  return n;
}

/* Very cheap smooth pseudo-noise (a handful of sines) for effects that only need organic motion. */
float trigNoise(vec3 p) {
  return sin(p.x * 1.7 + sin(p.y * 1.3 + p.z * 0.7)) *
         sin(p.y * 1.9 + sin(p.z * 1.1 + p.x * 0.5)) *
         sin(p.z * 1.5 + sin(p.x * 1.2 + p.y * 0.9));
}

`;

/** Uniforms shared by every organic material (one object, updated once per frame). */
export const sharedUniformsDecl = /* glsl */ `
uniform float uTime;
uniform vec3 uKeyDir;
uniform vec3 uKeyColor;
uniform vec3 uRimColor;
uniform vec3 uAmbient;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uCausticStrength;
uniform float uDetail;
/* Per-material weights of the light model. */
uniform float uDiffuse;
uniform float uRimStrength;
`;

/** Brownian-like drift: smooth, bounded, unique per seed. */
export const drift = /* glsl */ `
float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
vec3 hash31(float p) {
  vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xxy + p3.yzz) * p3.zyx);
}
vec3 brownian(float seed, float t, float amp) {
  vec3 h = hash31(seed * 91.7 + 3.1);
  return amp * vec3(
    sin(t * (0.31 + h.x * 0.4) + h.y * 6.28) + 0.5 * sin(t * (0.93 + h.z) + h.x * 12.0),
    sin(t * (0.27 + h.y * 0.4) + h.z * 6.28) + 0.5 * sin(t * (1.07 + h.x) + h.y * 12.0),
    sin(t * (0.35 + h.z * 0.4) + h.x * 6.28) + 0.5 * sin(t * (0.81 + h.y) + h.z * 12.0)
  ) / 1.5;
}
`;

/** Light refracted through the cytoplasm: thin bright ridges sliding over surfaces. */
export const caustics = /* glsl */ `
float causticPattern(vec3 p) {
  float t = uTime * 0.18;
  float a = 1.0 - abs(trigNoise(p * 0.07 + vec3(0.0, t, t * 0.6)));
  float b = 1.0 - abs(trigNoise(p * 0.13 + vec3(t * 0.7, -t, 3.1)));
  return pow(a, 18.0) * 0.7 + pow(a * b, 10.0) * 0.5;
}
`;

/** Wet, translucent, organic shading: wrap diffuse + back-scatter + fresnel rim + dual specular + caustics. */
export const organicLighting = /* glsl */ `
vec3 organicShade(vec3 albedo, vec3 N, vec3 V, vec3 P, float sss, vec3 sssColor, float gloss) {
  vec3 L = normalize(uKeyDir);
  float ndl = dot(N, L);
  float wrap = max((ndl + 0.6) / 1.6, 0.0);
  vec3 diffuse = albedo * uKeyColor * wrap * wrap * uDiffuse;

  vec3 Lb = normalize(L + N * 0.5);
  float back = pow(clamp(dot(V, -Lb), 0.0, 1.0), 2.5);
  float thin = pow(1.0 - abs(dot(N, V)), 1.5);
  vec3 scatter = sssColor * uKeyColor * (back * 0.9 + thin * 0.35) * sss;

  float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.0);
  vec3 rim = uRimColor * fres * uRimStrength;

  vec3 H = normalize(L + V);
  float nh = max(dot(N, H), 0.0);
  float spec = pow(nh, mix(24.0, 220.0, gloss)) * gloss * 2.2 + pow(nh, 10.0) * 0.05 * gloss;

  float c = uDetail > 0.5 ? causticPattern(P) * smoothstep(-0.2, 0.6, ndl) * uCausticStrength : 0.0;

  return uAmbient * albedo + diffuse + scatter + rim + uKeyColor * spec + albedo * uKeyColor * c;
}

vec3 applyFog(vec3 col, float dist) {
  float f = 1.0 - exp(-dist * dist * uFogDensity * uFogDensity);
  return mix(col, uFogColor, clamp(f, 0.0, 1.0));
}
`;

export const commonChunks = `${sharedUniformsDecl}\n${noise}\n${drift}\n${caustics}\n${organicLighting}`;
