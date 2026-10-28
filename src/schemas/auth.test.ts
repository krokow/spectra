import { describe, expect, it } from 'vitest'
import { isEmail, loginSchema, recoverSchema, signupSchema } from './auth'

describe('schémas d’authentification', () => {
  it('accepte une inscription valide et normalise l’e-mail', () => {
    const r = signupSchema.parse({
      email: '  Theo@Example.com ',
      username: 'theo_95',
      password: 'Spectra2026x',
    })
    expect(r.email).toBe('theo@example.com')
  })

  it.each([
    ['pseudo trop court', { username: 'ab' }],
    ['pseudo avec espace', { username: 'jean dupont' }],
    ['mot de passe sans majuscule', { password: 'spectra2026x' }],
    ['mot de passe trop court', { password: 'Spec2026' }],
    ['e-mail invalide', { email: 'pas-un-mail' }],
  ])('refuse : %s', (_cas, patch) => {
    const base = { email: 'a@b.fr', username: 'theo_95', password: 'Spectra2026x' }
    expect(signupSchema.safeParse({ ...base, ...patch }).success).toBe(false)
  })

  it('distingue e-mail et pseudo pour la connexion', () => {
    expect(isEmail('theo@x.fr')).toBe(true)
    expect(isEmail('theo_95')).toBe(false)
    expect(loginSchema.safeParse({ identifier: 'theo_95', password: 'x' }).success).toBe(true)
  })

  it('normalise les codes de secours en majuscules', () => {
    const r = recoverSchema.parse({
      identifier: 'theo_95',
      code: 'abcd-efgh',
      newPassword: 'Nouveau2026x',
    })
    expect(r.code).toBe('ABCD-EFGH')
    expect(
      recoverSchema.safeParse({
        identifier: 'theo_95',
        code: 'ABC0-EFGH',
        newPassword: 'Nouveau2026x',
      }).success,
    ).toBe(false)
  })
})
