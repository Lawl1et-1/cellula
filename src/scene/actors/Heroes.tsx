'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry,
  CapsuleGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Object3D,
  Quaternion,
  SphereGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Hero, HeroModel } from '@/content/schema/scenario';
import { stageIndexAt } from '@/engine/timeline/evaluate';
import { createRng } from '@/lib/random';
import { useScenario } from '@/state/scenario';
import { timeScale } from '../time';
import { anchors } from './anchors';
import { labelWorld } from './labels';
import { createOrganicMaterial, type OrganicOptions } from '../shaders/organicMaterial';
import { weld } from '../organelles/Instanced';

/**
 * Focus mode: the key objects of a step (a virus, a receptor, an enzyme…), drawn enlarged in colours that
 * no cell component uses, with labels. Sizes match `HERO_SIZES`, so the enlargement announced is honest.
 */
const MAX = 12;
const UP = new Vector3(0, 1, 0);

type Part = { geometry: BufferGeometry; look: OrganicOptions };
type ReadyPart = { geometry: BufferGeometry; material: ReturnType<typeof createOrganicMaterial> };

const look = (color: string, emissive: string, extra: Partial<OrganicOptions> = {}): OrganicOptions => ({
  color,
  color2: emissive,
  sssColor: emissive,
  emissive,
  emissiveStrength: 0.9,
  sss: 0.8,
  gloss: 0.7,
  rim: 1.4,
  dimmable: false,
  ...extra,
});

const clean = (g: BufferGeometry) => {
  g.deleteAttribute('uv');
  return g.index ? g.toNonIndexed() : g;
};

/** Spikes scattered over a sphere: `make` builds one spike pointing up. */
function studded(radius: number, count: number, seed: number, make: () => BufferGeometry) {
  const rng = createRng(seed);
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < count; i++) {
    const d = rng.direction();
    const g = make();
    g.translate(0, radius, 0);
    g.applyQuaternion(new Quaternion().setFromUnitVectors(UP, d));
    parts.push(clean(g));
  }
  return mergeGeometries(parts)!;
}

/** A wavy strand (RNA), lying along x. */
function strand(length: number, radius: number, waves: number) {
  const pts = Array.from({ length: 40 }, (_, i) => {
    const t = i / 39;
    return new Vector3((t - 0.5) * length, Math.sin(t * Math.PI * waves) * 0.9, Math.cos(t * Math.PI * waves * 0.7) * 0.6);
  });
  return new TubeGeometry(new CatmullRomCurve3(pts), 80, radius, 6, false);
}

function buildModel(model: HeroModel): Part[] {
  switch (model) {
    case 'coronavirus': {
      // ~100 nm, crown of club-shaped spike proteins.
      const spike = () => {
        const stem = clean(new CylinderGeometry(0.12, 0.16, 0.9, 6).translate(0, 0.45, 0));
        const club = clean(new SphereGeometry(0.32, 8, 6).translate(0, 1.0, 0));
        return mergeGeometries([stem, club])!;
      };
      return [
        { geometry: new IcosahedronGeometry(3.5, 4), look: look('#2fbfb2', '#7ff0e2', { pattern: 'granular', patternScale: 2.2 }) },
        { geometry: studded(3.3, 46, 11, spike), look: look('#ffc94a', '#ffe08a', { emissiveStrength: 1.4 }) },
      ];
    }
    case 'influenza': {
      const spike = () => clean(new CylinderGeometry(0.1, 0.14, 0.8, 5).translate(0, 0.4, 0));
      return [
        { geometry: new IcosahedronGeometry(3, 4), look: look('#9ad94a', '#d6ff8a', { pattern: 'granular', patternScale: 2.5 }) },
        { geometry: studded(2.9, 120, 12, spike), look: look('#e65ad1', '#ff9cf0', { emissiveStrength: 1.2 }) },
      ];
    }
    case 'hiv': {
      const knob = () => clean(new SphereGeometry(0.35, 8, 6).translate(0, 0.25, 0));
      return [
        { geometry: new IcosahedronGeometry(3.5, 4), look: look('#ff9a3c', '#ffd08a', { pattern: 'granular', patternScale: 2 }) },
        { geometry: studded(3.4, 14, 13, knob), look: look('#ffe86a', '#fff4b0', { emissiveStrength: 1.4 }) },
      ];
    }
    case 'listeria':
      // Drawn at about its real size (~0.5 × 1–2 µm).
      return [{ geometry: new CapsuleGeometry(2.5, 9, 8, 16), look: look('#43d17a', '#a6ffc8', { pattern: 'granular', patternScale: 1.2 }) }];
    case 'mycobacterium':
      return [{ geometry: new CapsuleGeometry(2, 14, 8, 16), look: look('#e0b13e', '#ffe08a', { pattern: 'fibrous', patternScale: 1.5 }) }];
    case 'receptor': {
      // Y-shaped membrane receptor, ~10 nm, standing on the membrane (y = outwards).
      const stem = clean(new CylinderGeometry(0.22, 0.22, 1.8, 8).translate(0, 0.9, 0));
      const arm = (s: number) =>
        clean(new CylinderGeometry(0.2, 0.2, 1.3, 8).translate(0, 0.65, 0).rotateZ(s * 0.6).translate(0, 1.7, 0));
      return [{ geometry: mergeGeometries([stem, arm(1), arm(-1)])!, look: look('#4aa8ff', '#a8d8ff', { emissiveStrength: 1.3 }) }];
    }
    case 'viral-rna':
      return [{ geometry: strand(9, 0.25, 5), look: look('#ff3fd0', '#ff9cf0', { emissiveStrength: 2 }) }];
    case 'mrna':
      return [{ geometry: strand(7, 0.22, 4), look: look('#ff6fb0', '#ffc0dc', { emissiveStrength: 1.8 }) }];
    case 'protein':
      return [{ geometry: new IcosahedronGeometry(0.8, 2), look: look('#8fe3ff', '#d0f4ff', { wobble: 0.15, wobbleFreq: 2.5 }) }];
    case 'misfolded': {
      const rng = createRng(21);
      const blobs = Array.from({ length: 7 }, () => {
        const d = rng.direction().multiplyScalar(rng.range(0.3, 0.9));
        return clean(new IcosahedronGeometry(rng.range(0.5, 0.9), 2).translate(d.x, d.y, d.z));
      },
      );
      return [{ geometry: mergeGeometries(blobs)!, look: look('#ff7a3c', '#ffc08a', { wobble: 0.12, wobbleFreq: 1.5 }) }];
    }
    case 'enzyme': {
      // A globular enzyme with its active-site cleft.
      const g = new SphereGeometry(1, 20, 14, 0.5, Math.PI * 2 - 1);
      return [{ geometry: g, look: look('#5cf0a8', '#c0ffe0', { doubleSide: true }) }];
    }
    case 'substrate':
      return [{ geometry: new CapsuleGeometry(0.35, 0.9, 4, 8), look: look('#f2e3a0', '#fff6cc', { emissiveStrength: 0.8 }) }];
    case 'ldl':
      return [{ geometry: new IcosahedronGeometry(1.1, 3), look: look('#ffc46b', '#ffe6b0', { pattern: 'granular', patternScale: 3 }) }];
    case 'glucose':
      return [{ geometry: new CylinderGeometry(0.4, 0.4, 0.18, 6), look: look('#ffe066', '#fff3b0', { emissiveStrength: 1.4 }) }];
    case 'insulin':
      return [{ geometry: new IcosahedronGeometry(0.6, 2), look: look('#c79bff', '#e8d6ff', { emissiveStrength: 1.3 }) }];
    case 't-cell': {
      // A lymphocyte (~7 µm) at its real size, studded with microvilli; it stays outside the cell.
      const villus = () => clean(new CapsuleGeometry(0.6, 2.4, 3, 6).translate(0, 1.2, 0));
      return [
        { geometry: new IcosahedronGeometry(30, 5), look: look('#7d8cff', '#c0c8ff', { pattern: 'granular', patternScale: 0.3, wobble: 1.2, wobbleFreq: 0.08 }) },
        { geometry: studded(29.5, 90, 14, villus), look: look('#9aa6ff', '#d0d6ff') },
      ];
    }
    case 'uv':
      return [{ geometry: new CylinderGeometry(0.12, 0.12, 6, 6), look: look('#b48cff', '#e2d0ff', { emissiveStrength: 4 }) }];
  }
}

/** Radius of the model, to place labels just above it. */
const RADIUS: Partial<Record<HeroModel, number>> = {
  coronavirus: 4.6,
  influenza: 3.8,
  hiv: 4.2,
  listeria: 7.5,
  mycobacterium: 10,
  receptor: 3,
  'viral-rna': 2,
  mrna: 2,
  misfolded: 2,
  enzyme: 1.4,
  ldl: 1.5,
  't-cell': 34,
  uv: 3.5,
};

/** Built on first use and kept: steps come back to the same models. */
const models = new Map<HeroModel, ReadyPart[]>();
function modelParts(model: HeroModel) {
  let parts = models.get(model);
  if (!parts) {
    parts = buildModel(model).map(({ geometry, look }) => {
      const g = weld(geometry);
      g.setAttribute('aSeed', new InstancedBufferAttribute(new Float32Array(MAX).map((_, i) => (i * 0.37) % 1), 1));
      return { geometry: g, material: createOrganicMaterial(look, true) };
    });
    models.set(model, parts);
  }
  return parts;
}

const smooth = (x: number) => x * x * (3 - 2 * x);

/** One hero of the current step: its copies travel along the path, then hold. */
function HeroActor({ hero, stage, labelKey }: { hero: Hero; stage: [number, number]; labelKey: string }) {
  const parts = useMemo(() => modelParts(hero.model), [hero.model]);
  const meshes = useRef<(InstancedMesh | null)[]>([]);
  const presence = useRef(0);
  const spin = useRef(0);
  const dummy = useMemo(() => new Object3D(), []);

  const route = useMemo(() => {
    const a = anchors();
    const offset = new Vector3(...(hero.offset ?? [0, 0, 0]));
    const points = hero.path.map((id) => a[id].clone().add(offset));
    const curve = points.length > 1 ? new CatmullRomCurve3(points, false, 'centripetal') : null;
    const rng = createRng(hero.model.length * 31 + hero.path.length);
    const spread = (RADIUS[hero.model] ?? 1) * 2.4;
    const copies = Array.from({ length: hero.count }, (_, i) =>
      i === 0 ? new Vector3() : rng.direction().multiplyScalar(spread * rng.range(0.8, 1.4)),
    );
    // Receptors stand on the membrane: their up axis is the outward normal there.
    const normal = points[points.length - 1]!.clone().normalize();
    return { points, curve, copies, normal };
  }, [hero]);

  useFrame((_, delta) => {
    const { t } = useScenario.getState();
    const local = Math.min(1, Math.max(0, (t - stage[0]) / (stage[1] - stage[0])));
    presence.current += (1 - presence.current) * Math.min(1, delta * 3);
    spin.current += delta * 0.25 * timeScale();
    // Travel during the first three quarters of the step, then stay in view.
    const s = smooth(Math.min(1, local / 0.75));
    const base = route.curve ? route.curve.getPointAt(s) : route.points[0]!;
    route.copies.forEach((c, i) => {
      const lag = route.curve ? Math.max(0, s - i * 0.06) : s;
      const p = route.curve ? route.curve.getPointAt(smooth(lag)) : base;
      dummy.position.copy(p).add(c);
      if (hero.model === 'receptor') dummy.quaternion.setFromUnitVectors(UP, route.normal);
      else dummy.rotation.set(spin.current * 0.6 + i, spin.current + i * 1.7, 0);
      dummy.scale.setScalar(presence.current);
      dummy.updateMatrix();
      for (const m of meshes.current) m?.setMatrixAt(i, dummy.matrix);
    });
    for (const m of meshes.current) {
      if (!m) continue;
      m.count = route.copies.length;
      m.instanceMatrix.needsUpdate = true;
    }
    if (hero.label) {
      const at = labelWorld.get(labelKey) ?? new Vector3();
      labelWorld.set(labelKey, at.copy(base).addScaledVector(UP, (RADIUS[hero.model] ?? 1.2) + 1.2));
    }
  });
  useEffect(() => () => void labelWorld.delete(labelKey), [labelKey]);

  return (
    <>
      {parts.map((p, i) => (
        <instancedMesh
          key={i}
          ref={(m) => void (meshes.current[i] = m)}
          args={[p.geometry, p.material, MAX]}
          frustumCulled={false}
          renderOrder={8}
        />
      ))}
    </>
  );
}

export function Heroes() {
  const scenario = useScenario((s) => s.scenario);
  const index = useScenario((s) => (s.scenario ? stageIndexAt(s.scenario.stages, s.t) : -1));
  const stage = scenario && index >= 0 ? scenario.stages[index] : undefined;
  const id = stage ? `${scenario!.id}:${stage.id}` : '';
  // Labels that name a place rather than an enlarged object.
  useEffect(() => {
    if (!stage) return;
    const a = anchors();
    const keys = stage.labels.map((lb, i) => {
      const key = `${id}:label:${i}`;
      labelWorld.set(key, a[lb.at].clone().add(new Vector3(...(lb.offset ?? [0, 0, 0]))));
      return key;
    });
    return () => keys.forEach((k) => labelWorld.delete(k));
  }, [id, stage]);
  if (!scenario || !stage) return null;
  return (
    <group name="heroes" key={id}>
      {stage.heroes.map((h, i) => (
        <HeroActor key={i} hero={h} stage={stage.range} labelKey={`${id}:hero:${i}`} />
      ))}
    </group>
  );
}
