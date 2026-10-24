/**
 * Art direction: deep-sea documentary. Abyssal blue-black fluid, warm bioluminescent accents.
 * Each organelle family owns a hue so the cell stays readable from far away.
 */
export const PALETTE = {
  background: '#03060c',
  fog: '#06101c',
  membrane: { base: '#dff1ff', rim: '#7fe0ff', film: '#ffd9f0' },
  receptor: { a: '#ffd59a', b: '#7fe8d8' },
  nucleus: { envelope: '#3a3f9e', envelope2: '#7466e0', pore: '#8ff3ff' },
  chromatin: { a: '#7b3fd1', b: '#ff8fc1', glow: '#ff6fb0', hetero: '#3f2378' },
  nucleolus: { a: '#a8463a', b: '#ffb08a', glow: '#ff8a5c' },
  roughEr: { a: '#8e7ae8', b: '#c9b5ff', sss: '#e2d0ff' },
  smoothEr: { a: '#7d9cf0', b: '#b9a8ff', sss: '#cfe0ff' },
  ribosome: { a: '#ffe6cf', b: '#ffc79e' },
  golgi: { cis: '#4f7fe0', trans: '#d98a3a', sss: '#ffc27a' },
  mitochondria: { a: '#a8382a', b: '#ff9a52', glow: '#ff7a2a', sss: '#ff8a66' },
  lysosome: { a: '#b8235f', b: '#ff7ab6', glow: '#ff4f9a' },
  peroxisome: { a: '#6f9a2a', b: '#c8f064', glow: '#b8ff3a' },
  vesicle: { a: '#bfe9ff', rim: '#ffffff' },
  microtubule: { a: '#8fc3ff', glow: '#6fb6ff' },
  actin: { a: '#ff9c86', glow: '#ff7a63' },
  intermediate: { a: '#b6a3ff', glow: '#9a84ff' },
  centrosome: { a: '#fff1c9', glow: '#ffd27a' },
  motor: { a: '#ffe08a', cargo: '#9ff0ff' },
  particles: ['#9ed8ff', '#ffd6a8', '#c9b8ff', '#a8ffe4'],
} as const;

/** UI swatch per organelle (list dots, panel accents), in reading order from outside to inside. */
export const ORGANELLE_SWATCHES = [
  ['plasma-membrane', '#7fe0ff'],
  ['cytoplasm', '#9ed8ff'],
  ['nucleus', '#7466e0'],
  ['nucleolus', '#ff8a5c'],
  ['dna', '#ff8fc1'],
  ['rough-er', '#c9b5ff'],
  ['ribosome', '#ffc79e'],
  ['smooth-er', '#9fb6ff'],
  ['golgi', '#ffcf70'],
  ['vesicle', '#bfe9ff'],
  ['lysosome', '#ff4f9a'],
  ['peroxisome', '#b8ff3a'],
  ['mitochondrion', '#ff7a2a'],
  ['cytoskeleton', '#8fc3ff'],
  ['centrosome', '#ffd27a'],
] as const;
