import { expect, test } from '@playwright/test'

test('le manifeste PWA est valide', async ({ request }) => {
  const res = await request.get('manifest.webmanifest')
  expect(res.ok()).toBeTruthy()
  const manifest = await res.json()
  expect(manifest.display).toBe('standalone')
  expect(manifest.theme_color).toBe('#0B0A14')
  expect(manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable')).toBe(true)
  expect(manifest.shortcuts).toHaveLength(3)
})
