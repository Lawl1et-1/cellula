'use client';

import { useMemo } from 'react';
import { BufferAttribute, BufferGeometry, Color, Quaternion, SphereGeometry, Vector3 } from 'three';
import { createRng } from '@/lib/random';
import { CELL, GOLGI_CENTER } from '../layout/cellLayout';
import { PALETTE } from '../palette';
import { createOrganicMaterial, type OrganicOptions } from '../shaders/organicMaterial';
import { centered } from './Instanced';

const GOLGI: OrganicOptions = {
  color: PALETTE.golgi.cis,
  sssColor: PALETTE.golgi.sss,
  pattern: 'vertexColor',
  patternScale: 0.3,
  vertexColors: true,
  vertexSeed: true,
  sss: 1,
  gloss: 0.85,
  diffuse: 0.45,
  rim: 1.4,
  wobble: 0.3,
  wobbleFreq: 0.25,
};

/** Stack of curved cisternae, cis face towards the nucleus and ER, trans face towards the membrane. */
function golgiGeometry() {
  const rng = createRng(808);
  const cis = new Color(PALETTE.golgi.cis);
  const trans = new Color(PALETTE.golgi.trans);
  const parts: BufferGeometry[] = [];
  const count = 6;
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1);
    const R = 13 - Math.abs(t - 0.45) * 7 + rng.range(-0.6, 0.6);
    const g = new SphereGeometry(1, 56, 14);
    const pos = g.attributes.position!;
    const p = new Vector3();
    for (let k = 0; k < pos.count; k++) {
      p.fromBufferAttribute(pos, k);
      const rr = Math.hypot(p.x, p.z);
      // Dilated rims, thin centre: cisternae are flattened sacs that swell at their edges.
      const thickness = 0.45 + 0.75 * Math.pow(rr, 4);
      p.set(p.x * R, p.y * thickness, p.z * R * 0.78);
      p.y -= 0.028 * (p.x * p.x + p.z * p.z) - i * 2.2;
      pos.setXYZ(k, p.x, p.y, p.z);
    }
    g.computeVertexNormals();
    g.deleteAttribute('uv');
    const c = cis.clone().lerp(trans, t);
    const colors = new Float32Array(pos.count * 3);
    for (let k = 0; k < pos.count; k++) colors.set([c.r, c.g, c.b], k * 3);
    g.setAttribute('color', new BufferAttribute(colors, 3));
    g.setAttribute('aSeed', new BufferAttribute(new Float32Array(pos.count).fill(rng.next()), 1));
    parts.push(g.toNonIndexed());
  }
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), CELL.pole);
  // One mesh per cisterna so they are drawn front-to-back (a merged stack overdraws 6×).
  return parts.map((g) => {
    g.applyQuaternion(q);
    g.translate(GOLGI_CENTER.x, GOLGI_CENTER.y, GOLGI_CENTER.z);
    return centered(g);
  });
}

export function Golgi() {
  const { cisternae, material } = useMemo(
    () => ({ cisternae: golgiGeometry(), material: createOrganicMaterial(GOLGI) }),
    [],
  );
  return (
    <group name="golgi">
      {cisternae.map((c, i) => (
        <mesh key={i} geometry={c.geometry} material={material} position={c.position} />
      ))}
    </group>
  );
}
