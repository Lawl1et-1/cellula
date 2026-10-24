'use client';

import { useMemo } from 'react';
import {
  BufferAttribute,
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
import { usePreset } from '@/state/quality';

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
  opacity: 0.22,
  rimOpacity: 0.7,
};

const INNER_ENVELOPE: OrganicOptions = {
  ...OUTER_ENVELOPE,
  opacity: 0.08,
  rimOpacity: 0.35,
  gloss: 0.3,
};

const PORE: OrganicOptions = {
  fade: [300, 460],
  color: PALETTE.nucleus.envelope2,
  color2: PALETTE.nucleus.pore,
  sss: 0.5,
  gloss: 0.7,
  patternScale: 1.5,
  emissive: PALETTE.nucleus.pore,
  emissiveStrength: 0.9,
  wobble: 0.08,
  wobbleFreq: 0.9,
};

const CHROMATIN: OrganicOptions = {
  color: PALETTE.chromatin.a,
  color2: PALETTE.chromatin.b,
  sssColor: PALETTE.chromatin.b,
  emissive: PALETTE.chromatin.glow,
  emissiveStrength: 0.55,
  pattern: 'fibrous',
  patternScale: 0.25,
  sss: 0.9,
  gloss: 0.35,
  wobble: 0.18,
  wobbleFreq: 0.4,
  vertexSeed: true,
};

const NUCLEOLUS: OrganicOptions = {
  color: PALETTE.nucleolus.a,
  color2: PALETTE.nucleolus.b,
  sssColor: PALETTE.nucleolus.b,
  emissive: PALETTE.nucleolus.glow,
  emissiveStrength: 0.7,
  pattern: 'fibrous',
  patternScale: 0.55,
  sss: 1,
  gloss: 0.4,
  wobble: 1.1,
  wobbleFreq: 0.28,
  wobbleSpeed: 0.12,
};

function chromatinGeometry(count: number, radius: number) {
  const rng = createRng(77);
  const parts: BufferGeometry[] = [];
  const dir = new Vector3();
  for (let c = 0; c < count; c++) {
    const pts: Vector3[] = [];
    const p = rng.direction().multiplyScalar(rng.range(0, radius * 0.8));
    rng.direction(dir);
    for (let i = 0; i < 26; i++) {
      pts.push(p.clone());
      dir.addScaledVector(rng.direction(), 0.75).normalize();
      p.addScaledVector(dir, 2.4);
      if (p.length() > radius) {
        // Bounce back inside: chromosomes occupy territories within the envelope.
        dir.addScaledVector(p.clone().normalize(), -1.6).normalize();
        p.setLength(radius - 0.5);
      }
    }
    const tube = new TubeGeometry(new CatmullRomCurve3(pts), 90, rng.range(0.35, 0.6), 5, false);
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
    const detail = preset.geometryDetail >= 1 ? 5 : 4;
    const outer = new IcosahedronGeometry(radius, detail);
    const inner = new IcosahedronGeometry(radius - 0.9, detail - 1);
    const nucleolus = new IcosahedronGeometry(6.5, 4);
    const nucleolus2 = new IcosahedronGeometry(3.2, 3);
    const chromatin = chromatinGeometry(Math.round(32 * preset.geometryDetail), radius - 2.5);
    return {
      outer,
      inner,
      nucleolus,
      nucleolus2,
      chromatin,
      outerMat: createOrganicMaterial(OUTER_ENVELOPE),
      innerMat: createOrganicMaterial(INNER_ENVELOPE),
      chromatinMat: createOrganicMaterial(CHROMATIN),
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
    return { matrices, seeds, geometry: new TorusGeometry(0.85, 0.36, 6, 14) };
  }, [preset.geometryDetail, radius, center]);

  return (
    <group name="nucleus">
      <group position={center}>
        <mesh geometry={parts.chromatin} material={parts.chromatinMat} />
        <mesh geometry={parts.nucleolus} material={parts.nucleolusMat} position={[7, 5, -4]} />
        <mesh geometry={parts.nucleolus2} material={parts.nucleolusMat} position={[-9, -6, 6]} />
        <mesh geometry={parts.inner} material={parts.innerMat} renderOrder={4} />
        <mesh geometry={parts.outer} material={parts.outerMat} renderOrder={5} />
      </group>
      <InstancedOrganelle
        key={pores.seeds.length}
        geometry={pores.geometry}
        material={PORE}
        matrices={pores.matrices}
        seeds={pores.seeds}
      />
    </group>
  );
}
