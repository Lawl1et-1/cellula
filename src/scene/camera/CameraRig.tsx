'use client';

import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { CameraControls } from '@react-three/drei';
import CameraControlsImpl from 'camera-controls';
import { Vector3 } from 'three';
import { useScene } from '@/state/scene';
import { focusPoint } from './focus';

const ACTION = CameraControlsImpl.ACTION;
const INTRO_POSITION = new Vector3(40, 140, 1150);
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

  // Mode transitions.
  useEffect(() => {
    const c = controls;
    if (!c) return;
    if (mode === 'intro') {
      c.setLookAt(INTRO_POSITION.x, INTRO_POSITION.y, INTRO_POSITION.z, 0, 0, 0, false);
      c.smoothTime = 1.6;
      return;
    }
    if (mode === 'orbit') {
      c.minDistance = 6;
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
      } else if (tmp.distanceTo(INTRO_POSITION) < 1) {
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

    if (mode === 'intro') {
      c.azimuthAngle += dt * 0.025;
    } else if (mode === 'orbit') {
      if (performance.now() - lastInteraction > IDLE_DELAY) c.azimuthAngle += dt * 0.03;
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
      enabled={mode !== 'intro'}
      smoothTime={0.45}
      draggingSmoothTime={0.12}
      onStart={touch}
    />
  );
}
