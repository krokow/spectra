import { describe, expect, it } from 'vitest'
import { waveform } from './waveform'

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length

describe('waveform dérivée des caractéristiques', () => {
  it('est déterministe et bornée', () => {
    const a = waveform('abc', { energy: 0.8 })
    expect(a).toEqual(waveform('abc', { energy: 0.8 }))
    expect(a).toHaveLength(64)
    expect(a.every((v) => v >= 0.08 && v <= 1)).toBe(true)
  })

  it('un morceau énergique a plus de relief qu’un morceau calme', () => {
    expect(mean(waveform('x', { energy: 0.95 }))).toBeGreaterThan(
      mean(waveform('x', { energy: 0.1 })),
    )
  })

  it('deux morceaux différents n’ont pas la même forme', () => {
    expect(waveform('a')).not.toEqual(waveform('b'))
  })
})
