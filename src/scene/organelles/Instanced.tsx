'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { BufferGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4 } from 'three';
import { createOrganicMaterial, type OrganicOptions } from '../shaders/organicMaterial';

interface Props {
  geometry: BufferGeometry;
  material: OrganicOptions;
  matrices: Matrix4[];
  seeds: number[];
  renderOrder?: number;
  name?: string;
}

/** One draw call for every copy of an organelle; per-instance life comes from the aSeed attribute. */
export function InstancedOrganelle({ geometry, material, matrices, seeds, renderOrder, name }: Props) {
  const ref = useRef<InstancedMesh>(null);
  const mat = useMemo(() => createOrganicMaterial(material, true), [material]);
  const geo = useMemo(() => {
    const g = geometry.clone();
    g.setAttribute('aSeed', new InstancedBufferAttribute(new Float32Array(seeds), 1));
    return g;
  }, [geometry, seeds]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [matrices]);

  useLayoutEffect(() => () => {
    mat.dispose();
    geo.dispose();
  }, [mat, geo]);

  return (
    <instancedMesh
      ref={ref}
      name={name}
      args={[geo, mat, matrices.length]}
      frustumCulled={false}
      renderOrder={renderOrder}
    />
  );
}
