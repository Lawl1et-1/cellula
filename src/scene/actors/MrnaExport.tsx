'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CatmullRomCurve3, Color, IcosahedronGeometry, InstancedMesh, MeshBasicMaterial, Object3D } from 'three';
import { createRng } from '@/lib/random';
import { useScenario } from '@/state/scenario';
import { useSelection } from '@/state/selection';
import { useUi } from '@/state/ui';
import { CELL } from '../layout/cellLayout';
import { chromatinSamples } from '../organelles/Nucleus';
import { roughErAnchors } from '../organelles/EndoplasmicReticulum';
import { timeScale } from '../time';
import { dnaZoom } from '../interaction/zoom';

const STREAMS = 14;
const PER_STREAM = 3;
/** Seconds for one messenger to go from its gene to the rough ER. */
const TRIP = 9;
const MRNA = new Color('#ff6fb0').multiplyScalar(3);

/**
 * Ambient gene expression while DNA is selected: messenger RNAs leave the chromatin, cross the envelope
 * through a pore and reach ribosomes on the rough ER. Hidden during scenarios, which tell their own story.
 */
export function MrnaExport() {
  const ref = useRef<InstancedMesh>(null);
  const presence = useRef(0);
  const clock = useRef(0);
  const dummy = useMemo(() => new Object3D(), []);
  const resources = useMemo(
    () => ({
      geometry: new IcosahedronGeometry(0.7, 1),
      material: new MeshBasicMaterial({ color: '#ffffff', toneMapped: false, transparent: true }),
    }),
    [],
  );
  const curves = useRef<CatmullRomCurve3[] | null>(null);

  useFrame((_, delta) => {
    const mesh = ref.current;
    if (!mesh) return;
    const active =
      useSelection.getState().selected?.organelle === 'dna' &&
      !useScenario.getState().scenario &&
      useUi.getState().dnaLevel === null &&
      dnaZoom.value < 0.4;
    presence.current += ((active ? 1 : 0) - presence.current) * Math.min(1, delta * 2);
    if (presence.current < 0.01) {
      mesh.visible = false;
      return;
    }
    mesh.visible = true;
    curves.current ??= buildCurves();
    clock.current += Math.min(delta, 0.1) * timeScale();
    let n = 0;
    curves.current.forEach((curve, s) => {
      for (let k = 0; k < PER_STREAM; k++) {
        const t = (clock.current / TRIP + s * 0.137 + k / PER_STREAM) % 1;
        // Grow in at the gene, shrink away on the ER (taken up by ribosomes).
        const size = Math.min(1, t * 8, (1 - t) * 6) * presence.current;
        curve.getPointAt(t, dummy.position);
        dummy.scale.set(size * 1.6, size, size);
        dummy.lookAt(curve.getPointAt(Math.min(1, t + 0.01)));
        dummy.updateMatrix();
        mesh.setMatrixAt(n, dummy.matrix);
        mesh.setColorAt(n, MRNA);
        n++;
      }
    });
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={ref}
      name="mrna-export"
      args={[resources.geometry, resources.material, STREAMS * PER_STREAM]}
      frustumCulled={false}
      visible={false}
    />
  );
}

/** Gene → just inside a pore → just outside it → a nearby patch of rough ER. */
function buildCurves() {
  const rng = createRng(4242);
  const center = CELL.nucleus.center;
  const radius = CELL.nucleus.radius;
  // ER patches closest to the nucleus: the rough ER is continuous with the nuclear envelope.
  const er = [...roughErAnchors()].sort((a, b) => a.distanceTo(center) - b.distanceTo(center)).slice(0, 40);
  return Array.from({ length: STREAMS }, (_, i) => {
    const target = rng.pick(er);
    const dir = target.clone().sub(center).normalize();
    const local = chromatinSamples.length ? chromatinSamples[(i * 37) % chromatinSamples.length]! : dir.clone().multiplyScalar(radius * 0.4);
    const gene = center.clone().add(local);
    const inside = center.clone().addScaledVector(dir, radius - 1.2);
    const outside = center.clone().addScaledVector(dir, radius + 1.6);
    const mid = outside.clone().lerp(target, 0.5).add(rng.direction().multiplyScalar(3));
    return new CatmullRomCurve3([gene, inside, outside, mid, target.clone()]);
  });
}
