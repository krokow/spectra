import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LogoMark } from './LogoMark'

describe('<LogoMark>', () => {
  it('a un nom accessible par défaut et anime ses 7 barres sur demande', () => {
    render(<LogoMark animated />)
    const logo = screen.getByRole('img', { name: 'Spectra' })
    expect(logo).toHaveClass('logo-animated')
    expect(logo.querySelectorAll('.logo-bar')).toHaveLength(7)
  })

  it('est masqué aux lecteurs d’écran quand il est décoratif', () => {
    const { container } = render(<LogoMark title="" />)
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
  })
})
