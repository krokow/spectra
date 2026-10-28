import { DIMENSIONS, type SpectrumValues } from '@/engine/dimensions'

/** Spectre de démonstration pour l'accueil (pas un vrai profil). */
const DEMO = [0.72, 0.58, 0.35, 0.64, 0.8, 0.45, 0.68, 0.76, 0.6, 0.52, 0.7, 0.4]

export const demoSpectrum: SpectrumValues = Object.fromEntries(
  DIMENSIONS.map((d, i) => [d, { mean: DEMO[i] ?? 0.5, confidence: 0.4 + ((i * 7) % 6) / 10 }]),
) as SpectrumValues
