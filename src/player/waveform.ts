import type { TrackFeatures } from '@/providers/types'

/** Générateur pseudo-aléatoire déterministe (mulberry32) : même morceau, même forme. */
function rng(seed: string): () => number {
  let h = 1779033703 ^ seed.length
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  let a = h >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Waveform « dessinée » à partir des caractéristiques connues du morceau.
 * L'analyse Web Audio des extraits Deezer/iTunes est impossible (CORS) :
 * on traduit énergie, tempo, groove et basses en relief et en régularité.
 * Renvoie `bars` hauteurs dans [0.08, 1].
 */
export function waveform(seed: string, features: TrackFeatures = {}, bars = 64): number[] {
  const energy = features.energy ?? 0.55
  const tempo = features.tempo ?? 0.5
  const dance = features.dance ?? 0.5
  const bass = features.bass ?? 0.5
  const rand = rng(seed)
  // Plus c'est rapide, plus les pulsations sont serrées ; plus c'est dansant, plus elles sont régulières.
  const period = Math.max(2, Math.round(10 - tempo * 7))
  const out: number[] = []
  for (let i = 0; i < bars; i++) {
    const x = i / (bars - 1)
    // Enveloppe : attaque, corps, petite chute en fin d'extrait.
    const envelope = Math.min(1, 0.35 + x * 3) * (1 - 0.25 * Math.max(0, x - 0.85) * 6.6)
    const pulse = i % period === 0 ? 0.25 + bass * 0.35 : 0
    const noise = (rand() - 0.5) * (1 - dance) * 0.9
    const level = (0.25 + energy * 0.55) * envelope + pulse * dance + noise * 0.5
    out.push(Math.max(0.08, Math.min(1, level)))
  }
  return out
}
