'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  BufferGeometry,
  CapsuleGeometry,
  ConeGeometry,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Object3D,
  Quaternion,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { liveChannels } from '@/engine/timeline/live';
import { timeScale } from '../time';
import { createRng, type Rng } from '@/lib/random';
import { valueNoise3 } from '@/lib/noise';
import { CELL, GOLGI_CENTER, insideCytoplasm, randomCytoplasmPoint } from '../layout/cellLayout';
import { anchors } from '../actors/anchors';
import { InstancedOrganelle, weld } from '../organelles/Instanced';
import { createOrganicMaterial, type OrganicOptions } from '../shaders/organicMaterial';
import { useHighlight } from '../interaction/highlight';

/**
 * Things a disease adds to the cell. Each system has a fixed pool, drawn in proportion to its channel,
 * so a stage's look is a pure function of time (no spawning state).
 */
const AGGREGATE: OrganicOptions = {
  color: '#9c7a52',
  color2: '#e2c38c',
  sssColor: '#f0d29a',
  pattern: 'granular',
  patternScale: 1.4,
  emissive: '#ffb45c',
  emissiveStrength: 0.25,
  sss: 0.8,
  gloss: 0.4,
  diffuse: 0.6,
};
const LIPID: OrganicOptions = {
  color: '#f2c54e',
  color2: '#fff0b0',
  sssColor: '#ffe08a',
  sss: 1,
  gloss: 1,
  diffuse: 0.5,
  rim: 1.3,
  wobble: 0.15,
  wobbleFreq: 0.4,
  drift: 0.6,
};
const GLYCOGEN: OrganicOptions = {
  color: '#4b3d5c',
  color2: '#8a77a3',
  sss: 0.3,
  gloss: 0.3,
  diffuse: 0.8,
  drift: 0.5,
  fade: [140, 240],
};
const VIRION: OrganicOptions = {
  color: '#d93a3a',
  color2: '#ff9a7a',
  emissive: '#ff4a3a',
  emissiveStrength: 0.9,
  sss: 0.8,
  gloss: 0.6,
  drift: 1.2,
};
const DMV: OrganicOptions = {
  color: '#d9a6ff',
  sssColor: '#f0d0ff',
  sss: 0.9,
  gloss: 0.9,
  transparent: true,
  opacity: 0.08,
  rimOpacity: 0.85,
  diffuse: 0.2,
  rim: 1.6,
  drift: 0.3,
};
const INCLUSION: OrganicOptions = {
  color: '#d4a93c',
  color2: '#ffe08a',
  emissive: '#ffcf5a',
  emissiveStrength: 0.8,
  pattern: 'granular',
  patternScale: 1.2,
  sss: 0.8,
  gloss: 0.5,
};
const FRAGMENT: OrganicOptions = {
  color: '#3a2a6e',
  color2: '#7a5ad0',
  emissive: '#7a5ad0',
  emissiveStrength: 0.4,
  pattern: 'fibrous',
  patternScale: 0.8,
  sss: 0.7,
  gloss: 0.7,
};
const NEIGHBOUR: OrganicOptions = {
  color: '#cfe8ff',
  sssColor: '#7fe0ff',
  sss: 0.6,
  gloss: 0.9,
  transparent: true,
  opacity: 0.04,
  rimOpacity: 0.6,
  diffuse: 0.1,
  rim: 1.6,
  wobble: 2.5,
  wobbleFreq: 0.02,
  dimmable: false,
};
const BACTERIUM: OrganicOptions = {
  color: '#4fa04a',
  color2: '#a8e07a',
  emissive: '#7fd36b',
  emissiveStrength: 0.35,
  pattern: 'plain',
  patternScale: 0.8,
  sss: 0.8,
  gloss: 0.7,
};
const ACTIN_TAIL: OrganicOptions = {
  color: '#ff9c86',
  emissive: '#ff7a63',
  emissiveStrength: 1.2,
  sss: 0.6,
  gloss: 0.3,
};
const PHAGOSOME: OrganicOptions = {
  color: '#cfe0ff',
  sssColor: '#9fd0ff',
  sss: 0.6,
  gloss: 1,
  transparent: true,
  opacity: 0.06,
  rimOpacity: 0.8,
  diffuse: 0.2,
  rim: 1.4,
};

interface Pool {
  matrices: Matrix4[];
  seeds: number[];
}

function pool(
  seed: number,
  count: number,
  place: (rng: Rng, i: number) => { p: Vector3; s: Vector3; q?: Quaternion },
): Pool {
  const rng = createRng(seed);
  const matrices: Matrix4[] = [];
  const seeds: number[] = [];
  for (let i = 0; i < count; i++) {
    const { p, s, q } = place(rng, i);
    matrices.push(
      new Matrix4().compose(
        p,
        q ?? new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), rng.direction()),
        s,
      ),
    );
    seeds.push(rng.next());
  }
  return { matrices, seeds };
}

const v = (s: number) => new Vector3(s, s, s);

/** Lumpy blob: misfolded protein aggregate. */
function blobGeometry() {
  const g = new IcosahedronGeometry(1, 3);
  const pos = g.attributes.position!;
  const p = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i);
    const n =
      valueNoise3(p.x * 2.2, p.y * 2.2, p.z * 2.2, 3) * 0.35 +
      valueNoise3(p.x * 5, p.y * 5, p.z * 5, 9) * 0.15;
    p.multiplyScalar(1 + n);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  g.deleteAttribute('normal');
  g.deleteAttribute('uv');
  const welded = weld(g);
  welded.computeVertexNormals();
  return welded;
}

/** Enveloped virion: a core studded with spike proteins. */
function virionGeometry() {
  const parts: BufferGeometry[] = [new IcosahedronGeometry(0.9, 2)];
  const rng = createRng(77);
  for (let i = 0; i < 14; i++) {
    const d = rng.direction();
    const spike = new ConeGeometry(0.14, 0.55, 5);
    spike.translate(0, 1.1, 0);
    spike.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), d));
    parts.push(spike);
  }
  return mergeGeometries(parts.map((g) => (g.deleteAttribute('uv'), g.index ? g.toNonIndexed() : g)))!;
}

const near = (rng: Rng, center: Vector3, min: number, max: number) => {
  const p = new Vector3();
  for (let k = 0; k < 40; k++) {
    p.copy(center).add(rng.direction().multiplyScalar(rng.range(min, max)));
    if (insideCytoplasm(p, 2)) return p;
  }
  return randomCytoplasmPoint(rng, p, 2);
};

function Bacteria() {
  const COUNT = 14;
  const TAIL = 12;
  const bodies = useRef<InstancedMesh>(null);
  const tails = useRef<InstancedMesh>(null);
  const vacuoles = useRef<InstancedMesh>(null);
  const assets = useMemo(() => {
    const rng = createRng(515);
    // The first bacteria circle the spot that focus mode frames, so they are on screen when a step shows them.
    const spot = anchors().cytoplasm;
    const paths = Array.from({ length: COUNT }, (_, i) => {
      const center = i < 3 ? spot.clone().add(rng.direction().multiplyScalar(4)) : randomCytoplasmPoint(rng, new Vector3(), 10).clone();
      return {
        center,
        axis: rng.direction(),
        radius: i < 3 ? rng.range(7, 10) : rng.range(8, 18),
        phase: rng.range(0, 6.28),
        speed: rng.range(0.6, 1),
      };
    });
    const seeds = new InstancedBufferAttribute(
      new Float32Array(COUNT * TAIL).map(() => rng.next()),
      1,
    );
    // Listeria / mycobacteria: ~0.5 µm wide, 1–3 µm long.
    const body = new CapsuleGeometry(2.4, 9, 6, 14);
    body.setAttribute('aSeed', seeds);
    const tail = weld(new IcosahedronGeometry(1.1, 2));
    tail.setAttribute('aSeed', seeds);
    const vac = weld(new IcosahedronGeometry(8, 4));
    vac.setAttribute('aSeed', seeds);
    return {
      paths,
      body,
      tail,
      vac,
      bodyMat: createOrganicMaterial(BACTERIUM, true),
      tailMat: createOrganicMaterial(ACTIN_TAIL, true),
      vacMat: createOrganicMaterial(PHAGOSOME, true),
    };
  }, []);
  const dummy = useMemo(() => new Object3D(), []);
  const travelled = useRef(0);
  useHighlight('bacteria', assets.bodyMat, assets.tailMat);
  useHighlight('phagosomes', assets.vacMat);

  useFrame(({ clock }, delta) => {
    const b = bodies.current;
    const t = tails.current;
    const vac = vacuoles.current;
    if (!b || !t || !vac) return;
    const amount = liveChannels['cytoplasm.bacteria'];
    const actin = liveChannels['cytoskeleton.actinTails'];
    const contained = liveChannels['cytoplasm.phagosomes'];
    const n = Math.round(amount * COUNT);
    // Actin-propelled bacteria move fast; contained ones barely drift.
    travelled.current += Math.min(delta, 0.05) * (0.05 + actin * 0.45) * timeScale();
    const at = (i: number, s: number, out: Vector3) => {
      const p = assets.paths[i]!;
      const a = p.phase + s * p.speed;
      const ortho = new Vector3(0, 1, 0).cross(p.axis).normalize();
      const third = p.axis.clone().cross(ortho);
      return out
        .copy(p.center)
        .addScaledVector(ortho, Math.cos(a) * p.radius)
        .addScaledVector(third, Math.sin(a * 1.3) * p.radius * 0.6)
        .addScaledVector(p.axis, Math.sin(a * 0.7 + clock.elapsedTime * 0.02) * 4);
    };
    const pos = new Vector3();
    const ahead = new Vector3();
    for (let i = 0; i < COUNT; i++) {
      at(i, travelled.current, pos);
      at(i, travelled.current + 0.02, ahead);
      dummy.position.copy(pos);
      dummy.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), ahead.clone().sub(pos).normalize());
      dummy.scale.setScalar(i < n ? 1 : 0);
      dummy.updateMatrix();
      b.setMatrixAt(i, dummy.matrix);
      dummy.scale.setScalar(i < n ? contained : 0);
      dummy.updateMatrix();
      vac.setMatrixAt(i, dummy.matrix);
      // Comet tail of polymerising actin left behind the bacterium.
      for (let k = 0; k < TAIL; k++) {
        // Spaced by distance along the path, starting just behind the bacterium's rear pole.
        const p = assets.paths[i]!;
        at(i, travelled.current - (7.5 + k * 2.2) / (p.radius * p.speed), pos);
        dummy.position.copy(pos);
        dummy.scale.setScalar(i < n ? actin * (1 - k / TAIL) * 1.3 : 0);
        dummy.updateMatrix();
        t.setMatrixAt(i * TAIL + k, dummy.matrix);
      }
    }
    b.instanceMatrix.needsUpdate = true;
    t.instanceMatrix.needsUpdate = true;
    vac.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={bodies} args={[assets.body, assets.bodyMat, COUNT]} frustumCulled={false} />
      <instancedMesh
        name="actin-tails"
        ref={tails}
        args={[assets.tail, assets.tailMat, COUNT * TAIL]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={vacuoles}
        args={[assets.vac, assets.vacMat, COUNT]}
        frustumCulled={false}
        renderOrder={6}
      />
    </>
  );
}

export function DiseaseParticles() {
  const systems = useMemo(() => {
    const a = anchors();
    const nucleus = CELL.nucleus.center;
    // Viral replication organelles: double-membrane vesicles clustered on the ER.
    const dmv = pool(605, 90, (rng) => ({ p: near(rng, a['rough-er'], 2, 20), s: v(rng.range(1.3, 2.3)) }));
    return {
      blob: blobGeometry(),
      sphere: new IcosahedronGeometry(1, 4),
      small: new IcosahedronGeometry(0.35, 0),
      virion: virionGeometry(),
      // Aggregates gather around the nucleus (aggresome-like), others are scattered.
      aggregates: pool(601, 60, (rng, i) => ({
        p:
          i % 3
            ? near(rng, nucleus, CELL.nucleus.radius + 5, CELL.nucleus.radius + 18)
            : randomCytoplasmPoint(rng, new Vector3(), 3),
        s: v(rng.range(1.2, 3.2)),
      })),
      lipids: pool(602, 50, (rng) => ({
        p: randomCytoplasmPoint(rng, new Vector3(), 6),
        s: v(rng.range(2, 6.5)),
      })),
      glycogen: pool(603, 700, (rng) => ({
        p: randomCytoplasmPoint(rng, new Vector3(), 1),
        s: v(rng.range(0.7, 1.4)),
      })),
      // Virions are assembled near the ER and Golgi and leave at the membrane.
      virions: pool(604, 150, (rng, i) => ({
        p:
          i % 2
            ? near(rng, i % 4 === 1 ? a['rough-er'] : GOLGI_CENTER, 4, 22)
            : a.membrane
                .clone()
                .lerp(nucleus, rng.range(0, 0.25))
                .add(rng.direction().multiplyScalar(rng.range(0, 16))),
        s: v(rng.range(0.85, 1.1)),
      })),
      // Viral replication organelles: double-membrane vesicles clustered on the ER.
      dmv,
      dmvInner: {
        matrices: dmv.matrices.map((m) => m.clone().scale(new Vector3(0.7, 0.7, 0.7))),
        seeds: dmv.seeds,
      },
      inclusions: pool(606, 5, (rng) => ({
        p: nucleus.clone().add(rng.direction().multiplyScalar(rng.range(2, 12))),
        s: v(rng.range(2.5, 4)),
      })),
      fragments: pool(607, 10, (rng) => ({
        p: nucleus.clone().add(rng.direction().multiplyScalar(rng.range(14, 26))),
        s: v(rng.range(3, 5.5)),
      })),
      // Proliferation: daughter cells crowd around (seen from afar).
      neighbours: pool(608, 8, (rng, i) => {
        const angle = (i / 8) * Math.PI * 2 + rng.range(-0.2, 0.2);
        return {
          p: new Vector3(Math.cos(angle) * 230, rng.range(-50, 50), Math.sin(angle) * 230),
          s: new Vector3(100, 82, 95).multiplyScalar(rng.range(0.75, 0.95)),
          q: new Quaternion(),
        };
      }),
    };
  }, []);

  const c = liveChannels;
  const share = (ch: keyof typeof liveChannels, max: number) => () => Math.ceil(c[ch] * max - 0.01);
  const grow = (ch: keyof typeof liveChannels) => () => 0.35 + 0.65 * Math.min(1, c[ch] * 1.4);

  return (
    <group name="disease">
      <InstancedOrganelle
        name="aggregates"
        organelle="aggregates"
        geometry={systems.blob}
        material={AGGREGATE}
        {...systems.aggregates}
        visibleCount={share('cytoplasm.aggregates', 60)}
        presence={grow('cytoplasm.aggregates')}
      />
      <InstancedOrganelle
        name="lipid-droplets"
        organelle="lipids"
        geometry={systems.sphere}
        material={LIPID}
        {...systems.lipids}
        visibleCount={share('cytoplasm.lipidDroplets', 50)}
        presence={grow('cytoplasm.lipidDroplets')}
      />
      <InstancedOrganelle
        name="glycogen"
        organelle="glycogen"
        geometry={systems.small}
        material={GLYCOGEN}
        {...systems.glycogen}
        visibleCount={share('cytoplasm.glycogen', 700)}
      />
      <InstancedOrganelle
        name="virions"
        organelle="virions"
        geometry={systems.virion}
        material={VIRION}
        {...systems.virions}
        visibleCount={share('cytoplasm.viralParticles', 150)}
      />
      {/* Inner membrane: replication organelles are double-membrane vesicles. */}
      <InstancedOrganelle
        name="replication-organelles-inner"
        organelle="replication"
        geometry={systems.sphere}
        material={DMV}
        matrices={systems.dmvInner.matrices}
        seeds={systems.dmvInner.seeds}
        renderOrder={6}
        visibleCount={share('er.replicationOrganelles', 90)}
      />
      <InstancedOrganelle
        name="replication-organelles"
        organelle="replication"
        geometry={systems.sphere}
        material={DMV}
        {...systems.dmv}
        renderOrder={6}
        visibleCount={share('er.replicationOrganelles', 90)}
      />
      <InstancedOrganelle
        name="nuclear-inclusions"
        organelle="inclusions"
        geometry={systems.blob}
        material={INCLUSION}
        {...systems.inclusions}
        visibleCount={share('nucleus.inclusions', 5)}
        presence={grow('nucleus.inclusions')}
      />
      <InstancedOrganelle
        name="nuclear-fragments"
        organelle="fragments"
        geometry={systems.sphere}
        material={FRAGMENT}
        {...systems.fragments}
        visibleCount={share('nucleus.fragmentation', 10)}
        presence={grow('nucleus.fragmentation')}
      />
      <InstancedOrganelle
        name="neighbour-cells"
        geometry={systems.sphere}
        material={NEIGHBOUR}
        {...systems.neighbours}
        renderOrder={11}
        visibleCount={() => Math.round(((c['cell.divisionRate'] - 1) / 4) * 8)}
      />
      <Bacteria />
    </group>
  );
}
