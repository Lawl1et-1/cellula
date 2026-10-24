'use client';

import { useMemo } from 'react';
import { BufferGeometry, CapsuleGeometry, ExtrudeGeometry, IcosahedronGeometry, Shape, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createRng } from '@/lib/random';
import { CELL, orientTangent, scatter, toMatrices } from '../layout/cellLayout';
import { PALETTE } from '../palette';
import type { OrganicOptions } from '../shaders/organicMaterial';
import { InstancedOrganelle } from './Instanced';

/** Capsule dimensions in local space: ~0.5 µm wide, cylinder part 0.9 µm before per-instance stretching. */
const RADIUS = 2.4;
const LENGTH = 9;
const INNER_RADIUS = 2.0;

/** The cross-section opens between these camera distances. */
const CUTAWAY: [number, number] = [24, 42];
/** Interior detail exists only near the camera. */
const INTERIOR_FADE: [number, number] = [44, 60];

/** Shared motion so the three layers stay locked together (bend and drift are seed-driven). */
const MOTION = { bend: 1.3, drift: 0.7 };

const OUTER: OrganicOptions = {
  ...MOTION,
  color: PALETTE.mitochondria.a,
  color2: PALETTE.mitochondria.b,
  sssColor: PALETTE.mitochondria.sss,
  emissive: PALETTE.mitochondria.glow,
  emissiveStrength: 0.8,
  pattern: 'cristae',
  patternScale: 2.4,
  sss: 1,
  gloss: 0.9,
  diffuse: 0.45,
  rim: 1.3,
  wobble: 0.22,
  wobbleFreq: 0.35,
  wobbleSpeed: 0.4,
  doubleSide: true,
  cutaway: CUTAWAY,
  cutawayEdge: '#ffb27a',
};

const INNER: OrganicOptions = {
  ...MOTION,
  color: '#c24a32',
  sssColor: '#ff9a70',
  sss: 1,
  gloss: 0.7,
  diffuse: 0.35,
  transparent: true,
  opacity: 0.18,
  rimOpacity: 0.55,
  doubleSide: true,
  fade: INTERIOR_FADE,
  cutaway: CUTAWAY,
  cutawayEdge: '#ff9a5c',
};

/** Cristae carry the respiratory chain and ATP synthase: they glow with the membrane potential. */
const CRISTAE: OrganicOptions = {
  ...MOTION,
  color: '#c85634',
  color2: '#f29a5c',
  sssColor: '#ff9a66',
  emissive: '#ff6a24',
  emissiveStrength: 0.35,
  pattern: 'fibrous',
  patternScale: 1.2,
  sss: 1,
  gloss: 0.6,
  diffuse: 0.5,
  doubleSide: true,
  fade: INTERIOR_FADE,
  cutaway: CUTAWAY,
  cutawayEdge: '#ffb27a',
};

const MATRIX_GRANULES: OrganicOptions = {
  ...MOTION,
  color: '#e8b07a',
  emissive: '#ffb066',
  emissiveStrength: 0.25,
  sss: 0.6,
  gloss: 0.4,
  fade: INTERIOR_FADE,
  cutaway: CUTAWAY,
};

/** Radius of the inner compartment at height y (cylinder + hemispherical caps). */
function innerRadiusAt(y: number) {
  const half = LENGTH / 2;
  if (Math.abs(y) <= half) return INNER_RADIUS;
  return Math.sqrt(Math.max(0, INNER_RADIUS ** 2 - (Math.abs(y) - half) ** 2));
}

/**
 * Lamellar cristae: shelves folding in from the inner membrane, alternating sides,
 * perpendicular to the long axis (the classic "baffle" model, simplified).
 */
function cristaeGeometry() {
  const rng = createRng(1313);
  const parts: BufferGeometry[] = [];
  let i = 0;
  for (let y = -LENGTH / 2 - 1.2; y <= LENGTH / 2 + 1.2; y += 0.78, i++) {
    const r = innerRadiusAt(y) * 0.98;
    if (r < 0.9) continue;
    // Free edge reaches 55–85 % across the matrix.
    const limit = -r + 2 * r * rng.range(0.55, 0.85);
    const a0 = Math.acos(Math.min(1, limit / r));
    const shape = new Shape();
    const steps = 18;
    for (let k = 0; k <= steps; k++) {
      const a = a0 + ((Math.PI * 2 - 2 * a0) * k) / steps;
      const x = r * Math.cos(a);
      const z = r * Math.sin(a);
      if (k === 0) shape.moveTo(x, z);
      else shape.lineTo(x, z);
    }
    // Rounded free edge.
    shape.quadraticCurveTo(limit + 0.35, 0, r * Math.cos(a0), r * Math.sin(a0));
    // Each crista is a flattened fold of inner membrane (~20 nm thick, enlarged here) with a rounded rim.
    const g = new ExtrudeGeometry(shape, {
      depth: 0.08,
      bevelEnabled: true,
      bevelThickness: 0.07,
      bevelSize: 0.07,
      bevelSegments: 1,
      curveSegments: 4,
    });
    g.translate(0, 0, -0.04);
    g.rotateX(-Math.PI / 2);
    // Gentle undulation so the shelves are not machined planes.
    const pos = g.attributes.position!;
    const phase = rng.range(0, 6.28);
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k);
      const z = pos.getZ(k);
      pos.setY(k, pos.getY(k) + 0.18 * Math.sin(x * 1.7 + phase) * Math.cos(z * 1.3 + phase));
    }
    g.computeVertexNormals();
    g.rotateY((i % 2 ? Math.PI : 0) + rng.range(-0.5, 0.5));
    g.translate(0, y + rng.range(-0.12, 0.12), 0);
    g.deleteAttribute('uv');
    parts.push(g.toNonIndexed());
  }
  return mergeGeometries(parts)!;
}

function granulesGeometry() {
  const rng = createRng(1414);
  const parts: BufferGeometry[] = [];
  const p = new Vector3();
  for (let k = 0; k < 7; k++) {
    p.set(rng.range(-1, 1), rng.range(-LENGTH / 2, LENGTH / 2), rng.range(-1, 1));
    const g = new IcosahedronGeometry(rng.range(0.16, 0.26), 1);
    g.deleteAttribute('uv');
    g.translate(p.x, p.y, p.z);
    parts.push(g);
  }
  return mergeGeometries(parts)!;
}

export function Mitochondria() {
  const layout = useMemo(() => {
    // Real mitochondria: ~0.5 µm wide, 1–4 µm long (here 5 units wide, ~12–22 long).
    const placed = orientTangent(
      scatter(11, 64, {
        spacing: 10,
        margin: 3,
        scale: (rng) => new Vector3(1, rng.range(0.75, 1.45), 1).multiplyScalar(rng.range(0.85, 1.12)),
        bias: (p) => (p.distanceTo(CELL.nucleus.center) < 60 ? 1 : 0.55),
      }),
      12,
    );
    return { matrices: toMatrices(placed), seeds: placed.map((o) => o.seed) };
  }, []);

  const geometries = useMemo(
    () => ({
      outer: new CapsuleGeometry(RADIUS, LENGTH, 8, 18),
      inner: new CapsuleGeometry(INNER_RADIUS, LENGTH, 6, 16),
      cristae: cristaeGeometry(),
      granules: granulesGeometry(),
    }),
    [],
  );

  return (
    <group name="mitochondria">
      <InstancedOrganelle
        name="mitochondria-cristae"
        geometry={geometries.cristae}
        material={CRISTAE}
        cullBeyond={INTERIOR_FADE[1] + 12}
        {...layout}
      />
      <InstancedOrganelle
        name="mitochondria-granules"
        geometry={geometries.granules}
        material={MATRIX_GRANULES}
        cullBeyond={INTERIOR_FADE[1] + 12}
        {...layout}
      />
      <InstancedOrganelle name="mitochondria-outer" geometry={geometries.outer} material={OUTER} {...layout} />
      <InstancedOrganelle
        name="mitochondria-inner"
        geometry={geometries.inner}
        material={INNER}
        renderOrder={5}
        cullBeyond={INTERIOR_FADE[1] + 12}
        {...layout}
      />
    </group>
  );
}
