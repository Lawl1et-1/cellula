'use client';

import { useMemo } from 'react';
import {
  Color,
  ConeGeometry,
  DoubleSide,
  IcosahedronGeometry,
  Matrix4,
  Quaternion,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createRng } from '@/lib/random';
import { CELL } from '../layout/cellLayout';
import { PALETTE } from '../palette';
import { commonChunks, vertexChunks } from '../shaders/chunks';
import { sharedUniforms, type OrganicOptions } from '../shaders/organicMaterial';
import { InstancedOrganelle } from './Instanced';
import { useHighlight } from '../interaction/highlight';
import { useFrame } from '@react-three/fiber';
import { liveChannels } from '@/engine/timeline/live';
import { usePreset } from '@/state/quality';

/** Static large-scale lumps of the membrane, shared by the mesh and the receptors that sit on it. */
export function membraneLump(d: Vector3) {
  return (
    0.035 * Math.sin(3.1 * d.x + 1.2) * Math.sin(2.7 * d.y + 0.4) * Math.sin(3.3 * d.z + 2.1) +
    0.018 * Math.sin(6.3 * d.x + 2.0) * Math.sin(5.1 * d.z + 0.3) +
    0.012 * Math.sin(8.7 * d.y + 1.1)
  );
}

export function membranePoint(d: Vector3, out = new Vector3()) {
  return out.copy(d).multiplyScalar(1 + membraneLump(d)).multiply(CELL.radii);
}

const membraneVertex = /* glsl */ `
${vertexChunks}
varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vDir;
uniform float uCleave;
uniform float uBleb;
uniform vec3 uRadii;
void main() {
  vec3 dir = normalize(position);
  vDir = dir;
  float undulate = snoise(dir * 2.6 + vec3(0.0, uTime * 0.07, 0.0)) * 0.9
                 + snoise(dir * 7.0 - vec3(uTime * 0.05)) * 0.35;
  vec3 pos = position + normal * undulate;
  // Blebbing (apoptosis, cytoskeleton damage): rounded bulges of membrane.
  if (uBleb > 0.001) pos += normal * uBleb * pow(max(0.0, snoise(dir * 5.5 + 3.1)), 2.0) * 22.0;
  // Cytokinesis: a furrow pinches the cell across the spindle axis (x), which also lengthens.
  float d = pos.x / uRadii.x;
  pos.yz *= 1.0 - uCleave * 0.94 * exp(-d * d * 14.0);
  pos.x *= 1.0 + uCleave * 0.18;
  vec4 wp = modelMatrix * vec4(pos, 1.0);
  vWorld = wp.xyz;
  vNormal = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const membraneFragment = /* glsl */ `
${commonChunks}
uniform vec3 uBase;
uniform vec3 uRim;
uniform vec3 uFilm;
uniform float uHighlight;
uniform float uIntegrity;
varying vec3 vNormal;
varying vec3 vWorld;
varying vec3 vDir;

void main() {
  // Loss of membrane integrity (necrosis, pore-forming toxins): holes open in the bilayer.
  if (uIntegrity < 0.999 && trigNoise(vDir * 9.0) > uIntegrity * 2.2 - 1.0) discard;
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 N = normalize(vNormal);
  bool inside = !gl_FrontFacing;
  if (inside) N = -N;

  float ndv = clamp(abs(dot(N, V)), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 3.0);

  // Thin-film interference: the lipid bilayer's pearly sheen.
  // The membrane covers the whole screen from inside: keep its shader cheap (trig noise only).
  float film = trigNoise(vDir * 6.0 + uTime * 0.03) * 0.5 + 0.5;
  vec3 irid = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + film * 0.8 + ndv * 1.3));
  irid = mix(vec3(1.0), irid, 0.35) * uFilm;

  // Lipid rafts and embedded proteins: fine mottled speckle.
  float rafts = 0.0;
  float proteins = 0.0;
  if (!inside && uDetail > 0.5) {
    rafts = smoothstep(0.3, 0.8, trigNoise(vDir * 30.0 + uTime * 0.03));
    proteins = smoothstep(0.75, 0.98, trigNoise(vDir * 120.0));
  }

  vec3 L = normalize(uKeyDir);
  float ndl = dot(N, L);
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 160.0) * 1.8;
  float c = uDetail > 1.5 ? causticPattern(vWorld) * uCausticStrength : 0.0;

  vec3 col = uBase * (0.06 + 0.25 * max(ndl, 0.0))
           + uRim * fres * 1.25
           + irid * fres * 0.6
           + uKeyColor * spec
           + uBase * c * 0.25
           + uBase * (rafts * 0.05 + proteins * 0.12);

  col += vec3(0.55, 0.9, 1.0) * fres * uHighlight * 1.4;
  float alpha = 0.035 + fres * 0.72 + rafts * 0.03 + proteins * 0.06 + spec * 0.3 + uHighlight * fres * 0.2;
  if (inside) alpha *= 0.55;
  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}
`;

const RECEPTOR: OrganicOptions = {
  color: PALETTE.receptor.a,
  color2: PALETTE.receptor.b,
  sss: 0.6,
  gloss: 0.5,
  patternScale: 2,
  molecular: true,
  emissive: PALETTE.receptor.a,
  emissiveStrength: 0.15,
  fade: [200, 320],
};

function receptorGeometry() {
  const stalk = new ConeGeometry(0.22, 1.6, 5, 1);
  stalk.translate(0, 0.8, 0);
  const head = new SphereGeometry(0.55, 8, 6);
  head.scale(1, 0.7, 1);
  head.translate(0, 1.7, 0);
  return mergeGeometries([stalk.toNonIndexed(), head.toNonIndexed()])!;
}

export function Membrane() {
  const preset = usePreset();
  // Linear subdivision count (three.js r125+): 56 → ~63k faces.
  const detail = preset.geometryDetail >= 1 ? 56 : 36;

  const { geometry, material } = useMemo(() => {
    const ico = new IcosahedronGeometry(1, detail);
    ico.deleteAttribute('normal');
    ico.deleteAttribute('uv');
    // Polyhedron geometry is non-indexed: weld it so displaced normals stay smooth.
    const geometry = mergeVertices(ico);
    const pos = geometry.attributes.position!;
    const d = new Vector3();
    for (let i = 0; i < pos.count; i++) {
      d.fromBufferAttribute(pos, i).normalize();
      membranePoint(d, d);
      pos.setXYZ(i, d.x, d.y, d.z);
    }
    geometry.computeVertexNormals();
    const material = new ShaderMaterial({
      vertexShader: membraneVertex,
      fragmentShader: membraneFragment,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      uniforms: {
        ...sharedUniforms,
        uBase: { value: new Color(PALETTE.membrane.base) },
        uRim: { value: new Color(PALETTE.membrane.rim) },
        uFilm: { value: new Color(PALETTE.membrane.film) },
        uHighlight: { value: 0 },
        uHighlightId: { value: -1 },
        uCleave: { value: 0 },
        uBleb: { value: 0 },
        uIntegrity: { value: 1 },
        uRadii: { value: CELL.radii.clone() },
      },
    });
    return { geometry, material };
  }, [detail]);

  const receptors = useMemo(() => {
    const rng = createRng(4242);
    const matrices: Matrix4[] = [];
    const seeds: number[] = [];
    const d = new Vector3();
    const p = new Vector3();
    const n = new Vector3();
    const up = new Vector3(0, 1, 0);
    // Room for up to 4× more receptors (overexpression, e.g. HER2); healthy cells draw the first quarter.
    for (let i = 0; i < preset.receptors * 4; i++) {
      rng.direction(d);
      membranePoint(d, p);
      n.set(p.x / CELL.radii.x ** 2, p.y / CELL.radii.y ** 2, p.z / CELL.radii.z ** 2).normalize();
      const q = new Quaternion().setFromUnitVectors(up, n);
      const s = rng.range(0.35, 0.65);
      matrices.push(new Matrix4().compose(p.addScaledVector(n, 0.3), q, new Vector3(s, s * rng.range(0.8, 1.4), s)));
      seeds.push(rng.next());
    }
    return { matrices, seeds, geometry: receptorGeometry() };
  }, [preset.receptors]);

  useHighlight('plasma-membrane', material);
  useFrame(() => {
    material.uniforms.uCleave!.value = liveChannels['cell.cleavage'];
    material.uniforms.uBleb!.value = liveChannels['membrane.blebbing'];
    material.uniforms.uIntegrity!.value = liveChannels['membrane.integrity'];
  });

  return (
    <group name="plasma-membrane">
      <InstancedOrganelle
        key={receptors.seeds.length}
        geometry={receptors.geometry}
        material={RECEPTOR}
        matrices={receptors.matrices}
        seeds={receptors.seeds}
        visibleCount={() => preset.receptors * liveChannels['membrane.receptorDensity']}
      />
      <mesh geometry={geometry} material={material} renderOrder={10} />
    </group>
  );
}
