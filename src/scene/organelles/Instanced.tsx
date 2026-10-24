'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, Vector3 } from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createOrganicMaterial, type OrganicOptions } from '../shaders/organicMaterial';
import { useHighlight } from '../interaction/highlight';
import type { OrganelleId } from '@/content/schema/common';

interface Props {
  geometry: BufferGeometry;
  material: OrganicOptions;
  matrices: Matrix4[];
  seeds: number[];
  renderOrder?: number;
  name?: string;
  /** Skip the whole draw call while the camera is farther than this from every instance. */
  cullBeyond?: number;
  /** Organelle this mesh belongs to (hover / selection highlight). */
  organelle?: OrganelleId;
}

/**
 * Welds a geometry for instancing. three.js polyhedra are non-indexed (a 20-face ribosome is 60 vertices
 * instead of 12): with tens of thousands of instances the vertex shader cost explodes without this.
 */
export function weld(geometry: BufferGeometry) {
  const g = geometry.clone();
  if (g.type === 'IcosahedronGeometry') {
    // Low-detail icosahedra come with flat normals: weld and smooth them (no faceted "gems").
    g.deleteAttribute('normal');
    g.deleteAttribute('uv');
    const smooth = mergeVertices(g);
    smooth.computeVertexNormals();
    return smooth;
  }
  if (!g.attributes.uv || !g.index) g.deleteAttribute('uv');
  return g.index ? g : mergeVertices(g);
}

/**
 * Re-centres a world-space geometry on its own origin. three.js sorts opaque meshes front-to-back by
 * object position, so layered structures split into centred meshes avoid heavy overdraw.
 */
export function centered(geometry: BufferGeometry) {
  geometry.computeBoundingBox();
  const position = geometry.boundingBox!.getCenter(new Vector3());
  geometry.translate(-position.x, -position.y, -position.z);
  return { geometry, position };
}

/** One draw call for every copy of an organelle; per-instance life comes from the aSeed attribute. */
export function InstancedOrganelle({ geometry, material, matrices, seeds, renderOrder, name, cullBeyond, organelle }: Props) {
  const ref = useRef<InstancedMesh>(null);
  const mat = useMemo(() => createOrganicMaterial(material, true), [material]);
  const geo = useMemo(() => {
    const g = weld(geometry);
    g.setAttribute('aSeed', new InstancedBufferAttribute(new Float32Array(seeds), 1));
    return g;
  }, [geometry, seeds]);
  useHighlight(organelle, mat);
  const centers = useMemo(() => matrices.map((m) => new Vector3().setFromMatrixPosition(m)), [matrices]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [matrices]);

  useLayoutEffect(
    () => () => {
      mat.dispose();
      geo.dispose();
    },
    [mat, geo],
  );

  useFrame(({ camera }) => {
    const mesh = ref.current;
    if (!mesh || cullBeyond === undefined) return;
    const limit = cullBeyond * cullBeyond;
    let near = false;
    for (let i = 0; i < centers.length && !near; i++) near = centers[i]!.distanceToSquared(camera.position) < limit;
    mesh.visible = near;
  });

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
