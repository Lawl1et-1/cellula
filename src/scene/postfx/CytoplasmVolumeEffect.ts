import { BlendFunction, Effect, EffectAttribute } from 'postprocessing';
import {
  Color,
  Data3DTexture,
  LinearFilter,
  Matrix4,
  PerspectiveCamera,
  RedFormat,
  RepeatWrapping,
  Uniform,
  Vector3,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from 'three';
import { fbm3 } from '@/lib/noise';
import { CELL } from '../layout/cellLayout';
import { sharedUniforms } from '../shaders/organicMaterial';

/**
 * Raymarched cytoplasmic haze. Uses the depth buffer so the haze only accumulates between the
 * camera and the first surface, inside the cell, with the nucleus casting volumetric shadows.
 */
const fragmentShader = /* glsl */ `
precision highp sampler3D;
uniform sampler3D uNoise;
uniform mat4 uProjInv;
uniform mat4 uViewInv;
uniform vec3 uCamPos;
uniform vec3 uRadii;
uniform vec3 uNucleus;
uniform float uNucleusRadius;
uniform vec3 uKeyDirV;
uniform vec3 uLight;
uniform vec3 uHaze;
uniform float uDensity;
uniform float uTimeV;
uniform float uNear;
uniform float uFar;
uniform int uSteps;

vec2 hitEllipsoid(vec3 ro, vec3 rd, vec3 r) {
  vec3 o = ro / r, d = rd / r;
  float a = dot(d, d), b = dot(o, d), c = dot(o, o) - 1.0;
  float h = b * b - a * c;
  if (h < 0.0) return vec2(-1.0);
  h = sqrt(h);
  return vec2((-b - h) / a, (-b + h) / a);
}

bool hitsSphere(vec3 ro, vec3 rd, vec3 c, float r) {
  vec3 oc = ro - c;
  float b = dot(oc, rd);
  float h = b * b - (dot(oc, oc) - r * r);
  return h > 0.0 && -b + sqrt(h) > 0.0;
}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec4 clip = vec4(uv * 2.0 - 1.0, 1.0, 1.0);
  vec4 view = uProjInv * clip;
  vec3 rdView = normalize(view.xyz / view.w);
  vec3 rd = normalize((uViewInv * vec4(rdView, 0.0)).xyz);

  float viewZ = (uNear * uFar) / ((uFar - uNear) * depth - uFar);
  float sceneDist = depth >= 0.9999 ? 1e6 : viewZ / rdView.z;

  vec2 t = hitEllipsoid(uCamPos, rd, uRadii);
  float t0 = max(t.x, 0.0);
  float t1 = min(t.y, sceneDist);
  if (t.y < 0.0 || t1 <= t0) { outputColor = inputColor; return; }

  float dt = (t1 - t0) / float(uSteps);
  float jitter = hash12(gl_FragCoord.xy + fract(uTimeV * 7.13) * 100.0);
  float g = 0.55;
  float cosT = dot(rd, uKeyDirV);
  float phase = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * cosT, 1.5) * 0.08;

  float T = 1.0;
  vec3 acc = vec3(0.0);
  for (int i = 0; i < 64; i++) {
    if (i >= uSteps) break;
    vec3 p = uCamPos + rd * (t0 + (float(i) + jitter) * dt);
    vec3 q = p * 0.0055 + vec3(0.0, uTimeV * 0.006, uTimeV * 0.003);
    float n = texture(uNoise, q).r;
    float n2 = texture(uNoise, q * 3.1 + 0.37).r;
    float dens = smoothstep(0.3, 0.85, n * 0.75 + n2 * 0.35) * uDensity;
    float lit = hitsSphere(p, uKeyDirV, uNucleus, uNucleusRadius) ? 0.18 : 1.0;
    vec3 scatter = uHaze + uLight * phase * lit;
    float a = dens * dt;
    acc += T * a * scatter;
    T *= exp(-a * 0.6);
  }
  outputColor = vec4(inputColor.rgb * T + acc, inputColor.a);
}
`;

function createNoiseTexture(size = 64) {
  const data = new Uint8Array(size * size * size);
  const period = 4;
  for (let z = 0; z < size; z++)
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const s = period / size;
        const v = fbm3(x * s, y * s, z * s, 5, 4, period);
        data[x + y * size + z * size * size] = Math.max(0, Math.min(255, (v * 0.5 + 0.5) * 255));
      }
  const tex = new Data3DTexture(data, size, size, size);
  tex.format = RedFormat;
  tex.minFilter = tex.magFilter = LinearFilter;
  tex.wrapS = tex.wrapT = tex.wrapR = RepeatWrapping;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  return tex;
}

export class CytoplasmVolumeEffect extends Effect {
  private camera: PerspectiveCamera;

  constructor(camera: PerspectiveCamera, steps: number) {
    super('CytoplasmVolumeEffect', fragmentShader, {
      blendFunction: BlendFunction.NORMAL,
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, Uniform>([
        ['uNoise', new Uniform(createNoiseTexture())],
        ['uProjInv', new Uniform(new Matrix4())],
        ['uViewInv', new Uniform(new Matrix4())],
        ['uCamPos', new Uniform(new Vector3())],
        ['uRadii', new Uniform(CELL.radii.clone().multiplyScalar(0.985))],
        ['uNucleus', new Uniform(CELL.nucleus.center.clone())],
        ['uNucleusRadius', new Uniform(CELL.nucleus.radius)],
        ['uKeyDirV', new Uniform(sharedUniforms.uKeyDir.value)],
        ['uLight', new Uniform(new Color('#ffd9b0').multiplyScalar(1.4))],
        ['uHaze', new Uniform(new Color('#0d2a44').multiplyScalar(0.55))],
        ['uDensity', new Uniform(0.012)],
        ['uTimeV', new Uniform(0)],
        ['uNear', new Uniform(0.1)],
        ['uFar', new Uniform(2000)],
        ['uSteps', new Uniform(steps)],
      ]),
    });
    this.camera = camera;
  }

  set steps(v: number) {
    this.uniforms.get('uSteps')!.value = v;
  }

  override update(_renderer: WebGLRenderer, _input: WebGLRenderTarget, _delta?: number) {
    const c = this.camera;
    const u = this.uniforms;
    u.get('uProjInv')!.value.copy(c.projectionMatrixInverse);
    u.get('uViewInv')!.value.copy(c.matrixWorld);
    u.get('uCamPos')!.value.setFromMatrixPosition(c.matrixWorld);
    u.get('uNear')!.value = c.near;
    u.get('uFar')!.value = c.far;
    u.get('uTimeV')!.value = sharedUniforms.uTime.value;
  }
}
