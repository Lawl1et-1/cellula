import { Vector3, type Camera } from 'three';

/**
 * Bridge between the 3D scene and the DOM labels of focus mode: the scene writes where each label's
 * anchor is in the world, the projector turns it into screen coordinates every frame, the overlay reads them.
 */
export const labelWorld = new Map<string, Vector3>();
export const labelScreen = new Map<string, { x: number; y: number; visible: boolean }>();

const v = new Vector3();
export function projectLabels(camera: Camera, width: number, height: number) {
  for (const key of labelScreen.keys()) if (!labelWorld.has(key)) labelScreen.delete(key);
  for (const [key, world] of labelWorld) {
    v.copy(world).project(camera);
    const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
    labelScreen.set(key, { x: (v.x * 0.5 + 0.5) * width, y: (-v.y * 0.5 + 0.5) * height, visible });
  }
}
