import { expect, test } from '@playwright/test'

test('le shell se charge, navigue et respecte le thème', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  await page.goto('./')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Chacun son spectre')

  const nav = page.getByRole('navigation', { name: 'Navigation principale' })
  await nav.getByRole('link', { name: 'Amis' }).click()
  await expect(page).toHaveURL(/#\/friends$/)
  await expect(page.getByRole('heading', { name: "Pas encore d'amis ici" })).toBeVisible()

  // Lien profond direct (HashRouter : fonctionne dès le premier chargement).
  await page.goto('./#/playlists')
  await expect(page.getByRole('heading', { name: 'Aucune playlist commune' })).toBeVisible()

  await page.getByRole('button', { name: 'Changer de thème' }).click()
  await expect(page.locator('html')).not.toHaveClass(/dark/)

  expect(errors).toEqual([])
})

test('le manifeste PWA est valide', async ({ request }) => {
  const res = await request.get('manifest.webmanifest')
  expect(res.ok()).toBeTruthy()
  const manifest = await res.json()
  expect(manifest.display).toBe('standalone')
  expect(manifest.theme_color).toBe('#0B0A14')
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true)
  expect(manifest.shortcuts).toHaveLength(3)
})
