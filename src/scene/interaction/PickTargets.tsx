'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useThree, type ThreeEvent } from '@react-three/fiber';
import {
  CapsuleGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Object3D,
} from 'three';
import type { OrganelleId } from '@/content/schema/common';
import { useSelection, type Focus, type Target } from '@/state/selection';
import { useScene } from '@/state/scene';
import { CELL, CENTROSOME, GOLGI_CENTER, cellDistance } from '../layout/cellLayout';
import { roughErAnchors, smoothErNodes } from '../organelles/EndoplasmicReticulum';
import { INSTANCED, anchorFor, instanceFocus } from './anchors';

/**
 * Invisible, low-poly stand-ins used only for picking. They live on layer 1, which the camera never
 * renders but the raycaster tests, so clicking is cheap and independent of the visual detail.
 */
export const PICK_LAYER = 1;

const material = new MeshBasicMaterial();

function Proxies({
  geometry,
  matrices,
  organelle,
  radius,
}: {
  geometry: BufferGeometry;
  matrices: Matrix4[];
  organelle: OrganelleId;
  radius?: number;
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    matrices.forEach((m, i) => mesh.setMatrixAt(i, m));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.layers.set(PICK_LAYER);
  }, [matrices]);
  return (
    <instancedMesh
      ref={ref}
      args={[geometry, material, matrices.length]}
      userData={{ organelle, instanced: !!INSTANCED[organelle], radius }}
    />
  );
}

const at = (p: Vector3, s = 1) => new Matrix4().compose(p, new Quaternion(), new Vector3(s, s, s));

function hitTarget(object: Object3D, instanceId: number | undefined): Target | null {
  const organelle = object.userData.organelle as OrganelleId | undefined;
  if (!organelle) return null;
  return object.userData.instanced ? { organelle, instance: instanceId } : { organelle };
}

/** Membrane hits are a fallback: anything visible through it wins. Inside the cell, empty space is cytoplasm. */
function pick(e: ThreeEvent<PointerEvent | MouseEvent>, cameraInside: boolean) {
  let fallback: { target: Target; point: Vector3 } | null = null;
  for (const hit of e.intersections) {
    const target = hitTarget(hit.object, hit.instanceId);
    if (!target) continue;
    if (target.organelle === 'plasma-membrane') {
      fallback ??= { target: cameraInside ? { organelle: 'cytoplasm' } : target, point: hit.point };
      continue;
    }
    return { target, point: hit.point, object: hit.object };
  }
  return fallback ? { ...fallback, object: null } : null;
}

export function PickTargets() {
  const raycaster = useThree((s) => s.raycaster);
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    raycaster.layers.set(PICK_LAYER);
  }, [raycaster]);

  const proxies = useMemo(() => {
    const sphere = new IcosahedronGeometry(1, 1);
    const capsule = new CapsuleGeometry(2.6, 9, 2, 8);
    const golgi = new Matrix4().compose(
      GOLGI_CENTER,
      new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), CELL.pole),
      new Vector3(14, 7, 12),
    );
    return [
      { organelle: 'mitochondrion' as const, geometry: capsule, matrices: INSTANCED.mitochondrion!().matrices },
      { organelle: 'lysosome' as const, geometry: sphere, matrices: INSTANCED.lysosome!().matrices.map((m) => m.clone().scale(new Vector3(2.4, 2.4, 2.4))) },
      { organelle: 'peroxisome' as const, geometry: sphere, matrices: INSTANCED.peroxisome!().matrices.map((m) => m.clone().scale(new Vector3(1.7, 1.7, 1.7))) },
      { organelle: 'vesicle' as const, geometry: sphere, matrices: INSTANCED.vesicle!().matrices.map((m) => m.clone().scale(new Vector3(1.2, 1.2, 1.2))) },
      { organelle: 'nucleus' as const, geometry: sphere, matrices: [at(CELL.nucleus.center, CELL.nucleus.radius + 0.5)] },
      { organelle: 'golgi' as const, geometry: sphere, matrices: [golgi] },
      { organelle: 'centrosome' as const, geometry: sphere, matrices: [at(CENTROSOME, 4)] },
      { organelle: 'rough-er' as const, geometry: sphere, matrices: roughErAnchors().map((p) => at(p, 4.5)) },
      { organelle: 'smooth-er' as const, geometry: sphere, matrices: smoothErNodes().map((p) => at(p, 3.2)) },
      {
        organelle: 'plasma-membrane' as const,
        geometry: sphere,
        matrices: [new Matrix4().makeScale(CELL.radii.x * 1.03, CELL.radii.y * 1.03, CELL.radii.z * 1.03)],
      },
    ];
  }, []);

  const insideCell = () => cellDistance(camera.position) < 1;

  const onMove = (e: ThreeEvent<PointerEvent>) => {
    if (e.buttons) return; // dragging the camera
    const hit = pick(e, insideCell());
    useSelection.getState().hover(hit?.target ?? null);
    gl.domElement.style.cursor = hit ? 'pointer' : '';
  };

  const onOut = () => {
    useSelection.getState().hover(null);
    gl.domElement.style.cursor = '';
  };

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 4) return; // it was a drag, not a click
    const hit = pick(e, insideCell());
    if (!hit) return;
    e.stopPropagation();
    const { target, point } = hit;
    let focus: Focus | null = null;
    if (target.instance !== undefined) focus = instanceFocus(target.organelle, target.instance);
    if (!focus) {
      const radius: Partial<Record<OrganelleId, number>> = {
        nucleus: CELL.nucleus.radius,
        golgi: 14,
        centrosome: 4,
        'rough-er': 9,
        'smooth-er': 9,
        'plasma-membrane': 100,
        cytoplasm: 22,
      };
      const center =
        target.organelle === 'nucleus'
          ? CELL.nucleus.center
          : target.organelle === 'golgi'
            ? GOLGI_CENTER
            : target.organelle === 'plasma-membrane'
              ? new Vector3()
              : point;
      focus =
        target.organelle === 'golgi'
          ? anchorFor('golgi', camera.position)
          : { ...target, position: [center.x, center.y, center.z], radius: radius[target.organelle] ?? 10 };
    }
    if (useScene.getState().cameraMode === 'flight') useScene.getState().setCameraMode('orbit');
    useSelection.getState().select(focus);
  };

  return (
    <group name="pick-targets" onPointerMove={onMove} onPointerOut={onOut} onClick={onClick}>
      {proxies.map((p) => (
        <Proxies key={p.organelle} {...p} />
      ))}
    </group>
  );
}
