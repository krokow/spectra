import { expect, test } from '@playwright/test'
import { mockSupabase } from './mockSupabase'

test('recherche, extrait, lecteur plein écran et raccourci clavier', async ({ page }) => {
  page.on('pageerror', (e) => {
    throw e
  })
  await mockSupabase(page, {
    users: [
      {
        id: '4f0c2a7e-1b2d-4c3e-9f10-0a1b2c3d4e5f',
        email: 'a@b.fr',
        username: 'theo_95',
        password: 'Spectra2026x',
      },
    ],
  })
  await page.goto('./#/welcome')
  await page.getByRole('tab', { name: 'Se connecter' }).click()
  await page.getByLabel('E-mail ou pseudo').fill('theo_95')
  await page.getByLabel('Mot de passe', { exact: true }).fill('Spectra2026x')
  await page.getByRole('button', { name: 'Se connecter' }).last().click()

  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('link', { name: 'Découvrir' })
    .click()
  await page.getByRole('searchbox', { name: 'Rechercher un morceau' }).fill('daft punk')
  const results = page.getByRole('list', { name: '2 résultats' })
  await expect(results.getByRole('listitem')).toHaveCount(2)

  await results.getByRole('button', { name: 'Écouter Get Lucky de Daft Punk' }).click()
  const mini = page.getByRole('region', { name: 'Lecteur' })
  await expect(mini.getByText('Get Lucky')).toBeVisible()
  await expect(mini.getByRole('button', { name: 'Pause' })).toBeVisible()

  // Barre d'espace (hors champ de saisie) : pause.
  await page.getByRole('heading', { name: 'Découvrir' }).click()
  await page.keyboard.press('Space')
  await expect(mini.getByRole('button', { name: 'Lecture' })).toBeVisible()

  await mini.getByRole('button', { name: 'Ouvrir le lecteur' }).click()
  const full = page.getByRole('dialog', { name: 'Lecteur' })
  await expect(full.getByRole('heading', { name: 'Get Lucky' })).toBeVisible()
  await expect(full.getByRole('link', { name: /Écouter en entier sur Deezer/ })).toHaveAttribute(
    'href',
    'https://www.deezer.com/track/67238735',
  )
  await full.getByRole('button', { name: 'Morceau suivant' }).click()
  await expect(full.getByRole('heading', { name: 'One More Time' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(full).toBeHidden()
})
