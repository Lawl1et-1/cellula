'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  CatmullRomCurve3,
  Color,
  IcosahedronGeometry,
  InstancedMesh,
  MeshBasicMaterial,
  Object3D,
  Vector3,
} from 'three';
import type { ActorCue, CargoKind } from '@/content/schema/scenario';
import { activeCues, evaluateChannels, stageIndexAt } from '@/engine/timeline/evaluate';
import { liveChannels } from '@/engine/timeline/live';
import { STEP_EPSILON, useScenario } from '@/state/scenario';
import { useSelection } from '@/state/selection';
import { anchors, stageFocus } from './anchors';
import { Mitosis } from './Mitosis';

/** Look of each cargo kind: colour (HDR, so it blooms) and radius in scene units. */
const CARGO: Record<CargoKind, { color: string; intensity: number; size: number }> = {
  mrna: { color: '#ff6fb0', intensity: 3, size: 0.55 },
  protein: { color: '#8fe3ff', intensity: 3, size: 0.45 },
  vesicle: { color: '#bfe9ff', intensity: 1.6, size: 1.3 },
  glucose: { color: '#ffe28a', intensity: 3, size: 0.45 },
  pyruvate: { color: '#ffb35c', intensity: 3, size: 0.42 },
  atp: { color: '#b8ff3a', intensity: 3.5, size: 0.4 },
  ldl: { color: '#ffd59a', intensity: 2.2, size: 0.9 },
  oxygen: { color: '#7fd8ff', intensity: 2.5, size: 0.35 },
  virion: { color: '#ff4a3a', intensity: 3, size: 0.9 },
  cytokine: { color: '#ffe0f0', intensity: 2.5, size: 0.4 },
  uv: { color: '#b48cff', intensity: 4, size: 0.32 },
};

const POOL = 384;
/** Fading copies drawn behind each travelling cargo (motion trail). */
const TRAIL = 4;
const PULSES = 4;
const STAGGER = 0.16;

const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
const smooth = (x: number) => x * x * (3 - 2 * x);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** Pause between two steps when they are chained automatically (time to read the caption). */
const AUTOPLAY_PAUSE = 1.6;

/**
 * Advances time step by step, evaluates channels, frames the camera on each new step and tells the scene
 * what the step is about (focus mode). Each step plays at its own pace and holds on its last frame.
 */
function Player() {
  const lastStage = useRef<string | null>(null);
  const held = useRef(0);
  useFrame((_, delta) => {
    const s = useScenario.getState();
    const p = s.scenario;
    if (!p) {
      if (lastStage.current !== null) {
        evaluateChannels([], 0, liveChannels);
        useSelection.getState().setFocusKeys([]);
        lastStage.current = null;
      }
      return;
    }
    if (s.playing) {
      const i = stageIndexAt(p.stages, s.t);
      const stage = p.stages[i]!;
      const [a, b] = stage.range;
      const last = i === p.stages.length - 1;
      const end = last ? 1 : b - STEP_EPSILON;
      const dt = Math.min(delta, 0.1) * s.speed;
      let t = s.t + (dt * (b - a)) / stage.seconds;
      if (t >= end) {
        t = end;
        if (last || !s.autoplay) useScenario.setState({ t, playing: false });
        else if ((held.current += dt) >= AUTOPLAY_PAUSE) {
          held.current = 0;
          useScenario.setState({ t: b + STEP_EPSILON });
        } else useScenario.setState({ t });
      } else useScenario.setState({ t });
    }
    const t = useScenario.getState().t;
    evaluateChannels(p.tracks, t, liveChannels);
    const stage = p.stages[stageIndexAt(p.stages, t)]!;
    const key = `${p.id}:${stage.id}`;
    if (key !== lastStage.current) {
      lastStage.current = key;
      held.current = 0;
      const keys = [...(stage.focus ? [stage.focus] : []), ...stage.highlight];
      useSelection.getState().setFocusKeys(keys.length ? keys : ['cytoplasm']);
      if (stage.focus) useSelection.getState().frame(stageFocus(stage.focus, stage.camera), null);
    }
  }, -10);
  return null;
}

function Tokens() {
  const ref = useRef<InstancedMesh>(null);
  const pulseRef = useRef<InstancedMesh>(null);
  const { geometry, material, pulseMaterial } = useMemo(
    () => ({
      geometry: new IcosahedronGeometry(1, 2),
      material: new MeshBasicMaterial({ color: '#ffffff' }),
      pulseMaterial: new MeshBasicMaterial({
        color: new Color('#ffd9a0').multiplyScalar(0.5),
        transparent: true,
        opacity: 0.35,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    }),
    [],
  );
  const curves = useMemo(() => new WeakMap<ActorCue, CatmullRomCurve3>(), []);
  const dummy = useMemo(() => new Object3D(), []);
  const color = useMemo(() => new Color(), []);
  const jitter = useMemo(() => new Vector3(), []);

  useFrame(({ clock }) => {
    const mesh = ref.current;
    const pulses = pulseRef.current;
    if (!mesh || !pulses) return;
    const { scenario: process, t } = useScenario.getState();
    let n = 0;
    let np = 0;
    const put = (pos: Vector3, scale: number, kind: CargoKind, glow = 1) => {
      if (n >= POOL || scale <= 0.001) return;
      const look = CARGO[kind];
      dummy.position.copy(pos);
      dummy.scale.setScalar(look.size * scale);
      dummy.updateMatrix();
      mesh.setMatrixAt(n, dummy.matrix);
      mesh.setColorAt(n, color.set(look.color).multiplyScalar(look.intensity * glow));
      n++;
    };

    if (process) {
      const a = anchors();
      for (const { cue, progress } of activeCues(process.actors, t)) {
        if (cue.actor === 'path') {
          let curve = curves.get(cue);
          if (!curve) {
            curve = new CatmullRomCurve3(cue.params.path.map((id) => a[id].clone()), false, 'centripetal');
            curves.set(cue, curve);
          }
          const count = cue.params.count;
          for (let i = 0; i < count; i++) {
            const s = clamp01(progress * (1 + STAGGER * (count - 1)) - STAGGER * i);
            if (s <= 0 || s >= 1) continue;
            const pos = curve.getPointAt(smooth(s));
            jitter.set(hash(i + 1) - 0.5, hash(i + 7) - 0.5, hash(i + 13) - 0.5).multiplyScalar(2.2);
            const fade = Math.min(1, s * 10, (1 - s) * 10);
            put(pos.add(jitter), fade, cue.params.cargo);
            for (let k = 1; k <= TRAIL; k++) {
              const sk = s - 0.011 * k;
              if (sk <= 0) break;
              const trail = curve.getPointAt(smooth(sk)).add(jitter);
              put(trail, fade * (1 - k / (TRAIL + 1)) * 0.75, cue.params.cargo, 0.55 - k * 0.1);
            }
          }
        } else if (cue.actor === 'burst') {
          const from = a[cue.params.from];
          for (let i = 0; i < cue.params.count; i++) {
            const local = clamp01(progress * 1.4 - hash(i + 3) * 0.4);
            if (local <= 0 || local >= 1) continue;
            jitter.set(hash(i + 11) - 0.5, hash(i + 17) - 0.5, hash(i + 23) - 0.5).normalize();
            const pos = from.clone().addScaledVector(jitter, 3 + smooth(local) * 16);
            put(pos, Math.min(1, local * 8, (1 - local) * 4), cue.params.cargo);
          }
        } else if (cue.actor === 'pulse' && np < PULSES) {
          const env = Math.min(1, progress * 6, (1 - progress) * 6);
          dummy.position.copy(a[cue.params.at]);
          dummy.scale.setScalar((5 + Math.sin(clock.elapsedTime * 3) * 1.2) * env);
          dummy.updateMatrix();
          pulses.setMatrixAt(np++, dummy.matrix);
        }
      }
    }
    mesh.count = n;
    pulses.count = np;
    mesh.instanceMatrix.needsUpdate = true;
    pulses.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <>
      <instancedMesh ref={ref} args={[geometry, material, POOL]} frustumCulled={false} renderOrder={9} />
      <instancedMesh ref={pulseRef} args={[geometry, pulseMaterial, PULSES]} frustumCulled={false} renderOrder={9} />
    </>
  );
}

export function ScenarioActors() {
  return (
    <group name="scenario">
      <Player />
      <Tokens />
      <Mitosis />
    </group>
  );
}
