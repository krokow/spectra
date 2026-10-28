import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { NEUTRAL_SPECTRUM } from '@/engine/dimensions'
import { Spectrum } from './Spectrum'

describe('<Spectrum>', () => {
  it('décrit chaque dimension pour les lecteurs d’écran', () => {
    render(<Spectrum values={NEUTRAL_SPECTRUM} />)
    const img = screen.getByRole('img')
    expect(img.getAttribute('aria-label')).toContain('Énergie 50 %')
    expect(img.getAttribute('aria-label')).toContain('Singularité')
    expect(img.querySelectorAll('rect')).toHaveLength(12)
  })

  it('superpose un second spectre en mode comparaison', () => {
    render(<Spectrum values={NEUTRAL_SPECTRUM} compare={NEUTRAL_SPECTRUM} label="comparaison" />)
    expect(screen.getByRole('img', { name: 'comparaison' }).querySelectorAll('rect')).toHaveLength(
      24,
    )
  })
})
