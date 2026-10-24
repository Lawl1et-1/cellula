import { Color } from 'three';
import type { OrganelleId } from '@/content/schema/common';
import type { ChannelValues } from '@/engine/timeline/evaluate';
import { liveChannels } from '@/engine/timeline/live';
import { materialsOf } from '../interaction/highlight';
import { sharedUniforms } from '../shaders/organicMaterial';

/**
 * How disease channels deform and recolour organelles. Every organelle material registered under an id
 * (see useHighlight / InstancedOrganelle `organelle`) receives the same values, eased over time.
 * Adding a disease never touches this file; adding a *kind* of cellular damage does.
 */
interface Look {
  /** Enlargement (0 = normal size). */
  swell?: number;
  /** Length along the local y axis (1 = normal). */
  stretch?: number;
  /** Dilation along the surface normal, in scene units. */
  inflate?: number;
  /** Lobulation of the surface. */
  bleb?: number;
  /** Emissive multiplier (1 = normal). */
  glow?: number;
  /** Colour shift towards `stainColor` (0..1). */
  stain?: number;
  stainColor?: string;
  /** Length of dynamic filaments (1 = normal). */
  growth?: number;
}

const BINDINGS: Partial<Record<OrganelleId, (c: ChannelValues) => Look>> = {
  // Storage diseases: lysosomes swell and fill with pale, undigested material.
  lysosome: (c) => ({
    swell: 0.95 * c['lysosome.storageLoad'],
    stain: c['lysosome.storageLoad'],
    stainColor: '#efe1c2',
    glow: 1 - 0.7 * c['lysosome.storageLoad'],
  }),
  // Mitochondrial damage: swelling, fragmentation into short pieces, loss of potential (glow) and cristae.
  mitochondrion: (c) => ({
    swell: 0.45 * c['mitochondria.swelling'],
    stretch: 1 - 0.55 * c['mitochondria.fragmentation'],
    glow: c['mitochondria.potential'],
    stain: Math.max(c['mitochondria.cristaeLoss'], 1 - c['mitochondria.potential']) * 0.75,
    stainColor: '#5e463f',
  }),
  // ER stress: dilated cisternae, retained cargo.
  'rough-er': (c) => ({
    inflate: 1.6 * c['er.stress'],
    stain: Math.min(1, 0.4 * c['er.stress'] + 0.8 * c['er.retainedCargo']),
    stainColor: '#f0b98e',
  }),
  'smooth-er': (c) => ({ inflate: 0.6 * c['er.stress'] }),
  golgi: (c) => ({ stain: 0.8 * c['golgi.missorting'], stainColor: '#c9a0a0' }),
  // Peroxisome biogenesis disorders: "ghost" peroxisomes without enzymes.
  peroxisome: (c) => ({ glow: 1 - c['peroxisome.empty'], stain: c['peroxisome.empty'], stainColor: '#7a7f88' }),
  nucleus: (c) => ({ bleb: c['nucleus.envelopeBlebbing'] }),
  // DNA damage dulls the chromatin around the lesions.
  dna: (c) => ({ stain: 0.45 * c['dna.damage'], stainColor: '#b9a27a' }),
  cytoskeleton: (c) => ({ growth: 1 - 0.7 * c['cytoskeleton.disruption'] }),
};

const DEFAULTS = { uSwell: 0, uStretch: 1, uInflate: 0, uBleb: 0, uGlow: 1, uStain: 0, uGrowthScale: 1 };
const color = new Color();

function ease(current: number, target: number, k: number) {
  return current + (target - current) * k;
}

/** Called once per frame from the scene clock. */
export function applyDiseaseLooks(delta: number) {
  const k = 1 - Math.exp(-delta * 4);
  const c = liveChannels;
  for (const [id, bind] of Object.entries(BINDINGS) as [OrganelleId, (c: ChannelValues) => Look][]) {
    const look = bind(c);
    const target = {
      uSwell: look.swell ?? DEFAULTS.uSwell,
      uStretch: look.stretch ?? DEFAULTS.uStretch,
      uInflate: look.inflate ?? DEFAULTS.uInflate,
      uBleb: look.bleb ?? DEFAULTS.uBleb,
      uGlow: look.glow ?? DEFAULTS.uGlow,
      uStain: look.stain ?? DEFAULTS.uStain,
      uGrowthScale: look.growth ?? DEFAULTS.uGrowthScale,
    };
    for (const m of materialsOf(id)) {
      const u = m.uniforms;
      if (!u.uSwell) continue;
      for (const [name, value] of Object.entries(target)) u[name]!.value = ease(u[name]!.value, value, k);
      if (look.stainColor) u.uStainColor!.value.copy(color.set(look.stainColor));
    }
  }
  const tint = Math.max(c['cytoplasm.tint'], (1 - c['cell.viability']) * 0.8);
  sharedUniforms.uTint.value = ease(sharedUniforms.uTint.value, tint, k);
}
