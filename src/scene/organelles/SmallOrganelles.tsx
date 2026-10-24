'use client';

import { useMemo } from 'react';
import { IcosahedronGeometry, Matrix4, Quaternion, Vector3 } from 'three';
import { createRng } from '@/lib/random';
import { randomCytoplasmPoint } from '../layout/cellLayout';
import { lysosomesLayout, peroxisomesLayout, vesiclesLayout } from '../layout/organelleLayout';
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

export function SmallOrganelles() {
  const preset = usePreset();

  const lysosomes = useMemo(() => ({ ...lysosomesLayout(), geometry: new IcosahedronGeometry(2.3, 6) }), []);
  const peroxisomes = useMemo(() => ({ ...peroxisomesLayout(), geometry: new IcosahedronGeometry(1.5, 4) }), []);
  const vesicles = useMemo(() => ({ ...vesiclesLayout(), geometry: new IcosahedronGeometry(1, 3) }), []);

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
    return { matrices, seeds, geometry: new IcosahedronGeometry(0.26, 0) };
  }, [preset.ribosomes]);

  return (
    <group name="small-organelles">
      <InstancedOrganelle organelle="lysosome" name="lysosomes" material={LYSOSOMES} {...lysosomes} />
      <InstancedOrganelle organelle="peroxisome" name="peroxisomes" material={PEROXISOMES} {...peroxisomes} />
      <InstancedOrganelle key={ribosomes.seeds.length} organelle="ribosome" name="free-ribosomes" material={FREE_RIBOSOMES} {...ribosomes} />
      <InstancedOrganelle organelle="vesicle" name="vesicles" material={VESICLES} renderOrder={6} {...vesicles} />
    </group>
  );
}
