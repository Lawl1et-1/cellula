import { Vector3 } from 'three';

/** World-space point kept in focus by the depth of field; written by the camera rig every frame. */
export const focusPoint = new Vector3();

/** Live camera position, readable outside the canvas (UI picks the organelle instance nearest to it). */
export const cameraPosition = new Vector3(-90, 80, 560);
