'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferAttribute,
  CatmullRomCurve3,
  CylinderGeometry,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Object3D,
  Quaternion,
  TubeGeometry,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createRng } from '@/lib/random';
import { CELL, CENTROSOME, cellDistance } from '../layout/cellLayout';
import { PALETTE } from '../palette';
import { createOrganicMaterial, type OrganicOptions } from '../shaders/organicMaterial';
import { InstancedOrganelle, weld } from './Instanced';
import { usePreset } from '@/state/quality';
import { useScene } from '@/state/scene';

const MICROTUBULE: OrganicOptions = {
  color: '#2a3c5c',
  emissive: PALETTE.microtubule.glow,
  emissiveStrength: 0.7,
  sss: 0.9,
  gloss: 0.4,
  vertexSeed: true,
  growth: true,
};

const ACTIN: OrganicOptions = {
  fade: [190, 300],
  color: '#7a4a40',
  emissive: PALETTE.actin.glow,
  emissiveStrength: 0.2,
  diffuse: 0.4,
  sss: 0.6,
  gloss: 0.4,
};

const INTERMEDIATE: OrganicOptions = {
  color: PALETTE.intermediate.a,
  emissive: PALETTE.intermediate.glow,
  emissiveStrength: 0.35,
  sss: 0.6,
  gloss: 0.5,
  vertexSeed: true,
};

const CENTRIOLE: OrganicOptions = {
  color: PALETTE.centrosome.a,
  emissive: PALETTE.centrosome.glow,
  emissiveStrength: 0.9,
  sss: 0.8,
  gloss: 0.7,
};

const MOTOR: OrganicOptions = {
  fade: [150, 250],
  color: PALETTE.motor.a,
  emissive: PALETTE.motor.a,
  emissiveStrength: 0.9,
  sss: 0.8,
  gloss: 0.6,
};

const CARGO: OrganicOptions = {
  fade: [150, 250],
  color: PALETTE.motor.cargo,
  sssColor: PALETTE.motor.cargo,
  sss: 0.6,
  gloss: 1,
  wobble: 0.06,
  wobbleFreq: 1.4,
  transparent: true,
  opacity: 0.05,
  rimOpacity: 0.75,
  diffuse: 0.15,
  rim: 1.5,
};

/** Microtubules radiate from the centrosome to the periphery, bending around the nucleus. */
function microtubulePaths(count: number) {
  const rng = createRng(606);
  const paths: Vector3[][] = [];
  const { center, radius } = CELL.nucleus;
  while (paths.length < count) {
    const dir = rng.direction();
    if (dir.dot(CELL.pole) < -0.75 && rng.next() < 0.6) continue;
    const end = dir.clone();
    // March outwards to just inside the membrane.
    let r = 40;
    while (cellDistance(end.clone().multiplyScalar(r)) < 0.93) r += 2;
    end.multiplyScalar(r);
    const pts: Vector3[] = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const p = CENTROSOME.clone().lerp(end, t);
      p.add(rng.direction().multiplyScalar(i > 0 && i < 6 ? 2.5 : 0));
      const toNucleus = p.clone().sub(center);
      if (toNucleus.length() < radius + 4) p.copy(toNucleus.setLength(radius + 4 + rng.range(0, 3)).add(center));
      pts.push(p);
    }
    paths.push(pts);
  }
  return paths;
}

function tubesGeometry(paths: Vector3[][], radius: number, radial: number, segments: number, seedBase: number) {
  const rng = createRng(seedBase);
  const parts = paths.map((pts) => {
    const tube = new TubeGeometry(new CatmullRomCurve3(pts), segments, radius, radial, false);
    tube.setAttribute('aSeed', new BufferAttribute(new Float32Array(tube.attributes.position!.count).fill(rng.next()), 1));
    return tube;
  });
  return mergeGeometries(parts)!;
}

/** Intermediate filaments form a basket around the nucleus. */
function intermediatePaths(count: number) {
  const rng = createRng(707);
  const paths: Vector3[][] = [];
  for (let c = 0; c < count; c++) {
    const axis = rng.direction();
    const start = new Vector3().crossVectors(axis, rng.direction()).normalize();
    const r = CELL.nucleus.radius + rng.range(2.5, 9);
    const arc = rng.range(1.2, 2.8);
    const pts: Vector3[] = [];
    for (let i = 0; i <= 10; i++) {
      const p = start.clone().applyAxisAngle(axis, (i / 10) * arc);
      p.multiplyScalar(r + Math.sin(i * 1.3 + c) * 1.5).add(CELL.nucleus.center);
      pts.push(p);
    }
    paths.push(pts);
  }
  return paths;
}

/** Cortical actin: a dense mesh just under the plasma membrane. */
function actinMatrices(count: number) {
  const rng = createRng(505);
  const nodes: Vector3[] = [];
  for (let i = 0; i < count; i++) nodes.push(rng.direction().multiply(CELL.radii).multiplyScalar(rng.range(0.93, 0.965)));
  const matrices: Matrix4[] = [];
  const up = new Vector3(0, 1, 0);
  const dir = new Vector3();
  nodes.forEach((a, i) => {
    const near = nodes
      .map((b, j) => ({ b, j, d: a.distanceToSquared(b) }))
      .filter((x) => x.j > i)
      .sort((x, y) => x.d - y.d)
      .slice(0, 2);
    for (const { b } of near) {
      const len = a.distanceTo(b);
      if (len > 26) continue;
      dir.subVectors(b, a).normalize();
      matrices.push(
        new Matrix4().compose(a.clone().lerp(b, 0.5), new Quaternion().setFromUnitVectors(up, dir), new Vector3(1, len, 1)),
      );
    }
  });
  return matrices;
}

function centrioleMatrices() {
  // Two centrioles at right angles; each a ring of nine microtubule triplets (shown as single rods).
  const matrices: Matrix4[] = [];
  const up = new Vector3(0, 1, 0);
  const axes = [CELL.pole.clone(), new Vector3().crossVectors(CELL.pole, up).normalize()];
  axes.forEach((axis, c) => {
    const q = new Quaternion().setFromUnitVectors(up, axis);
    const offset = c === 0 ? new Vector3() : CELL.pole.clone().multiplyScalar(-3.4);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const local = new Vector3(Math.cos(a) * 1.15, 0, Math.sin(a) * 1.15).applyQuaternion(q);
      const twist = new Quaternion().setFromAxisAngle(axis, 0.35).multiply(q);
      matrices.push(new Matrix4().compose(CENTROSOME.clone().add(offset).add(local), twist, new Vector3(1, 1, 1)));
    }
  });
  return matrices;
}

interface Motor {
  path: Vector3[];
  t: number;
  speed: number;
  phase: number;
}

function Motors({ paths, count }: { paths: Vector3[][]; count: number }) {
  const heads = useRef<InstancedMesh>(null);
  const cargoes = useRef<InstancedMesh>(null);
  const parts = useMemo(() => {
    const rng = createRng(909);
    const sampled = paths.map((p) => new CatmullRomCurve3(p).getSpacedPoints(80));
    const motors: Motor[] = Array.from({ length: count }, () => ({
      path: rng.pick(sampled),
      // Stay below the shortest length reached by dynamic instability (see USE_GROWTH).
      t: rng.range(0.05, 0.4),
      // Kinesins walk outwards (+ end), dyneins inwards (− end).
      speed: (rng.next() < 0.6 ? 1 : -1) * rng.range(0.01, 0.025),
      phase: rng.next() * 10,
    }));
    const seeds = new InstancedBufferAttribute(new Float32Array(count).map(() => rng.next()), 1);
    // The motor protein itself: two small heads walking on the tubule.
    const headA = new IcosahedronGeometry(0.28, 1);
    headA.translate(0.22, 0.1, 0);
    const headB = new IcosahedronGeometry(0.28, 1);
    headB.translate(-0.22, 0.1, 0);
    const head = weld(mergeGeometries([headA, headB])!);
    head.setAttribute('aSeed', seeds);
    // Its cargo: a membrane vesicle towed on a short stalk.
    const cargo = weld(new IcosahedronGeometry(1, 2));
    cargo.translate(0, 1.5, 0);
    cargo.setAttribute('aSeed', seeds);
    return {
      motors,
      head,
      cargo,
      headMat: createOrganicMaterial(MOTOR, true),
      cargoMat: createOrganicMaterial(CARGO, true),
    };
  }, [paths, count]);

  const dummy = useMemo(() => new Object3D(), []);
  useFrame((_, delta) => {
    const h = heads.current;
    const c = cargoes.current;
    if (!h || !c) return;
    const dt = Math.min(delta, 0.05);
    parts.motors.forEach((m, i) => {
      m.phase += dt * 4;
      // Discrete 8 nm steps: move during half of each cycle, pause during the other.
      const stepping = Math.sin(m.phase) > 0 ? 1 : 0.1;
      m.t += m.speed * dt * stepping;
      if (m.t > 0.42 || m.t < 0.03) m.speed *= -1;
      const f = m.t * (m.path.length - 1);
      const i0 = Math.floor(f);
      const a = m.path[i0]!;
      const b = m.path[Math.min(i0 + 1, m.path.length - 1)]!;
      dummy.position.copy(a).lerp(b, f - i0);
      dummy.lookAt(b);
      dummy.rotateX(Math.PI / 2 + Math.sin(m.phase) * 0.15);
      dummy.updateMatrix();
      h.setMatrixAt(i, dummy.matrix);
      c.setMatrixAt(i, dummy.matrix);
    });
    h.instanceMatrix.needsUpdate = true;
    c.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={heads} args={[parts.head, parts.headMat, count]} frustumCulled={false} />
      <instancedMesh ref={cargoes} args={[parts.cargo, parts.cargoMat, count]} frustumCulled={false} renderOrder={6} />
    </>
  );
}

export function Cytoskeleton() {
  const preset = usePreset();
  const real = useScene((s) => s.scaleMode === 'real');

  const tubules = useMemo(() => {
    const paths = microtubulePaths(preset.microtubules);
    // Microtubules are 25 nm wide (1/20 of a mitochondrion); slightly enlarged in artistic scale.
    const radius = real ? 0.125 : 0.17;
    return { paths, geometry: tubesGeometry(paths, radius, 5, 72, 1), material: createOrganicMaterial(MICROTUBULE) };
  }, [preset.microtubules, real]);

  const intermediate = useMemo(() => {
    const radius = real ? 0.05 : 0.2;
    return {
      geometry: tubesGeometry(intermediatePaths(Math.round(46 * preset.geometryDetail)), radius, 4, 40, 2),
      material: createOrganicMaterial(INTERMEDIATE),
    };
  }, [preset.geometryDetail, real]);

  const actin = useMemo(() => {
    const matrices = actinMatrices(Math.round(900 * preset.geometryDetail));
    const r = real ? 0.035 : 0.13;
    return { matrices, seeds: matrices.map((_, i) => (i * 0.618) % 1), geometry: new CylinderGeometry(r, r, 1, 4, 1, true) };
  }, [preset.geometryDetail, real]);

  const centrioles = useMemo(() => {
    const matrices = centrioleMatrices();
    return { matrices, seeds: matrices.map(() => 0.5), geometry: new CylinderGeometry(0.2, 0.2, 5, 6) };
  }, []);

  return (
    <group name="cytoskeleton">
      <mesh name="microtubules" geometry={tubules.geometry} material={tubules.material} />
      <mesh name="intermediate-filaments" geometry={intermediate.geometry} material={intermediate.material} />
      <InstancedOrganelle key={`actin-${actin.matrices.length}-${real}`} name="actin" material={ACTIN} {...actin} />
      <InstancedOrganelle name="centrioles" material={CENTRIOLE} {...centrioles} />
      <Motors key={`${preset.motors}-${tubules.paths.length}`} paths={tubules.paths} count={preset.motors} />
    </group>
  );
}
