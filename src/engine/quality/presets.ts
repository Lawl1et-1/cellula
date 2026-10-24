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
    dpr: 1.25,
    particles: 25_000,
    ribosomes: 10_000,
    receptors: 1_800,
    microtubules: 90,
    motors: 120,
    volumeSteps: 12,
    ao: false,
    dof: true,
    chromatic: true,
    geometryDetail: 0.75,
  },
  high: {
    label: 'Élevé',
    dpr: 1.5,
    particles: 60_000,
    ribosomes: 20_000,
    receptors: 3_000,
    microtubules: 130,
    motors: 200,
    volumeSteps: 20,
    ao: true,
    dof: true,
    chromatic: true,
    geometryDetail: 1,
  },
  ultra: {
    label: 'Ultra',
    dpr: 2,
    particles: 150_000,
    ribosomes: 36_000,
    receptors: 5_000,
    microtubules: 170,
    motors: 320,
    volumeSteps: 32,
    ao: true,
    dof: true,
    chromatic: true,
    geometryDetail: 1.25,
  },
};

/** Best guess before the adaptive monitor has measured anything. */
export function detectInitialQuality(): QualityLevel {
  if (typeof window === 'undefined') return 'high';
  const mobile = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
  const cores = navigator.hardwareConcurrency ?? 4;
  if (mobile) return 'low';
  if (cores <= 4) return 'medium';
  return 'high';
}
