import { describe, expect, it } from 'vitest'

// Vérifie les contrastes WCAG des paires de tokens utilisées pour du texte.
function luminance(hex: string): number {
  const n = hex.replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(n.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (hi + 0.05) / (lo + 0.05)
}

const AA = 4.5
const AA_LARGE = 3

describe('contrastes des tokens', () => {
  it.each([
    ['dark fg / bg', '#f4f2ff', '#0b0a14', AA],
    ['dark muted / bg', '#a6a1c2', '#0b0a14', AA],
    ['dark muted / elevated', '#a6a1c2', '#141226', AA],
    ['light fg / bg', '#14121f', '#f7f6fb', AA],
    ['light muted / bg', '#5b5670', '#f7f6fb', AA],
    ['light accent / bg', '#6d28d9', '#f7f6fb', AA],
    ['dark accent / bg', '#a78bfa', '#0b0a14', AA],
    // Bouton principal : texte nuit sur chaque stop du dégradé doux.
    ['btn violet-soft', '#0b0a14', '#a78bfa', AA],
    ['btn cyan', '#0b0a14', '#22d3ee', AA],
    ['btn pink', '#0b0a14', '#f472b6', AA],
    // Titres en dégradé (grand texte) : chaque stop vs fond.
    ['dark title violet', '#a78bfa', '#0b0a14', AA_LARGE],
    ['dark title cyan', '#22d3ee', '#0b0a14', AA_LARGE],
    ['dark title pink', '#f472b6', '#0b0a14', AA_LARGE],
    ['light title violet', '#6d28d9', '#f7f6fb', AA_LARGE],
    ['light title cyan', '#0e7490', '#f7f6fb', AA_LARGE],
    ['light title pink', '#be185d', '#f7f6fb', AA_LARGE],
  ])('%s', (_name, fg, bg, min) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(min)
  })
})
