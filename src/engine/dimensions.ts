/**
 * Les 12 dimensions du spectre, dans l'ordre canonique (cf. supabase/seed/questions.json).
 * Toutes les valeurs sont sur [0, 1] ; 0.5 = neutre / inconnu.
 */
export const DIMENSIONS = [
  'energy',
  'valence',
  'acoustic',
  'tempo',
  'dance',
  'complexity',
  'vocal',
  'bass',
  'polish',
  'warmth',
  'era',
  'niche',
] as const

export type Dimension = (typeof DIMENSIONS)[number]

export type DimensionEstimate = {
  /** Valeur estimée sur [0, 1]. */
  mean: number
  /** Confiance sur [0, 1] (1 − var / prior_var). */
  confidence: number
}

export type SpectrumValues = Record<Dimension, DimensionEstimate>

export const NEUTRAL_SPECTRUM: SpectrumValues = Object.fromEntries(
  DIMENSIONS.map((d) => [d, { mean: 0.5, confidence: 0 }]),
) as SpectrumValues
