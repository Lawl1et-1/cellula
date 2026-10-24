'use client';

import { useMemo } from 'react';
import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  IcosahedronGeometry,
  Matrix4,
  Quaternion,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createRng } from '@/lib/random';
import { fbm3, valueNoise3 } from '@/lib/noise';
import { CELL, insideCytoplasm } from '../layout/cellLayout';
import { PALETTE } from '../palette';
import { createOrganicMaterial, type OrganicOptions } from '../shaders/organicMaterial';
import { InstancedOrganelle } from './Instanced';
import { usePreset } from '@/state/quality';

const ROUGH_ER: OrganicOptions = {
  color: PALETTE.roughEr.a,
  color2: PALETTE.roughEr.b,
  sssColor: PALETTE.roughEr.sss,
  sss: 0.9,
  gloss: 0.75,
  patternScale: 0.15,
  wobble: 0.35,
  wobbleFreq: 0.12,
  doubleSide: true,
  vertexSeed: true,
};

const SMOOTH_ER: OrganicOptions = {
  color: PALETTE.smoothEr.a,
  color2: PALETTE.smoothEr.b,
  sssColor: PALETTE.smoothEr.sss,
  sss: 0.85,
  gloss: 0.8,
  patternScale: 0.2,
  wobble: 0.22,
  wobbleFreq: 0.3,
  vertexSeed: true,
};

const BOUND_RIBOSOME: OrganicOptions = {
  color: PALETTE.ribosome.a,
  color2: PALETTE.ribosome.b,
  sss: 0.4,
  gloss: 0.3,
  emissive: PALETTE.ribosome.b,
  emissiveStrength: 0.35,
  molecular: true,
  fade: [170, 280],
};

interface Sheet {
  dir: Vector3;
  t1: Vector3;
  t2: Vector3;
  radius: number;
  span: [number, number];
  seed: number;
}

function sheetPoint(s: Sheet, u: number, v: number, out = new Vector3()) {
  const a = u * s.span[0];
  const b = v * s.span[1];
  out
    .copy(s.dir)
    .multiplyScalar(Math.cos(a) * Math.cos(b))
    .addScaledVector(s.t1, Math.sin(a) * Math.cos(b))
    .addScaledVector(s.t2, Math.sin(b))
    .normalize();
  const r =
    s.radius +
    1.6 * Math.sin(7.5 * u + s.seed * 9) * Math.cos(5.5 * v + s.seed * 4) +
    1.4 * fbm3(out.x * 3, out.y * 3, out.z * 3, Math.floor(s.seed * 1000));
  return out.multiplyScalar(r).add(CELL.nucleus.center);
}

/** Sheets are perforated (fenestrations) and have irregular edges. */
function sheetKeeps(s: Sheet, u: number, v: number, p: Vector3) {
  const hole = valueNoise3(p.x * 0.16, p.y * 0.16, p.z * 0.16, 7 + Math.floor(s.seed * 100));
  const edge = 1 - Math.max(Math.abs(u), Math.abs(v));
  const ragged = 0.08 + 0.12 * (valueNoise3(p.x * 0.07, p.y * 0.07, p.z * 0.07, 3) * 0.5 + 0.5);
  return hole < 0.42 && edge > ragged;
}

function sheetGeometry(s: Sheet, res: number) {
  const nu = Math.round(70 * res);
  const nv = Math.round(46 * res);
  const positions = new Float32Array((nu + 1) * (nv + 1) * 3);
  const uvs = new Float32Array((nu + 1) * (nv + 1) * 2);
  const keep = new Uint8Array((nu + 1) * (nv + 1));
  const p = new Vector3();
  for (let j = 0; j <= nv; j++) {
    for (let i = 0; i <= nu; i++) {
      const k = j * (nu + 1) + i;
      const u = (i / nu) * 2 - 1;
      const v = (j / nv) * 2 - 1;
      sheetPoint(s, u, v, p);
      positions.set([p.x, p.y, p.z], k * 3);
      uvs.set([i / nu, j / nv], k * 2);
      keep[k] = sheetKeeps(s, u, v, p) ? 1 : 0;
    }
  }
  const index: number[] = [];
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i;
      const b = a + 1;
      const c = a + nu + 1;
      const d = c + 1;
      if (keep[a]! + keep[b]! + keep[c]! + keep[d]! < 3) continue;
      index.push(a, c, b, b, c, d);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(positions, 3));
  g.setAttribute('uv', new BufferAttribute(uvs, 2));
  g.setAttribute('aSeed', new BufferAttribute(new Float32Array(positions.length / 3).fill(s.seed), 1));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

function buildSheets(): Sheet[] {
  const rng = createRng(31);
  const sheets: Sheet[] = [];
  const up = new Vector3(0, 1, 0);
  let groups = 0;
  while (groups < 5) {
    const dir = rng.direction();
    // The rough ER wraps the nucleus but leaves room for the Golgi pole.
    if (dir.dot(CELL.pole) > 0.25) continue;
    const t1 = new Vector3().crossVectors(dir, up).normalize();
    const t2 = new Vector3().crossVectors(dir, t1).normalize();
    const stack = 3 + Math.floor(rng.next() * 2);
    for (let k = 0; k < stack; k++) {
      sheets.push({
        dir,
        t1,
        t2,
        radius: CELL.nucleus.radius + 5 + k * 3.6,
        span: [rng.range(0.45, 0.7), rng.range(0.3, 0.5)],
        seed: rng.next(),
      });
    }
    groups++;
  }
  return sheets;
}

function smoothErGeometry(res: number) {
  const rng = createRng(57);
  const nodes: Vector3[] = [];
  const p = new Vector3();
  for (let tries = 0; nodes.length < 120 * res && tries < 20000; tries++) {
    rng.direction(p);
    if (p.dot(CELL.pole) > 0.1) continue;
    p.multiplyScalar(rng.range(CELL.nucleus.radius + 18, CELL.nucleus.radius + 46)).add(CELL.nucleus.center);
    if (!insideCytoplasm(p, 6)) continue;
    if (nodes.some((n) => n.distanceTo(p) < 5.5)) continue;
    nodes.push(p.clone());
  }
  const parts: BufferGeometry[] = [];
  const seen = new Set<string>();
  nodes.forEach((a, i) => {
    const nearest = nodes
      .map((b, j) => ({ j, d: a.distanceTo(b) }))
      .filter((x) => x.j !== i)
      .sort((x, y) => x.d - y.d)
      .slice(0, rng.next() < 0.3 ? 3 : 2);
    for (const { j, d } of nearest) {
      const key = i < j ? `${i}-${j}` : `${j}-${i}`;
      if (seen.has(key) || d > 16) continue;
      seen.add(key);
      const b = nodes[j]!;
      const mid = a.clone().lerp(b, 0.5).add(rng.direction().multiplyScalar(d * 0.18));
      const tube = new TubeGeometry(new CatmullRomCurve3([a, mid, b]), 10, rng.range(0.55, 0.85), 6, false);
      tube.deleteAttribute('uv');
      parts.push(tube);
    }
    // Three-way junctions are characteristic of the tubular ER network.
    const junction = new SphereGeometry(1.05, 8, 6);
    junction.deleteAttribute('uv');
    junction.translate(a.x, a.y, a.z);
    parts.push(junction);
  });
  const merged = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)))!;
  merged.setAttribute('aSeed', new BufferAttribute(new Float32Array(merged.attributes.position!.count).fill(0.37), 1));
  return merged;
}

export function EndoplasmicReticulum() {
  const preset = usePreset();
  const res = preset.geometryDetail;

  const rough = useMemo(() => {
    const sheets = buildSheets();
    const geometry = mergeGeometries(sheets.map((s) => sheetGeometry(s, res)))!;
    return { sheets, geometry, material: createOrganicMaterial(ROUGH_ER) };
  }, [res]);

  const smooth = useMemo(
    () => ({ geometry: smoothErGeometry(res), material: createOrganicMaterial(SMOOTH_ER) }),
    [res],
  );

  const ribosomes = useMemo(() => {
    const rng = createRng(1234);
    const count = Math.round(preset.ribosomes * 0.7);
    const matrices: Matrix4[] = [];
    const seeds: number[] = [];
    const p = new Vector3();
    const pu = new Vector3();
    const pv = new Vector3();
    const n = new Vector3();
    const q = new Quaternion();
    for (let tries = 0; matrices.length < count && tries < count * 4; tries++) {
      const s = rng.pick(rough.sheets);
      // Polysomes: ribosomes cluster in short spirals along one mRNA.
      const u0 = rng.range(-1, 1);
      const v0 = rng.range(-1, 1);
      const side = rng.next() < 0.5 ? -1 : 1;
      const chain = 3 + Math.floor(rng.next() * 6);
      for (let c = 0; c < chain && matrices.length < count; c++) {
        const u = u0 + Math.cos(c * 0.9) * 0.012 * c;
        const v = v0 + Math.sin(c * 0.9) * 0.012 * c;
        sheetPoint(s, u, v, p);
        if (!sheetKeeps(s, u, v, p)) break;
        sheetPoint(s, u + 0.01, v, pu).sub(p);
        sheetPoint(s, u, v + 0.01, pv).sub(p);
        n.crossVectors(pu, pv).normalize().multiplyScalar(side);
        q.setFromUnitVectors(new Vector3(0, 1, 0), n);
        matrices.push(new Matrix4().compose(p.clone().addScaledVector(n, 0.75), q.clone(), new Vector3(1, 0.8, 1)));
        seeds.push(rng.next());
      }
    }
    return { matrices, seeds, geometry: new IcosahedronGeometry(0.42, 1) };
  }, [preset.ribosomes, rough.sheets]);

  return (
    <group name="er">
      <mesh name="rough-er" geometry={rough.geometry} material={rough.material} />
      <mesh name="smooth-er" geometry={smooth.geometry} material={smooth.material} />
      <InstancedOrganelle
        key={ribosomes.seeds.length}
        name="bound-ribosomes"
        geometry={ribosomes.geometry}
        material={BOUND_RIBOSOME}
        matrices={ribosomes.matrices}
        seeds={ribosomes.seeds}
      />
    </group>
  );
}
