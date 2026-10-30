'use client';

import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import CameraControlsImpl from 'camera-controls';
import { Box3, Vector3, type PerspectiveCamera } from 'three';
import { useScene } from '@/state/scene';
import { useSelection } from '@/state/selection';
import { useScenario } from '@/state/scenario';
import { useUi } from '@/state/ui';
import { timeScale } from '../time';
import { cameraPosition, focusPoint } from './focus';
import { handBridge } from '@/hand/bridge';
import { HAND_CONFIG } from '@/hand/config';
import { CELL } from '../layout/cellLayout';

const ACTION = CameraControlsImpl.ACTION;
const INTRO_POSITION = new Vector3(-90, 80, 560);
const INTRO_TARGET = new Vector3(-120, 20, 0);
const ORBIT_POSITION = new Vector3(170, 70, 235);
const IDLE_DELAY = 6000;
const FLIGHT_SPEED = 28;

/** Shareable viewpoint: `?cam=px,py,pz,tx,ty,tz` places the camera directly (also used for review captures). */
function readCameraParam() {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('cam');
  const v = raw?.split(',').map(Number);
  if (!v || v.length !== 6 || v.some((n) => !Number.isFinite(n))) return null;
  return v as [number, number, number, number, number, number];
}

const tmp = new Vector3();
const UP = new Vector3(0, 1, 0);
const rotPos = new Vector3();
const rotTarget = new Vector3();
const rotAxis = new Vector3();
const forward = new Vector3();

/** Keyboard state for free flight (WASD / arrows, Space / C for up / down, Shift to boost). */
function useFlightKeys() {
  const keys = useRef(new Set<string>());
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input, textarea, select')) return;
      keys.current.add(e.code);
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.code);
    const blur = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);
  return keys;
}

export function CameraRig() {
  const [controls, setControls] = useState<CameraControlsImpl | null>(null);
  const camera = useThree((s) => s.camera);
  const mode = useScene((s) => s.cameraMode);
  const touch = useScene((s) => s.touch);
  const keys = useFlightKeys();
  const wheelBoost = useRef(0);
  const prevMode = useRef(mode);
  const handState = useRef({ vx: 0, vy: 0, rx: 0, ry: 0, zoomLeft: 0, bounded: false });
  // Focus mode: the step frames the camera; the reader can unlock it from the control bar.
  const scenarioOn = useScenario((s) => !!s.scenario);
  const unlocked = useUi((s) => s.cameraUnlocked);
  const locked = scenarioOn && !unlocked;

  // Mode transitions.
  useEffect(() => {
    const c = controls;
    if (!c) return;
    if (mode === 'intro') {
      // Aim left of the cell so it sits on the right of the frame, clear of the title.
      c.setLookAt(INTRO_POSITION.x, INTRO_POSITION.y, INTRO_POSITION.z, INTRO_TARGET.x, INTRO_TARGET.y, INTRO_TARGET.z, false);
      c.smoothTime = 1.6;
      return;
    }
    if (mode === 'orbit') {
      c.minDistance = 2;
      c.maxDistance = 900;
      c.azimuthRotateSpeed = 0.6;
      c.polarRotateSpeed = 0.6;
      c.mouseButtons.wheel = ACTION.DOLLY;
      c.mouseButtons.right = ACTION.TRUCK;
      c.dollyToCursor = true;
      c.getPosition(tmp);
      const shared = readCameraParam();
      if (shared) {
        void c.setLookAt(...shared, false);
        c.smoothTime = 0.45;
      } else if (prevMode.current === 'intro') {
        // First entry: a slow, eased dive towards the cell.
        c.smoothTime = 1.4;
        void c.setLookAt(ORBIT_POSITION.x, ORBIT_POSITION.y, ORBIT_POSITION.z, 0, 0, 0, true).then(() => {
          c.smoothTime = 0.45;
        });
      } else {
        c.smoothTime = 0.45;
        camera.getWorldDirection(forward);
        const target = tmp.clone().addScaledVector(forward, 60);
        void c.setLookAt(tmp.x, tmp.y, tmp.z, target.x, target.y, target.z, true);
      }
      return;
    }
    // Flight: look around from the current position (target sits just in front of the lens).
    c.getPosition(tmp);
    camera.getWorldDirection(forward);
    const target = tmp.clone().addScaledVector(forward, 0.05);
    c.minDistance = c.maxDistance = 0.05;
    c.azimuthRotateSpeed = -0.35;
    c.polarRotateSpeed = -0.35;
    c.mouseButtons.wheel = ACTION.NONE;
    c.mouseButtons.right = ACTION.NONE;
    c.dollyToCursor = false;
    c.smoothTime = 0.25;
    void c.setLookAt(tmp.x, tmp.y, tmp.z, target.x, target.y, target.z, false);
  }, [mode, camera, controls]);

  useEffect(() => {
    if (controls) prevMode.current = mode;
  }, [mode, controls]);

  // Selecting an organelle flies the camera to it, keeping the current viewing direction.
  useEffect(() => {
    if (!controls) return;
    return useSelection.subscribe((state, prev) => {
      const f =
        state.selected && state.selected !== prev.selected
          ? state.selected
          : state.framing && state.framing !== prev.framing
            ? state.framing
            : null;
      if (!f) return;
      const target = new Vector3(...f.position);
      const from = controls.getPosition(new Vector3());
      const dir = f.from ? new Vector3(...f.from) : from.sub(target);
      if (dir.lengthSq() < 1e-6) dir.set(0.4, 0.3, 1);
      dir.normalize();
      if (f.axis && !f.from) {
        // Side-on view of elongated organelles, slightly from above.
        const axis = new Vector3(...f.axis);
        dir.addScaledVector(axis, -dir.dot(axis));
        if (dir.lengthSq() < 1e-4) dir.set(axis.y, -axis.x, 0.3);
        dir.normalize().addScaledVector(axis, 0.15).normalize();
      }
      // Close enough to fill the view; for mitochondria this lands inside the cut-away range.
      const wholeCell = f.organelle === 'plasma-membrane' && f.radius >= 90;
      // Focus mode on a portrait screen: the view is narrow and the caption covers the lower half, so the
      // camera stands further back and the subject is lifted higher.
      const focusMode = !!useScenario.getState().scenario;
      const portrait = (camera as PerspectiveCamera).aspect < 0.9;
      const base = wholeCell ? f.radius * 2.75 : Math.min(Math.max(f.radius * 2.6, 7), 420);
      const distance = focusMode && portrait && !wholeCell ? base * 1.8 : base;
      const pos = target.clone().addScaledVector(dir, distance);
      // Focus mode: the caption and controls cover the lower part of the screen, so the subject is
      // framed a little above the centre.
      const raise = focusMode && !wholeCell ? distance * (portrait ? 0.12 : 0.08) : 0;
      void controls.setFocalOffset(0, raise, 0, true);
      controls.smoothTime = 0.85;
      controls.minDistance = 2;
      void controls.setLookAt(pos.x, pos.y, pos.z, target.x, target.y, target.z, true).then(() => {
        controls.smoothTime = 0.45;
      });
      useScene.getState().touch();
    });
  }, [controls, camera]);

  // Focus mode: remember the view when a scenario starts and fly back to it when the reader exits.
  useEffect(() => {
    if (!controls) return;
    let saved: { position: Vector3; target: Vector3 } | null = null;
    return useScenario.subscribe((state, prev) => {
      if (state.scenario && !prev.scenario) {
        saved = { position: controls.getPosition(new Vector3()), target: controls.getTarget(new Vector3()) };
        useUi.getState().setCameraUnlocked(false);
      } else if (!state.scenario && prev.scenario) {
        void controls.setFocalOffset(0, 0, 0, true);
      }
      if (!state.scenario && prev.scenario && saved) {
        const { position: p, target: t } = saved;
        saved = null;
        controls.smoothTime = 0.9;
        void controls.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, true).then(() => {
          controls.smoothTime = 0.45;
        });
      }
    });
  }, [controls]);

  // Wheel moves forward in flight mode.
  useEffect(() => {
    if (mode !== 'flight') return;
    const onWheel = (e: WheelEvent) => {
      wheelBoost.current -= Math.sign(e.deltaY) * 14;
    };
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => window.removeEventListener('wheel', onWheel);
  }, [mode]);

  useFrame((_, delta) => {
    const c = controls;
    if (!c) return;
    const dt = Math.min(delta, 0.05);
    const { lastInteraction } = useScene.getState();

    // Hand mode: a fist cycle zooms one eased step; the steady open right hand pans and the left hand
    // rotates the cell, both with a little inertia. The point looked at stays inside the cell. A framed
    // focus-mode step keeps its camera unless freed. Every move is applied directly each frame, so zoom, pan
    // and rotation combine without cancelling each other.
    const hands = handState.current;
    if (handBridge.active) {
      if (!hands.bounded) {
        const k = HAND_CONFIG.pan.clampToCell;
        c.setBoundary(new Box3(CELL.radii.clone().multiplyScalar(-k), CELL.radii.clone().multiplyScalar(k)));
        hands.bounded = true;
      }
      const framedStep = !!useScenario.getState().scenario && !useUi.getState().cameraUnlocked;
      const usable = mode === 'orbit' && !framedStep;
      const steps = handBridge.zoomSteps;
      handBridge.zoomSteps = 0;
      const z = HAND_CONFIG.zoom;
      if (steps && usable) {
        const from = c.distance - hands.zoomLeft;
        const to = Math.min(z.maxDistance, Math.max(z.minDistance, from * Math.pow(1 - z.step, steps)));
        hands.zoomLeft += from - to;
      }
      // Eased zoom step: each frame covers a share of what is left (exponential ease-out).
      if (usable && Math.abs(hands.zoomLeft) > 1e-3) {
        const share = Math.abs(hands.zoomLeft) < 0.02 ? 1 : 1 - Math.exp(-dt / (z.easeSeconds / 3));
        const d = hands.zoomLeft * share;
        hands.zoomLeft -= d;
        void c.dolly(d, false);
        touch();
      } else if (!usable) hands.zoomLeft = 0;
      // Velocity follows the hand quickly while it moves and glides to a stop when it stops (inertia).
      const p = HAND_CONFIG.pan;
      const fresh = performance.now() - handBridge.updatedAt < 250;
      const wanted = handBridge.panning && fresh ? handBridge.pan : { x: 0, y: 0 };
      const moving = wanted.x !== 0 || wanted.y !== 0;
      const k = 1 - Math.exp(-dt / (moving ? p.followSeconds : p.inertiaSeconds));
      hands.vx += (wanted.x - hands.vx) * k;
      hands.vy += (wanted.y - hands.vy) * k;
      if (usable && Math.hypot(hands.vx, hands.vy) > 1e-3) {
        const scale = p.speed * c.distance * dt;
        void c.truck(hands.vx * scale, hands.vy * scale, false);
        touch();
      } else if (!usable) hands.vx = hands.vy = 0;

      // Rotation: turning the cell by an angle gives the same picture as turning the camera — its position
      // and the point it looks at — by the opposite angle around the cell's centre, so the cell spins in
      // place and any pan offset is kept.
      const r = HAND_CONFIG.rotate;
      const wantedR = handBridge.rotating && fresh ? handBridge.rotate : { x: 0, y: 0 };
      const turning = wantedR.x !== 0 || wantedR.y !== 0;
      const kr = 1 - Math.exp(-dt / (turning ? r.followSeconds : r.inertiaSeconds));
      hands.rx += (wantedR.x - hands.rx) * kr;
      hands.ry += (wantedR.y - hands.ry) * kr;
      if (usable && Math.hypot(hands.rx, hands.ry) > 1e-3) {
        const sign = r.invert ? -1 : 1;
        const p0 = c.getPosition(rotPos, false);
        const t0 = c.getTarget(rotTarget, false);
        // Hand to the right: the cell's front turns right, i.e. the camera goes round to the left.
        const yaw = -sign * hands.rx * r.speed * dt;
        p0.applyAxisAngle(UP, yaw);
        t0.applyAxisAngle(UP, yaw);
        // Hand up: the cell's front rolls up, i.e. the camera goes down; clamped so it never flips over.
        const maxElevation = (r.maxPitchDegrees * Math.PI) / 180;
        const elevation = Math.asin(Math.max(-1, Math.min(1, p0.y / (p0.length() || 1))));
        const next = Math.max(-maxElevation, Math.min(maxElevation, elevation + sign * hands.ry * r.speed * dt));
        const right = rotAxis.subVectors(t0, p0).cross(UP);
        if (right.lengthSq() > 1e-8 && Math.abs(next - elevation) > 1e-6) {
          right.normalize();
          p0.applyAxisAngle(right, -(next - elevation));
          t0.applyAxisAngle(right, -(next - elevation));
        }
        void c.setLookAt(p0.x, p0.y, p0.z, t0.x, t0.y, t0.z, false);
        touch();
      } else if (!usable) hands.rx = hands.ry = 0;
    } else if (hands.bounded) {
      c.setBoundary();
      hands.bounded = false;
      hands.vx = hands.vy = 0;
      hands.rx = hands.ry = 0;
      hands.zoomLeft = 0;
    }

    if (mode === 'intro') {
      c.azimuthAngle += dt * 0.006 * timeScale();
    } else if (mode === 'orbit') {
      // No idle drift while a step is framed: the camera stays on the action.
      const framedStep = !!useScenario.getState().scenario && !useUi.getState().cameraUnlocked;
      if (!framedStep && performance.now() - lastInteraction > IDLE_DELAY) c.azimuthAngle += dt * 0.03 * timeScale();
    } else {
      const k = keys.current;
      const boost = k.has('ShiftLeft') || k.has('ShiftRight') ? 3 : 1;
      const v = FLIGHT_SPEED * boost * dt;
      const f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
      const s = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
      const u = (k.has('Space') || k.has('KeyE') ? 1 : 0) - (k.has('KeyC') || k.has('KeyQ') ? 1 : 0);
      const wheel = wheelBoost.current * dt * 4;
      wheelBoost.current *= Math.pow(0.02, dt);
      if (f || s || u || Math.abs(wheel) > 0.001) {
        // camera-controls' forward() is horizontal only: move along the true view direction instead.
        camera.getWorldDirection(forward);
        c.getTarget(tmp);
        tmp.addScaledVector(forward, f * v + wheel);
        void c.moveTo(tmp.x, tmp.y, tmp.z, true);
        c.truck(s * v, -u * v, true);
        touch();
      }
      // Keep the explorer within a reasonable distance of the cell.
      c.getPosition(tmp);
      if (tmp.length() > 600) {
        c.getTarget(forward);
        const back = tmp.clone().setLength(600).sub(tmp);
        void c.moveTo(forward.x + back.x, forward.y + back.y, forward.z + back.z, true);
      }
    }

    cameraPosition.copy(camera.position);
    if (mode === 'flight') {
      camera.getWorldDirection(forward);
      focusPoint.copy(camera.position).addScaledVector(forward, 45);
    } else {
      c.getTarget(focusPoint);
    }
  });

  return (
    <CameraControls
      ref={setControls}
      makeDefault
      enabled={mode !== 'intro' && !locked}
      smoothTime={0.45}
      draggingSmoothTime={0.12}
      onStart={touch}
    />
  );
}
