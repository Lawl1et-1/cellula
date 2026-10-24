'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  Group,
  IcosahedronGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  Vector3,
} from 'three';
import { liveChannels } from '@/engine/timeline/live';
import { createRng } from '@/lib/random';
import { useScenario } from '@/state/scenario';
import { CELL, CENTROSOME } from '../layout/cellLayout';
import { PALETTE } from '../palette';
import { createOrganicMaterial } from '../shaders/organicMaterial';

/**
 * Whole-cell choreography of M phase, driven by the scenario time (stages from the mitosis content file):
 * prophase 0–0.18 · prometaphase –0.32 · metaphase –0.48 · anaphase –0.64 · telophase –0.8 · cytokinesis –1.
 * Simplified: 8 chromosomes, a horizontal spindle (x axis) and organelles that stay in place.
 */
const PAIRS = 8;
const AXIS = new Vector3(1, 0, 0);
const POLE_DISTANCE = 40;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function Mitosis() {
  const group = useRef<Group>(null);
  const chromatids = useRef<InstancedMesh>(null);
  const fibres = useRef<InstancedMesh>(null);
  const poles = useRef<InstancedMesh>(null);
  const nucleusA = useRef<Mesh>(null);
  const nucleusB = useRef<Mesh>(null);

  const assets = useMemo(() => {
    const rng = createRng(4646);
    const start = Array.from({ length: PAIRS }, () => rng.direction().multiplyScalar(rng.range(4, 16)));
    const plate = Array.from({ length: PAIRS }, (_, k) => {
      const a = (k / PAIRS) * Math.PI * 2 + rng.range(-0.2, 0.2);
      const r = k % 2 ? 6 : 13;
      return new Vector3(rng.range(-0.8, 0.8), Math.cos(a) * r, Math.sin(a) * r);
    });
    // Metaphase chromosomes are micrometres long: here ~1 µm wide pairs, 1–1.2 µm long.
    const chromatidGeometry = new CapsuleGeometry(1, 8, 6, 12);
    chromatidGeometry.setAttribute(
      'aSeed',
      new InstancedBufferAttribute(new Float32Array(PAIRS * 2).map((_, i) => (i * 0.37) % 1), 1),
    );
    const chromatidMaterial = createOrganicMaterial(
      {
        color: PALETTE.chromatin.a,
        color2: PALETTE.chromatin.b,
        sssColor: PALETTE.chromatin.b,
        emissive: PALETTE.chromatin.glow,
        emissiveStrength: 1.4,
        pattern: 'fibrous',
        patternScale: 0.9,
        sss: 1,
        gloss: 0.5,
        dimmable: false,
      },
      true,
    );
    const fibreGeometry = new CylinderGeometry(0.07, 0.07, 1, 4, 1, true);
    fibreGeometry.translate(0, 0.5, 0);
    const fibreMaterial = new MeshBasicMaterial({ color: new Color(PALETTE.microtubule.glow).multiplyScalar(1.5) });
    const poleMaterial = new MeshBasicMaterial({ color: new Color(PALETTE.centrosome.glow).multiplyScalar(3) });
    const envelope = createOrganicMaterial({
      color: PALETTE.nucleus.envelope,
      color2: PALETTE.nucleus.envelope2,
      sssColor: PALETTE.nucleus.envelope2,
      sss: 0.8,
      gloss: 0.8,
      transparent: true,
      opacity: 0.25,
      rimOpacity: 0.8,
      rim: 1.6,
      dimmable: false,
    });
    const astral = Array.from({ length: 14 }, () => rng.direction());
    return {
      start,
      plate,
      astral,
      chromatidGeometry,
      chromatidMaterial,
      fibreGeometry,
      fibreMaterial,
      poleGeometry: new IcosahedronGeometry(1.5, 2),
      poleMaterial,
      nucleusGeometry: new IcosahedronGeometry(1, 16),
      envelope,
    };
  }, []);

  const dummy = useMemo(() => new Object3D(), []);
  const up = useMemo(() => new Vector3(0, 1, 0), []);

  useFrame(() => {
    const g = group.current;
    const { process, t } = useScenario.getState();
    const active = !!process?.actors.some((a) => a.actor === 'mitosis');
    if (!g) return;
    g.visible = active;
    if (!active) return;

    const C = CELL.nucleus.center;
    const condensed = liveChannels['nucleus.chromatinCondensation'];
    // Centrosomes travel from their interphase position to opposite poles during prophase.
    const travel = smoothstep(0.02, 0.2, t);
    const poleA = CENTROSOME.clone().lerp(C.clone().addScaledVector(AXIS, -POLE_DISTANCE), travel);
    const poleB = CENTROSOME.clone().lerp(C.clone().addScaledVector(AXIS, POLE_DISTANCE), travel);

    const toPlate = smoothstep(0.2, 0.44, t);
    const separate = smoothstep(0.48, 0.64, t);
    const gather = smoothstep(0.62, 0.78, t);

    const kinetochores: Vector3[] = [];
    let i = 0;
    for (let k = 0; k < PAIRS; k++) {
      const centre = assets.start[k]!.clone().lerp(assets.plate[k]!, toPlate).add(C);
      for (const side of [-1, 1]) {
        // Anaphase: each sister chromatid is pulled to its pole; telophase: they gather there.
        const pole = side < 0 ? poleA : poleB;
        const pos = centre.clone().addScaledVector(AXIS, side * (0.7 + separate * (POLE_DISTANCE - 9)));
        pos.lerp(pole.clone().addScaledVector(AXIS, -side * 9).add(assets.plate[k]!.clone().multiplyScalar(0.4)), gather);
        kinetochores.push(pos.clone());
        // Sisters form an X while paired, then trail behind their centromere as they move.
        const tilt = (1 - separate) * side * 0.45 + separate * side * 1.2;
        dummy.position.copy(pos);
        dummy.quaternion.setFromAxisAngle(new Vector3(0, 0, 1), tilt).multiply(
          new Quaternion().setFromAxisAngle(AXIS, (k / PAIRS) * Math.PI),
        );
        dummy.scale.setScalar(condensed);
        dummy.updateMatrix();
        chromatids.current?.setMatrixAt(i++, dummy.matrix);
      }
    }
    if (chromatids.current) chromatids.current.instanceMatrix.needsUpdate = true;

    // Spindle fibres: kinetochore fibres to each chromatid, plus astral rays.
    const spindle = smoothstep(0.14, 0.26, t) * (1 - smoothstep(0.74, 0.84, t));
    const f = fibres.current;
    if (f) {
      let n = 0;
      const fibre = (from: Vector3, to: Vector3) => {
        const d = to.clone().sub(from);
        dummy.position.copy(from);
        dummy.quaternion.setFromUnitVectors(up, d.clone().normalize());
        dummy.scale.set(spindle, d.length() * spindle, spindle);
        dummy.updateMatrix();
        f.setMatrixAt(n++, dummy.matrix);
      };
      kinetochores.forEach((k, j) => fibre(j % 2 === 0 ? poleA : poleB, k));
      for (const dir of assets.astral) {
        fibre(poleA, poleA.clone().addScaledVector(dir, 14));
        fibre(poleB, poleB.clone().addScaledVector(dir, 14));
      }
      f.count = n;
      f.instanceMatrix.needsUpdate = true;
    }

    if (poles.current) {
      [poleA, poleB].forEach((p, j) => {
        dummy.position.copy(p);
        dummy.quaternion.identity();
        dummy.scale.setScalar(Math.max(travel, 0.001));
        dummy.updateMatrix();
        poles.current!.setMatrixAt(j, dummy.matrix);
      });
      poles.current.instanceMatrix.needsUpdate = true;
    }

    // Telophase: a new envelope grows around each set of chromosomes.
    const reform = smoothstep(0.66, 0.84, t);
    [nucleusA.current, nucleusB.current].forEach((m, j) => {
      if (!m) return;
      m.visible = reform > 0.001;
      m.position.copy(j === 0 ? poleA : poleB).addScaledVector(AXIS, j === 0 ? 9 : -9);
      m.scale.setScalar(4 + reform * 12);
    });
  });

  return (
    <group ref={group} name="mitosis" visible={false}>
      <instancedMesh
        ref={chromatids}
        args={[assets.chromatidGeometry, assets.chromatidMaterial, PAIRS * 2]}
        frustumCulled={false}
      />
      <instancedMesh ref={fibres} args={[assets.fibreGeometry, assets.fibreMaterial, 64]} frustumCulled={false} />
      <instancedMesh ref={poles} args={[assets.poleGeometry, assets.poleMaterial, 2]} frustumCulled={false} />
      <mesh ref={nucleusA} geometry={assets.nucleusGeometry} material={assets.envelope} renderOrder={5} />
      <mesh ref={nucleusB} geometry={assets.nucleusGeometry} material={assets.envelope} renderOrder={5} />
    </group>
  );
}
