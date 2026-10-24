import { Data3DTexture, LinearFilter, RedFormat, RepeatWrapping } from 'three';
import { fbm3 } from '@/lib/noise';

let cached: Data3DTexture | null = null;

/**
 * Tileable 3D noise volume shared by every shader. Sampling it replaces procedural simplex noise:
 * one texture fetch instead of ~50 ALU instructions inlined at every call site, which made each shader
 * program take ~300 ms to compile on D3D11 (≈15 s on a cold first visit) and cost GPU time every frame.
 * 64³ texels cover 4 noise periods per axis; shaders sample it at p / 4 for a feature size of ~1 unit.
 */
export function noiseTexture() {
  if (cached) return cached;
  const size = 64;
  const period = 4;
  const data = new Uint8Array(size * size * size);
  const s = period / size;
  for (let z = 0; z < size; z++)
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        // Two octaves, stretched to use the full range (value noise is flatter than simplex noise).
        const v = fbm3(x * s, y * s, z * s, 5, 2, period) * 1.6;
        data[x + y * size + z * size * size] = Math.max(0, Math.min(255, (v * 0.5 + 0.5) * 255));
      }
  const tex = new Data3DTexture(data, size, size, size);
  tex.format = RedFormat;
  tex.minFilter = tex.magFilter = LinearFilter;
  tex.wrapS = tex.wrapT = tex.wrapR = RepeatWrapping;
  tex.unpackAlignment = 1;
  tex.needsUpdate = true;
  cached = tex;
  return tex;
}
