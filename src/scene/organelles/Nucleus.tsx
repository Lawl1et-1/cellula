'use client';

import { useMemo } from 'react';
import {
  BufferAttribute,
  CylinderGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  IcosahedronGeometry,
  Matrix4,
  Quaternion,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createRng, fibonacciSphere } from '@/lib/random';
import { CELL } from '../layout/cellLayout';
import { PALETTE } from '../palette';
import { createOrganicMaterial, type OrganicOptions } from '../shaders/organicMaterial';
import { InstancedOrganelle } from './Instanced';
import { useHighlight } from '../interaction/highlight';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group } from 'three';
import { liveChannels } from '@/engine/timeline/live';
import { usePreset } from '@/state/quality';
import { useSelection } from '@/state/selection';
import { useUi } from '@/state/ui';

const OUTER_ENVELOPE: OrganicOptions = {
  color: PALETTE.nucleus.envelope,
  color2: PALETTE.nucleus.envelope2,
  sssColor: PALETTE.nucleus.envelope2,
  sss: 0.8,
  gloss: 0.85,
  patternScale: 0.12,
  wobble: 0.55,
  wobbleFreq: 0.09,
  transparent: true,
  // Opaque enough to read as a surface up close; chromatin stays a soft shape behind it.
  opacity: 0.5,
  rimOpacity: 0.6,
  diffuse: 0.6,
  rim: 1.6,
};

const INNER_ENVELOPE: OrganicOptions = {
  ...OUTER_ENVELOPE,
  opacity: 0.08,
  rimOpacity: 0.35,
  gloss: 0.3,
};

const PORE: OrganicOptions = {
  fade: [140, 220],
  color: PALETTE.nucleus.envelope2,
  color2: PALETTE.nucleus.pore,
  sss: 0.5,
  gloss: 0.7,
  patternScale: 1.5,
  emissive: PALETTE.nucleus.pore,
  emissiveStrength: 0.9,
};

const EUCHROMATIN: OrganicOptions = {
  color: PALETTE.chromatin.a,
  color2: PALETTE.chromatin.b,
  sssColor: PALETTE.chromatin.b,
  emissive: PALETTE.chromatin.glow,
  emissiveStrength: 0.5,
  pattern: 'fibrous',
  patternScale: 0.3,
  sss: 0.9,
  gloss: 0.35,
  wobble: 0.1,
  wobbleFreq: 0.5,
  vertexSeed: true,
};

/** Heterochromatin: more compact, darker, less glow (largely silent). */
const HETEROCHROMATIN: OrganicOptions = {
  ...EUCHROMATIN,
  color: PALETTE.chromatin.hetero,
  color2: PALETTE.chromatin.a,
  emissiveStrength: 0.18,
  gloss: 0.5,
  wobble: 0.06,
};

/** UV-type lesions on the chromatin (channel dna.damage). */
const LESION: OrganicOptions = {
  color: '#fff1b0',
  emissive: '#ffd66b',
  emissiveStrength: 2.2,
  sss: 0.5,
  gloss: 0.6,
  dimmable: false,
};

/** One highlighted locus: a point mutation (channel dna.mutation). */
const MUTATION: OrganicOptions = {
  color: '#ff5a4a',
  emissive: '#ff3a2a',
  emissiveStrength: 2.6,
  sss: 0.6,
  gloss: 0.6,
  wobble: 0.3,
  wobbleFreq: 1.2,
  wobbleSpeed: 1.5,
  dimmable: false,
};

const NUCLEOLUS: OrganicOptions = {
  color: PALETTE.nucleolus.a,
  color2: PALETTE.nucleolus.b,
  sssColor: PALETTE.nucleolus.b,
  emissive: PALETTE.nucleolus.glow,
  emissiveStrength: 0.7,
  // Dense, granular: the nucleolus reads as a distinct region inside the chromatin.
  pattern: 'granular',
  patternScale: 1.1,
  sss: 1,
  gloss: 0.4,
  wobble: 0.7,
  wobbleFreq: 0.28,
  wobbleSpeed: 0.12,
};

/** Torus whose tube swells eight times around the ring: the eight spokes of a pore complex ring. */
function eightFoldRing(radius: number, tube: number, z: number) {
  const g = new TorusGeometry(radius, tube, 10, 48);
  const pos = g.attributes.position!;
  const p = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const a = Math.atan2(p.y, p.x);
    const swell = 1 + 0.35 * Math.max(0, Math.cos(a * 8));
    const ring = new Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0);
    p.sub(ring).multiplyScalar(swell).add(ring);
    pos.setXYZ(i, p.x, p.y, p.z + z);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * Nuclear pore complex (~120 nm): cytoplasmic and nuclear eight-fold rings, a central channel and the
 * distal ring of the nuclear basket. Local +Z points out of the nucleus.
 */
function poreComplexGeometry() {
  const parts: BufferGeometry[] = [
    eightFoldRing(0.55, 0.17, 0.2),
    eightFoldRing(0.55, 0.15, -0.2),
    new CylinderGeometry(0.34, 0.34, 0.4, 16, 1, true).rotateX(Math.PI / 2),
    new TorusGeometry(0.22, 0.05, 6, 16).translate(0, 0, -0.75),
  ];
  for (let i = 0; i < 8; i++) {
    // Basket struts converging on the distal ring.
    const a = (i / 8) * Math.PI * 2;
    const from = new Vector3(Math.cos(a) * 0.55, Math.sin(a) * 0.55, -0.25);
    const to = new Vector3(Math.cos(a) * 0.22, Math.sin(a) * 0.22, -0.75);
    const strut = new CylinderGeometry(0.035, 0.035, from.distanceTo(to), 5, 1);
    strut.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), to.clone().sub(from).normalize()));
    const mid = from.clone().lerp(to, 0.5);
    strut.translate(mid.x, mid.y, mid.z);
    parts.push(strut);
  }
  return mergeGeometries(parts.map((g) => (g.deleteAttribute('uv'), g.index ? g.toNonIndexed() : g)))!;
}

/** Nucleolus positions inside the nucleus (local space), shared with the chromatin that packs around them. */
export const NUCLEOLI = [
  { at: new Vector3(7, 5, -4), radius: 7.2 },
  { at: new Vector3(-9, -6, 6), radius: 3.6 },
];

/** Points along the chromatin strands (nucleus-local), used to place DNA lesions in disease mode. */
export const chromatinSamples: Vector3[] = [];

const insideNucleolus = (p: Vector3, margin: number) => NUCLEOLI.some((n) => p.distanceTo(n.at) < n.radius + margin);

/**
 * Chromatin as a tangle of fine fibres, in two populations:
 * - euchromatin, loose and spread through the nucleus;
 * - heterochromatin, thicker and denser, packed against the envelope and around the nucleoli.
 */
function chromatinGeometry(count: number, radius: number, kind: 'eu' | 'hetero') {
  const rng = createRng(kind === 'eu' ? 77 : 78);
  const parts: BufferGeometry[] = [];
  const dir = new Vector3();
  const steps = kind === 'eu' ? 44 : 30;
  const stepLength = kind === 'eu' ? 1.7 : 1.2;
  for (let c = 0; c < count; c++) {
    const pts: Vector3[] = [];
    // Heterochromatin starts at the periphery or next to a nucleolus; euchromatin anywhere.
    const nearNucleolus = kind === 'hetero' && rng.next() < 0.3;
    const n = rng.pick(NUCLEOLI);
    const p =
      kind === 'eu'
        ? rng.direction().multiplyScalar(rng.range(0, radius * 0.85))
        : nearNucleolus
          ? n.at.clone().add(rng.direction().multiplyScalar(n.radius + rng.range(0.6, 2)))
          : rng.direction().multiplyScalar(rng.range(radius - 4.5, radius - 0.8));
    rng.direction(dir);
    for (let i = 0; i < steps; i++) {
      pts.push(p.clone());
      dir.addScaledVector(rng.direction(), kind === 'eu' ? 0.85 : 1.1).normalize();
      p.addScaledVector(dir, stepLength);
      if (p.length() > radius) {
        // Bounce back inside: chromatin stays within the envelope.
        dir.addScaledVector(p.clone().normalize(), -1.6).normalize();
        p.setLength(radius - 0.5);
      }
      if (kind === 'hetero' && !nearNucleolus && p.length() < radius - 6) {
        // Peripheral heterochromatin hugs the nuclear lamina.
        dir.addScaledVector(p.clone().normalize(), 1.4).normalize();
      }
      for (const nu of NUCLEOLI) {
        if (p.distanceTo(nu.at) < nu.radius + 0.4) p.copy(nu.at).add(p.clone().sub(nu.at).setLength(nu.radius + 0.4));
      }
    }
    if (pts.some((q) => insideNucleolus(q, -0.2))) continue;
    if (kind === 'eu') for (let i = 0; i < pts.length; i += 6) chromatinSamples.push(pts[i]!.clone());
    const thickness = kind === 'eu' ? rng.range(0.14, 0.24) : rng.range(0.28, 0.42);
    const tube = new TubeGeometry(new CatmullRomCurve3(pts), steps * 3, thickness, 4, false);
    tube.deleteAttribute('uv');
    const seeds = new Float32Array(tube.attributes.position!.count).fill(rng.next());
    tube.setAttribute('aSeed', new BufferAttribute(seeds, 1));
    parts.push(tube);
  }
  return mergeGeometries(parts)!;
}

export function Nucleus() {
  const preset = usePreset();
  const { center, radius } = CELL.nucleus;

  const parts = useMemo(() => {
    const detail = preset.geometryDetail >= 1 ? 28 : 18;
    const outer = new IcosahedronGeometry(radius, detail);
    const inner = new IcosahedronGeometry(radius - 0.9, detail - 6);
    const nucleolus = new IcosahedronGeometry(NUCLEOLI[0]!.radius - 0.7, 12);
    const nucleolus2 = new IcosahedronGeometry(NUCLEOLI[1]!.radius - 0.4, 7);
    chromatinSamples.length = 0;
    const euchromatin = chromatinGeometry(Math.round(110 * preset.geometryDetail), radius - 2.5, 'eu');
    const heterochromatin = chromatinGeometry(Math.round(42 * preset.geometryDetail), radius - 1.5, 'hetero');
    return {
      outer,
      inner,
      nucleolus,
      nucleolus2,
      euchromatin,
      heterochromatin,
      outerMat: createOrganicMaterial(OUTER_ENVELOPE),
      innerMat: createOrganicMaterial(INNER_ENVELOPE),
      chromatinMat: createOrganicMaterial(EUCHROMATIN),
      heteroMat: createOrganicMaterial(HETEROCHROMATIN),
      nucleolusMat: createOrganicMaterial(NUCLEOLUS),
    };
  }, [preset.geometryDetail, radius]);

  const pores = useMemo(() => {
    // ~3–5 thousand pores in a real nucleus; we show a representative subset.
    const count = Math.round(520 * preset.geometryDetail);
    const rng = createRng(99);
    const matrices: Matrix4[] = [];
    const seeds: number[] = [];
    const n = new Vector3();
    const z = new Vector3(0, 0, 1);
    for (let i = 0; i < count; i++) {
      fibonacciSphere(count, i, n);
      n.addScaledVector(rng.direction(), 0.04).normalize();
      const q = new Quaternion().setFromUnitVectors(z, n);
      const p = n.clone().multiplyScalar(radius + 0.15).add(center);
      matrices.push(new Matrix4().compose(p, q, new Vector3(1, 1, 1).multiplyScalar(rng.range(0.85, 1.1))));
      seeds.push(rng.next());
    }
    return { matrices, seeds, geometry: poreComplexGeometry() };
  }, [preset.geometryDetail, radius, center]);

  useHighlight('nucleus', parts.outerMat, parts.innerMat);
  // DNA (chromatin) is its own explorable element inside the nucleus.
  useHighlight('dna', parts.chromatinMat, parts.heteroMat);

  const group = useRef<Group>(null);
  const reveal = useRef(0);

  // Disease markers placed on the chromatin strands (nucleus-local coordinates).
  const markers = useMemo(() => {
    const rng = createRng(1717);
    const lesions = Array.from({ length: 80 }, () => rng.pick(chromatinSamples));
    const one = new Vector3(1, 1, 1);
    const q = new Quaternion();
    return {
      lesions: {
        matrices: lesions.map((p) => new Matrix4().compose(p, q, one.clone().multiplyScalar(rng.range(0.5, 0.9)))),
        seeds: lesions.map(() => rng.next()),
      },
      mutation: { matrices: [new Matrix4().compose(chromatinSamples[7] ?? new Vector3(), q, one.clone().multiplyScalar(1.6))], seeds: [0.5] },
      geometry: new IcosahedronGeometry(1, 2),
    };
  }, [parts]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mitosis: the envelope disassembles and chromatin condenses (scenario channels).
  // Diseases: the nucleus grows (cancer) or shrinks and breaks up (apoptosis).
  useFrame(() => {
    const g = group.current;
    if (g) {
      const s = liveChannels['nucleus.size'] * (1 - 0.35 * liveChannels['nucleus.fragmentation']);
      g.scale.setScalar(s);
      g.position.copy(center).multiplyScalar(1 - s);
    }
    // Exploring DNA: the envelope fades so the chromatin can be seen.
    const dnaFocus = useSelection.getState().selected?.organelle === 'dna' || useUi.getState().dnaLevel !== null;
    reveal.current += ((dnaFocus ? 1 : 0) - reveal.current) * 0.06;
    const envelope =
      liveChannels['nucleus.envelopeIntegrity'] * (1 - liveChannels['nucleus.fragmentation']) * (1 - 0.8 * reveal.current);
    const condensed = liveChannels['nucleus.chromatinCondensation'];
    parts.outerMat.uniforms.uOpacity!.value = OUTER_ENVELOPE.opacity! * envelope;
    parts.outerMat.uniforms.uRimOpacity!.value = OUTER_ENVELOPE.rimOpacity! * envelope;
    parts.innerMat.uniforms.uOpacity!.value = INNER_ENVELOPE.opacity! * envelope;
    parts.innerMat.uniforms.uRimOpacity!.value = INNER_ENVELOPE.rimOpacity! * envelope;
    parts.chromatinMat.uniforms.uPresence!.value = 1 - condensed * 0.97;
    parts.heteroMat.uniforms.uPresence!.value = 1 - condensed * 0.97;
    parts.nucleolusMat.uniforms.uPresence!.value = 1 - condensed;
  });
  useHighlight('nucleolus', parts.nucleolusMat);

  return (
    <group name="nucleus" ref={group}>
      <group position={center}>
        <mesh name="euchromatin" geometry={parts.euchromatin} material={parts.chromatinMat} />
        <mesh name="heterochromatin" geometry={parts.heterochromatin} material={parts.heteroMat} />
        <mesh geometry={parts.nucleolus} material={parts.nucleolusMat} position={NUCLEOLI[0]!.at} />
        <mesh geometry={parts.nucleolus2} material={parts.nucleolusMat} position={NUCLEOLI[1]!.at} />
        <InstancedOrganelle
          name="dna-lesions"
          geometry={markers.geometry}
          material={LESION}
          {...markers.lesions}
          visibleCount={() => Math.ceil(liveChannels['dna.damage'] * 80 - 0.01)}
        />
        <InstancedOrganelle
          name="dna-mutation"
          geometry={markers.geometry}
          material={MUTATION}
          {...markers.mutation}
          visibleCount={() => (liveChannels['dna.mutation'] > 0.02 ? 1 : 0)}
          presence={() => liveChannels['dna.mutation']}
        />
        <mesh geometry={parts.inner} material={parts.innerMat} renderOrder={4} />
        <mesh geometry={parts.outer} material={parts.outerMat} renderOrder={5} />
      </group>
      <InstancedOrganelle
        key={pores.seeds.length}
        geometry={pores.geometry}
        organelle="nucleus"
        presence={() => liveChannels['nucleus.envelopeIntegrity']}
        material={PORE}
        cullBeyond={230}
        matrices={pores.matrices}
        seeds={pores.seeds}
      />
    </group>
  );
}
