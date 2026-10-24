export type QualityLevel = 'low' | 'medium' | 'high' | 'ultra';

export interface QualityPreset {
  label: string;
  dpr: number;
  particles: number;
  ribosomes: number;
  receptors: number;
  microtubules: number;
  motors: number;
  volumeSteps: number;
  ao: boolean;
  dof: boolean;
  chromatic: boolean;
  geometryDetail: number;
}

export const QUALITY_PRESETS: Record<QualityLevel, QualityPreset> = {
  low: {
    label: 'Bas',
    dpr: 1,
    particles: 8_000,
    ribosomes: 4_000,
    receptors: 900,
    microtubules: 60,
    motors: 60,
    volumeSteps: 0,
    ao: false,
    dof: false,
    chromatic: false,
    geometryDetail: 0.5,
  },
  medium: {
    label: 'Moyen',
    dpr: 1,
    particles: 20_000,
    ribosomes: 10_000,
    receptors: 1_800,
    microtubules: 90,
    motors: 120,
    volumeSteps: 8,
    ao: false,
    dof: false,
    chromatic: true,
    geometryDetail: 0.75,
  },
  high: {
    label: 'Élevé',
    dpr: 1.25,
    particles: 60_000,
    ribosomes: 20_000,
    receptors: 3_000,
    microtubules: 130,
    motors: 200,
    volumeSteps: 14,
    ao: true,
    dof: true,
    chromatic: true,
    geometryDetail: 1,
  },
  ultra: {
    label: 'Ultra',
    dpr: 1.75,
    particles: 150_000,
    ribosomes: 36_000,
    receptors: 5_000,
    microtubules: 170,
    motors: 320,
    volumeSteps: 24,
    ao: true,
    dof: true,
    chromatic: true,
    geometryDetail: 1.25,
  },
};

/** Integrated and mobile GPUs share memory bandwidth with the CPU: they start one level lower. */
const MODEST_GPU = /intel|uhd|iris|mali|adreno|powervr|apple gpu|videocore/i;
const SOFTWARE_GPU = /swiftshader|llvmpipe|software|basic render/i;

function gpuName(): string {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return (ext && gl?.getParameter(ext.UNMASKED_RENDERER_WEBGL)) || '';
  } catch {
    return '';
  }
}

/** Best guess before the adaptive monitor has measured anything. */
export function detectInitialQuality(): QualityLevel {
  if (typeof window === 'undefined') return 'high';
  const gpu = gpuName();
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  if (SOFTWARE_GPU.test(gpu) || mobile) return 'low';
  if (MODEST_GPU.test(gpu) || (navigator.hardwareConcurrency ?? 4) <= 4) return 'medium';
  return 'high';
}
