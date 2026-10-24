'use client';

import { useMemo } from 'react';
import { IcosahedronGeometry, Matrix4, Quaternion, Vector3 } from 'three';
import { createRng } from '@/lib/random';
import { GOLGI_CENTER, scatter, toMatrices, randomCytoplasmPoint } from '../layout/cellLayout';
import { PALETTE } from '../palette';
import type { OrganicOptions } from '../shaders/organicMaterial';
import { InstancedOrganelle } from './Instanced';
import { usePreset } from '@/state/quality';

const LYSOSOMES: OrganicOptions = {
  color: PALETTE.lysosome.a,
  color2: PALETTE.lysosome.b,
  sssColor: PALETTE.lysosome.b,
  emissive: PALETTE.lysosome.glow,
  emissiveStrength: 0.6,
  pattern: 'granular',
  patternScale: 0.7,
  sss: 0.9,
  gloss: 0.9,
  wobble: 0.22,
  wobbleFreq: 0.6,
  drift: 1.1,
};

const PEROXISOMES: OrganicOptions = {
  color: PALETTE.peroxisome.a,
  color2: PALETTE.peroxisome.b,
  sssColor: PALETTE.peroxisome.b,
  emissive: PALETTE.peroxisome.glow,
  pattern: 'crystal',
  emissiveStrength: 0.6,
  diffuse: 0.5,
  sss: 0.8,
  gloss: 0.9,
  wobble: 0.12,
  wobbleFreq: 0.8,
  drift: 1.2,
};

const VESICLES: OrganicOptions = {
  color: PALETTE.vesicle.a,
  color2: PALETTE.vesicle.rim,
  sssColor: PALETTE.vesicle.a,
  sss: 0.6,
  gloss: 1,
  wobble: 0.08,
  wobbleFreq: 1.2,
  wobbleSpeed: 0.8,
  drift: 1.6,
  transparent: true,
  opacity: 0.04,
  rimOpacity: 0.7,
  diffuse: 0.15,
  rim: 1.4,
};

const FREE_RIBOSOMES: OrganicOptions = {
  color: '#8a7462',
  color2: PALETTE.ribosome.b,
  emissive: PALETTE.ribosome.b,
  emissiveStrength: 0.18,
  diffuse: 0.5,
  // Molecular-scale detail only matters up close; from afar it is just noise.
  fade: [140, 240],
  sss: 0.4,
  gloss: 0.3,
  molecular: true,
  drift: 0.9,
};

const uniform = (min: number, max: number) => (rng: { range: (a: number, b: number) => number }) =>
  new Vector3(1, 1, 1).multiplyScalar(rng.range(min, max));

export function SmallOrganelles() {
  const preset = usePreset();

  const lysosomes = useMemo(() => {
    const placed = scatter(21, 34, { spacing: 7, margin: 2, scale: uniform(0.7, 1.35) });
    return { matrices: toMatrices(placed), seeds: placed.map((o) => o.seed), geometry: new IcosahedronGeometry(2.3, 4) };
  }, []);

  const peroxisomes = useMemo(() => {
    const placed = scatter(31, 42, { spacing: 6, margin: 2, scale: uniform(0.75, 1.2) });
    return { matrices: toMatrices(placed), seeds: placed.map((o) => o.seed), geometry: new IcosahedronGeometry(1.5, 3) };
  }, []);

  const vesicles = useMemo(() => {
    const rng = createRng(41);
    const matrices: Matrix4[] = [];
    const seeds: number[] = [];
    const p = new Vector3();
    const q = new Quaternion();
    for (let i = 0; i < 220; i++) {
      if (i < 60) {
        // Transport vesicles crowd around the Golgi stack.
        p.copy(GOLGI_CENTER).add(rng.direction().multiplyScalar(rng.range(9, 20)));
      } else {
        randomCytoplasmPoint(rng, p, 1);
      }
      const s = rng.range(0.6, 1.5);
      matrices.push(new Matrix4().compose(p, q, new Vector3(s, s, s)));
      seeds.push(rng.next());
    }
    return { matrices, seeds, geometry: new IcosahedronGeometry(1, 3) };
  }, []);

  const ribosomes = useMemo(() => {
    const rng = createRng(51);
    const count = Math.round(preset.ribosomes * 0.3);
    const matrices: Matrix4[] = [];
    const seeds: number[] = [];
    const p = new Vector3();
    const q = new Quaternion();
    const one = new Vector3(1, 1, 1);
    for (let i = 0; i < count; i++) {
      randomCytoplasmPoint(rng, p, 0);
      q.setFromUnitVectors(new Vector3(0, 1, 0), rng.direction());
      matrices.push(new Matrix4().compose(p, q, one));
      seeds.push(rng.next());
    }
    return { matrices, seeds, geometry: new IcosahedronGeometry(0.26, 1) };
  }, [preset.ribosomes]);

  return (
    <group name="small-organelles">
      <InstancedOrganelle name="lysosomes" material={LYSOSOMES} {...lysosomes} />
      <InstancedOrganelle name="peroxisomes" material={PEROXISOMES} {...peroxisomes} />
      <InstancedOrganelle key={ribosomes.seeds.length} name="free-ribosomes" material={FREE_RIBOSOMES} {...ribosomes} />
      <InstancedOrganelle name="vesicles" material={VESICLES} renderOrder={6} {...vesicles} />
    </group>
  );
}
