import { Vector3 } from 'three';
import type { AnchorId } from '@/content/schema/scenario';
import type { OrganelleId } from '@/content/schema/common';
import type { Focus } from '@/state/selection';
import { CELL, GOLGI_CENTER } from '../layout/cellLayout';
import { healthy, lysosomesLayout, mitochondriaLayout } from '../layout/organelleLayout';
import { roughErAnchors } from '../organelles/EndoplasmicReticulum';
import { membranePoint } from '../organelles/Membrane';

/** Side of the cell where secretion and uptake are shown: the Golgi pole, facing the default camera. */
export const EXCHANGE_DIR = new Vector3(0.75, 0.12, 0.65).normalize();
const CYTOPLASM_SPOT = new Vector3(40, -30, 40);

const nearestInstance = (matrices: { elements: number[] }[], to: Vector3) => {
  let best = new Vector3();
  let bestD = Infinity;
  const p = new Vector3();
  for (const m of matrices) {
    p.set(m.elements[12]!, m.elements[13]!, m.elements[14]!);
    const d = p.distanceToSquared(to);
    if (d < bestD) {
      bestD = d;
      best = p.clone();
    }
  }
  return best;
};

let cache: Record<AnchorId, Vector3> | null = null;

/** World positions of the named places scenarios refer to. */
export function anchors(): Record<AnchorId, Vector3> {
  if (cache) return cache;
  const membrane = membranePoint(EXCHANGE_DIR);
  const endosome = membrane.clone().lerp(CELL.nucleus.center, 0.22);
  const er = roughErAnchors()[0]!.clone();
  const toEr = er.clone().sub(CELL.nucleus.center).normalize();
  cache = {
    outside: membrane.clone().addScaledVector(EXCHANGE_DIR, 28),
    membrane,
    cytoplasm: CYTOPLASM_SPOT.clone(),
    endosome,
    nucleus: CELL.nucleus.center.clone(),
    'nucleus.pore': CELL.nucleus.center.clone().addScaledVector(toEr, CELL.nucleus.radius),
    'rough-er': er,
    'golgi.cis': GOLGI_CENTER.clone().addScaledVector(CELL.pole, -1),
    'golgi.trans': GOLGI_CENTER.clone().addScaledVector(CELL.pole, 13),
    mitochondrion: nearestInstance(healthy(mitochondriaLayout(), 'mitochondrion').matrices, CYTOPLASM_SPOT),
    lysosome: nearestInstance(healthy(lysosomesLayout(), 'lysosome').matrices, endosome),
    peroxisome: CYTOPLASM_SPOT.clone().add(new Vector3(6, 4, -5)),
  };
  return cache;
}

const FOCUS_ANCHOR: Partial<Record<OrganelleId, [AnchorId, number]>> = {
  'plasma-membrane': ['membrane', 26],
  cytoplasm: ['cytoplasm', 24],
  mitochondrion: ['mitochondrion', 9],
  lysosome: ['lysosome', 8],
  'rough-er': ['rough-er', 14],
};

interface StageCamera {
  radius?: number;
  view?: 'organelle' | 'cell';
  sideOn?: [number, number, number];
}

/** Camera framing for a scenario stage: the very place where its actors play. */
export function stageFocus(organelle: OrganelleId, camera?: StageCamera): Focus {
  const base = baseFocus(organelle);
  if (camera?.view === 'cell') return { organelle, position: [0, 0, 0], radius: camera.radius ?? 120, axis: camera.sideOn };
  return { ...base, radius: camera?.radius ?? base.radius, axis: camera?.sideOn ?? base.axis };
}

function baseFocus(organelle: OrganelleId): Focus {
  const a = anchors();
  const mapped = FOCUS_ANCHOR[organelle];
  if (mapped) {
    const p = a[mapped[0]];
    return { organelle, position: [p.x, p.y, p.z], radius: mapped[1] };
  }
  if (organelle === 'golgi') {
    return { organelle, position: [GOLGI_CENTER.x, GOLGI_CENTER.y, GOLGI_CENTER.z], radius: 16, axis: [CELL.pole.x, CELL.pole.y, CELL.pole.z] };
  }
  const c = CELL.nucleus.center;
  return { organelle, position: [c.x, c.y, c.z], radius: organelle === 'nucleus' ? 38 : organelle === 'dna' ? 22 : 30 };
}
