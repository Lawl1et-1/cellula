import { Matrix4, Vector3 } from 'three';
import type { OrganelleId } from '@/content/schema/common';
import type { Focus } from '@/state/selection';
import { CELL, CENTROSOME, GOLGI_CENTER, randomCytoplasmPoint } from '../layout/cellLayout';
import {
  lysosomesLayout,
  mitochondriaLayout,
  peroxisomesLayout,
  vesiclesLayout,
  healthy,
  type InstanceLayout,
} from '../layout/organelleLayout';
import { roughErAnchors, smoothErNodes } from '../organelles/EndoplasmicReticulum';
import { createRng } from '@/lib/random';

const tmp = new Vector3();
const toTuple = (v: Vector3): [number, number, number] => [v.x, v.y, v.z];

/** Framing radius per instanced organelle (scene units), before instance scale. */
export const INSTANCE_RADIUS: Partial<Record<OrganelleId, number>> = {
  mitochondrion: 8,
  lysosome: 3,
  peroxisome: 2.2,
  vesicle: 1.6,
};

export const INSTANCED: Partial<Record<OrganelleId, () => InstanceLayout>> = {
  mitochondrion: () => healthy(mitochondriaLayout(), 'mitochondrion'),
  lysosome: () => healthy(lysosomesLayout(), 'lysosome'),
  peroxisome: () => healthy(peroxisomesLayout(), 'peroxisome'),
  vesicle: vesiclesLayout,
};

const NUCLEOLUS_OFFSET = new Vector3(7, 5, -4);

let cytoplasmSpots: Vector3[] | null = null;
const cytoplasmPoints = () => {
  if (cytoplasmSpots) return cytoplasmSpots;
  const rng = createRng(919);
  cytoplasmSpots = Array.from({ length: 40 }, () => randomCytoplasmPoint(rng, new Vector3(), 8).clone());
  return cytoplasmSpots;
};

function nearest(points: Vector3[], from: Vector3) {
  let best = points[0]!;
  for (const p of points) if (p.distanceToSquared(from) < best.distanceToSquared(from)) best = p;
  return best;
}

export function instanceFocus(organelle: OrganelleId, instance: number): Focus | null {
  const layout = INSTANCED[organelle]?.();
  const m: Matrix4 | undefined = layout?.matrices[instance];
  if (!m) return null;
  const scale = new Vector3().setFromMatrixScale(m);
  const axis = new Vector3().setFromMatrixColumn(m, 1).normalize();
  return {
    organelle,
    instance,
    position: toTuple(tmp.setFromMatrixPosition(m)),
    radius: (INSTANCE_RADIUS[organelle] ?? 3) * Math.max(scale.x, scale.y, scale.z),
    axis: organelle === 'mitochondrion' ? toTuple(axis) : undefined,
  };
}

/** Where to look when an organelle is chosen from a list or a link: the instance nearest the camera. */
export function anchorFor(organelle: OrganelleId, camera: Vector3): Focus {
  const layout = INSTANCED[organelle]?.();
  if (layout) {
    let best = 0;
    let bestD = Infinity;
    layout.matrices.forEach((m, i) => {
      const d = tmp.setFromMatrixPosition(m).distanceToSquared(camera);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return instanceFocus(organelle, best)!;
  }
  const at = (p: Vector3, radius: number): Focus => ({ organelle, position: toTuple(p), radius });
  switch (organelle) {
    case 'nucleus':
      return at(CELL.nucleus.center, CELL.nucleus.radius);
    case 'dna':
      // Just outside the envelope, which fades while DNA is selected.
      return at(CELL.nucleus.center, 11);
    case 'nucleolus':
      return at(CELL.nucleus.center.clone().add(NUCLEOLUS_OFFSET), 7);
    case 'plasma-membrane':
      return at(new Vector3(), 100);
    case 'rough-er':
      return at(nearest(roughErAnchors(), camera), 9);
    case 'smooth-er':
      return at(nearest(smoothErNodes(), camera), 9);
    case 'ribosome':
      return at(nearest(roughErAnchors(), camera), 3);
    case 'golgi':
      // Framed side-on so the stacked cisternae read as layers.
      return { ...at(GOLGI_CENTER, 14), axis: toTuple(CELL.pole) };
    case 'centrosome':
      return at(CENTROSOME, 4);
    case 'cytoskeleton':
      return at(CENTROSOME, 24);
    default:
      return at(nearest(cytoplasmPoints(), camera), 22);
  }
}
