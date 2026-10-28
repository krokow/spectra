import { expect, test } from '@playwright/test'
import { mockSupabase } from './mockSupabase'

test.beforeEach(async ({ page }) => {
  page.on('pageerror', (e) => {
    throw e
  })
})

test('sans compte, toute page redirige vers l’accueil', async ({ page }) => {
  await mockSupabase(page)
  await page.goto('./#/playlists')
  await expect(page).toHaveURL(/#\/welcome$/)
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Chacun son spectre')
})

test('inscription : pseudo vérifié, règles du mot de passe, codes de secours, puis l’app', async ({
  page,
}) => {
  const state = {
    users: [{ id: 'u-1', email: 'deja@pris.fr', username: 'deja_pris', password: 'Motdepasse42' }],
  }
  await mockSupabase(page, state)
  await page.goto('./')

  await page.getByLabel('E-mail', { exact: true }).fill('theo@example.com')
  const pseudo = page.getByLabel('Pseudo')
  await pseudo.fill('deja_pris')
  await expect(page.getByText('Ce pseudo est déjà pris (ou réservé).')).toBeVisible()
  await pseudo.fill('theo_95')
  await expect(page.getByText('Disponible !')).toBeVisible()

  await page.getByLabel('Mot de passe', { exact: true }).fill('court')
  await page.getByRole('button', { name: "C'est parti" }).click()
  await expect(page.getByText('Le mot de passe ne respecte pas toutes les règles.')).toBeVisible()

  await page.getByLabel('Mot de passe', { exact: true }).fill('Spectra2026x')
  await page.getByRole('button', { name: "C'est parti" }).click()

  await expect(page).toHaveURL(/#\/codes$/)
  const codes = page.getByRole('list', { name: 'Codes de secours' }).getByRole('listitem')
  await expect(codes).toHaveCount(8)
  const start = page.getByRole('button', { name: 'Découvrir mon spectre' })
  await expect(start).toBeDisabled()
  await page.getByLabel(/J'ai mis mes codes à l'abri/).check()
  await start.click()

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Chacun son spectre')
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible()
  await page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('link', { name: 'Profil' })
    .click()
  await expect(page.getByRole('main').getByText('@theo_95')).toBeVisible()
})

test('connexion par pseudo, et message clair si le mot de passe est faux', async ({ page }) => {
  await mockSupabase(page, {
    users: [{ id: 'u-2', email: 'lea@example.com', username: 'Lea', password: 'Motdepasse42' }],
  })
  await page.goto('./#/welcome')
  await page.getByRole('tab', { name: 'Se connecter' }).click()

  await page.getByLabel('E-mail ou pseudo').fill('lea')
  await page.getByLabel('Mot de passe', { exact: true }).fill('mauvais')
  await page.getByRole('button', { name: 'Se connecter' }).last().click()
  await expect(page.getByText('Identifiants incorrects.')).toBeVisible()

  await page.getByLabel('Mot de passe', { exact: true }).fill('Motdepasse42')
  await page.getByRole('button', { name: 'Se connecter' }).last().click()
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible()
})
