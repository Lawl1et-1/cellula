'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry,
  CapsuleGeometry,
  CatmullRomCurve3,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  Matrix4,
  Quaternion,
  TorusGeometry,
  TubeGeometry,
  Vector3,
} from 'three';
import { liveChannels } from '@/engine/timeline/live';
import { useUi } from '@/state/ui';
import { CELL } from '../layout/cellLayout';
import { PALETTE } from '../palette';
import { createOrganicMaterial, type OrganicOptions } from '../shaders/organicMaterial';
import { InstancedOrganelle } from './Instanced';

/**
 * DNA compaction close-up: double helix → nucleosomes → chromatin fibre → condensed chromosome.
 * Magnified models shown inside the nucleus while the rest of the cell is dimmed. Built on first use
 * only, so they cost nothing until someone opens the view.
 */
export const DNA_LEVELS = ['helix', 'nucleosome', 'fiber', 'chromosome'] as const;

export const BASE_COLORS = { A: '#ff7a6b', T: '#ffd36b', G: '#5fe0c8', C: '#7f9bff' } as const;

const backbone = (color: string): OrganicOptions => ({
  color,
  color2: '#ffd0e4',
  sssColor: '#ffc0dc',
  emissive: color,
  emissiveStrength: 0.6,
  sss: 0.9,
  gloss: 0.7,
  dimmable: false,
});
const base = (color: string): OrganicOptions => ({
  color,
  emissive: color,
  emissiveStrength: 0.7,
  sss: 0.7,
  gloss: 0.6,
  dimmable: false,
});
const HISTONE: OrganicOptions = {
  color: '#6f86d8',
  color2: '#a9bcff',
  sssColor: '#b8c8ff',
  emissive: '#8fa6ff',
  emissiveStrength: 0.35,
  pattern: 'granular',
  patternScale: 1.6,
  sss: 0.9,
  gloss: 0.6,
  dimmable: false,
};
const FIBER_DNA: OrganicOptions = backbone(PALETTE.chromatin.b);
const CHROMOSOME: OrganicOptions = {
  color: PALETTE.chromatin.a,
  color2: PALETTE.chromatin.b,
  sssColor: PALETTE.chromatin.b,
  emissive: PALETTE.chromatin.glow,
  emissiveStrength: 0.9,
  pattern: 'fibrous',
  patternScale: 1.4,
  sss: 1,
  gloss: 0.5,
  wobble: 0.12,
  wobbleFreq: 1.1,
  dimmable: false,
};
const MUTATION_RING: OrganicOptions = {
  color: '#ff5a4a',
  emissive: '#ff3a2a',
  emissiveStrength: 2.4,
  sss: 0.6,
  gloss: 0.5,
  dimmable: false,
};

const up = new Vector3(0, 1, 0);
const one = new Vector3(1, 1, 1);

/** Tube along a path, with the per-vertex seed the organic material reads (vertexSeed). */
function tube(pts: Vector3[], radius: number, segments: number) {
  const g: BufferGeometry = new TubeGeometry(new CatmullRomCurve3(pts), segments, radius, 6, false);
  g.setAttribute('aSeed', new InstancedBufferAttribute(new Float32Array(g.attributes.position!.count).fill(0.4), 1));
  return g;
}

/** Instanced placement helper: a cylinder of unit height stretched between two points. */
function between(a: Vector3, b: Vector3, thickness = 1) {
  const d = b.clone().sub(a);
  return new Matrix4().compose(
    a.clone().lerp(b, 0.5),
    new Quaternion().setFromUnitVectors(up, d.clone().normalize()),
    new Vector3(thickness, d.length(), thickness),
  );
}

const seeds = (n: number) => Array.from({ length: n }, (_, i) => (i * 0.618) % 1);

/** Double helix: two antiparallel backbones and complementary base pairs (A–T, G–C). */
function buildHelix() {
  const turns = 4.2;
  const pairs = 42;
  const length = 26;
  const radius = 1.7;
  // The two backbones are offset by ~150°, giving the major and minor grooves.
  const offset = (150 * Math.PI) / 180;
  const point = (t: number, phase: number) => {
    const a = t * turns * Math.PI * 2 + phase;
    return new Vector3(t * length - length / 2, Math.cos(a) * radius, Math.sin(a) * radius);
  };
  const strand = (phase: number) => Array.from({ length: 160 }, (_, i) => point(i / 159, phase));
  const sequence = 'ATGCGTACCTAGGCATTCGAATGCCGTATAGCTTACGGATCA';
  const pairOf = { A: 'T', T: 'A', G: 'C', C: 'G' } as const;
  const rungs: Record<keyof typeof BASE_COLORS, Matrix4[]> = { A: [], T: [], G: [], C: [] };
  for (let i = 0; i < pairs; i++) {
    const t = (i + 0.5) / pairs;
    const a = point(t, 0);
    const b = point(t, offset);
    const mid = a.clone().lerp(b, 0.5);
    const left = sequence[i] as keyof typeof pairOf;
    rungs[left].push(between(a, mid, 0.55));
    rungs[pairOf[left]].push(between(mid, b, 0.55));
  }
  // Point mutation marker: a ring around the middle base pair.
  const mutation = new Matrix4().compose(
    new Vector3(point(21.5 / pairs, 0).x, 0, 0),
    new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), new Vector3(1, 0, 0)),
    one,
  );
  return {
    strandA: tube(strand(0), 0.32, 240),
    strandB: tube(strand(offset), 0.32, 240),
    rung: new CylinderGeometry(0.22, 0.22, 1, 8, 1),
    rungs,
    mutation: [mutation],
    seeds: { A: seeds(rungs.A.length), T: seeds(rungs.T.length), G: seeds(rungs.G.length), C: seeds(rungs.C.length) },
  };
}

/** "Beads on a string": DNA wrapped ~1.7 turns around each histone octamer, joined by linker DNA. */
function buildNucleosomes() {
  const cores = 5;
  const histones: Matrix4[] = [];
  const path: Vector3[] = [];
  for (let k = 0; k < cores; k++) {
    const c = new Vector3(k * 5.2 - 10.4, k % 2 ? 1.6 : -1.6, k % 2 ? 0.6 : -0.6);
    // Octamer: two stacked layers of four histone proteins.
    for (let layer = 0; layer < 2; layer++)
      for (let j = 0; j < 4; j++) {
        const a = (j / 4) * Math.PI * 2 + layer * 0.4;
        histones.push(
          new Matrix4().compose(
            c.clone().add(new Vector3(Math.cos(a) * 0.75, (layer - 0.5) * 0.85, Math.sin(a) * 0.75)),
            new Quaternion(),
            one.clone().multiplyScalar(0.72),
          ),
        );
      }
    // The DNA wraps around the core (axis y), climbing slightly with each turn.
    const wraps = 1.7;
    for (let i = 0; i <= 28; i++) {
      const t = i / 28;
      const a = t * wraps * Math.PI * 2 + k;
      path.push(c.clone().add(new Vector3(Math.cos(a) * 1.75, (t - 0.5) * 1.5, Math.sin(a) * 1.75)));
    }
  }
  return { dna: tube(path, 0.26, 520), histones, histone: new IcosahedronGeometry(0.7, 3), seeds: seeds(histones.length) };
}

/** Classic solenoid model of the chromatin fibre: nucleosomes stacked in a helix, ~6 per turn. */
function buildFiber() {
  const count = 54;
  const discs: Matrix4[] = [];
  const path: Vector3[] = [];
  const radius = 3.3;
  for (let i = 0; i < count; i++) {
    const a = (i / 6) * Math.PI * 2;
    const x = i * 0.42 - (count * 0.42) / 2;
    const p = new Vector3(x, Math.cos(a) * radius, Math.sin(a) * radius);
    path.push(p.clone().add(new Vector3(0, Math.cos(a) * 0.6, Math.sin(a) * 0.6)));
    // Disc faces point roughly along the fibre axis.
    const q = new Quaternion().setFromUnitVectors(up, new Vector3(0.35, Math.cos(a), Math.sin(a)).normalize());
    discs.push(new Matrix4().compose(p, q, one));
  }
  return { discs, disc: new CylinderGeometry(1.15, 1.15, 0.85, 18, 1), dna: tube(path, 0.14, 400), seeds: seeds(count) };
}

/** Mitotic chromosome: two sister chromatids joined at the centromere. */
function buildChromosome() {
  const arm = new CapsuleGeometry(1.7, 7.5, 8, 16);
  arm.translate(0, 1.7 + 3.75, 0);
  const arms: Matrix4[] = [];
  for (const side of [-1, 1])
    for (const dir of [1, -1]) {
      const d = new Vector3(side * 0.42, dir, 0).normalize();
      arms.push(new Matrix4().compose(new Vector3(side * 0.9, 0, 0), new Quaternion().setFromUnitVectors(up, d), one));
    }
  return { arm, arms, centromere: new IcosahedronGeometry(1.5, 3), center: [new Matrix4()], seeds: seeds(4) };
}

type Models = {
  helix: ReturnType<typeof buildHelix>;
  nucleosome: ReturnType<typeof buildNucleosomes>;
  fiber: ReturnType<typeof buildFiber>;
  chromosome: ReturnType<typeof buildChromosome>;
};

export function DnaCompaction() {
  const level = useUi((s) => s.dnaLevel);
  const groups = useRef<(Group | null)[]>([]);
  const progress = useRef([0, 0, 0, 0]);
  const opened = level !== null;

  // Built once, the first time the close-up opens.
  const models = useMemo(() => (opened || cache.models ? buildModels() : null), [opened]);
  const materials = useMemo(
    () =>
      models && {
        strandA: createOrganicMaterial({ ...backbone(PALETTE.chromatin.b), vertexSeed: true }),
        strandB: createOrganicMaterial({ ...backbone('#c98bff'), vertexSeed: true }),
        fiberDna: createOrganicMaterial({ ...FIBER_DNA, vertexSeed: true }),
      },
    [models],
  );

  useFrame((_, delta) => {
    DNA_LEVELS.forEach((_, i) => {
      const target = level === i ? 1 : 0;
      progress.current[i]! += (target - progress.current[i]!) * Math.min(1, delta * 5);
      const g = groups.current[i];
      if (!g) return;
      const p = progress.current[i]!;
      g.visible = p > 0.01;
      g.scale.setScalar(0.6 + 0.4 * p);
      g.rotation.x += delta * 0.12;
    });
  });

  if (!models || !materials) return null;
  const at = CELL.nucleus.center;
  const h = models.helix;

  return (
    <group name="dna-compaction" position={at}>
      <group ref={(g) => void (groups.current[0] = g)} visible={false}>
        <mesh geometry={h.strandA} material={materials.strandA} />
        <mesh geometry={h.strandB} material={materials.strandB} />
        {(Object.keys(h.rungs) as (keyof typeof BASE_COLORS)[]).map((b) => (
          <InstancedOrganelle
            key={b}
            name={`base-${b}`}
            geometry={h.rung}
            material={BASE_MATERIALS[b]}
            matrices={h.rungs[b]}
            seeds={h.seeds[b]}
          />
        ))}
        {/* A point mutation (disease mode) rings one base pair. */}
        <InstancedOrganelle
          name="helix-mutation"
          geometry={RING}
          material={MUTATION_RING}
          matrices={h.mutation}
          seeds={MUTATION_SEED}
          visibleCount={() => (liveChannels['dna.mutation'] > 0.02 ? 1 : 0)}
        />
      </group>
      <group ref={(g) => void (groups.current[1] = g)} visible={false}>
        <mesh geometry={models.nucleosome.dna} material={materials.strandA} />
        <InstancedOrganelle
          name="histones"
          geometry={models.nucleosome.histone}
          material={HISTONE}
          matrices={models.nucleosome.histones}
          seeds={models.nucleosome.seeds}
        />
      </group>
      <group ref={(g) => void (groups.current[2] = g)} visible={false}>
        <mesh geometry={models.fiber.dna} material={materials.fiberDna} />
        <InstancedOrganelle
          name="fiber-nucleosomes"
          geometry={models.fiber.disc}
          material={HISTONE}
          matrices={models.fiber.discs}
          seeds={models.fiber.seeds}
        />
      </group>
      <group ref={(g) => void (groups.current[3] = g)} visible={false}>
        <InstancedOrganelle
          name="chromosome-arms"
          geometry={models.chromosome.arm}
          material={CHROMOSOME}
          matrices={models.chromosome.arms}
          seeds={models.chromosome.seeds}
        />
        <InstancedOrganelle
          name="centromere"
          geometry={models.chromosome.centromere}
          material={CHROMOSOME}
          matrices={models.chromosome.center}
          seeds={MUTATION_SEED}
        />
      </group>
    </group>
  );
}

const cache: { models: Models | null } = { models: null };
const buildModels = () =>
  (cache.models ??= {
    helix: buildHelix(),
    nucleosome: buildNucleosomes(),
    fiber: buildFiber(),
    chromosome: buildChromosome(),
  });
const MUTATION_SEED = [0.5];
const BASE_MATERIALS = {
  A: base(BASE_COLORS.A),
  T: base(BASE_COLORS.T),
  G: base(BASE_COLORS.G),
  C: base(BASE_COLORS.C),
};
const RING = new TorusGeometry(2.4, 0.16, 8, 48);

