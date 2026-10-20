import { defineConfig, devices } from '@playwright/test';

// Testes de ponta a ponta contra a stack a correr (`just dev`): web :3190, API :8190, Postgres.
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3190',
    locale: 'pt-PT',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      testIgnore: /(responsive|safe-area)\.spec\.ts/,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testMatch: /(responsive|safe-area)\.spec\.ts/,
    },
  ],
});
