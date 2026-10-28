import { defineConfig, devices } from '@playwright/test'

// En local dans un environnement sans navigateur Playwright téléchargé, PW_CHROMIUM_PATH
// permet de pointer vers un Chromium existant. En CI, `npx playwright install` suffit.
const executablePath = process.env.PW_CHROMIUM_PATH

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173/spectra/',
    locale: 'fr-FR',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 7'],
        ...(executablePath ? { launchOptions: { executablePath } } : {}),
      },
    },
  ],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/spectra/',
    reuseExistingServer: !process.env.CI,
  },
})
