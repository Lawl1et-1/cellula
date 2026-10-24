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
    const detail = preset.geometryDetail >= 1 ? 28 : 18;
    const outer = new IcosahedronGeometry(radius, detail);
    const inner = new IcosahedronGeometry(radius - 0.9, detail - 6);
    const nucleolus = new IcosahedronGeometry(6.5, 12);
    const nucleolus2 = new IcosahedronGeometry(3.2, 7);
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
    return { matrices, seeds, geometry: poreComplexGeometry() };
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
        cullBeyond={230}
        matrices={pores.matrices}
        seeds={pores.seeds}
      />
    </group>
  );
}
