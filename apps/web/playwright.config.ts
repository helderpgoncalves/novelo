import { defineConfig, devices } from '@playwright/test';

// Testes de ponta a ponta contra a stack a correr (`just dev`): web :3190, API :8190, Postgres.
//   E2E_SUITE=smoke (por omissão em `just e2e`)  fluxos críticos, ~1-2 min
//   E2E_SUITE=full  (`just e2e-full`)            tudo, incluindo copiloto com o modelo real
//   E2E_WORKERS=4  E2E_FULLY_PARALLEL=1          mais paralelismo (os testes de um ficheiro podem depender uns dos outros)
//   --project=desktop|mobile                     escolhe o formato; E2E_FRESH_LOGIN=1 desliga a sessão partilhada do admin
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3190';
const smoke = (process.env.E2E_SUITE ?? 'full') === 'smoke';
const SMOKE_SPECS =
  /(auth|home|planning|coverage|municipal|data-table|errors|operations)\.spec\.ts/;
const MOBILE_SPECS = /(responsive|safe-area)\.spec\.ts/;

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: process.env.E2E_FULLY_PARALLEL === '1',
  workers: Number(process.env.E2E_WORKERS ?? 4),
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  timeout: 30_000,
  expect: { timeout: 8_000 },
  // Reutiliza a stack se já estiver a correr (`just dev`); senão arranca a API e o Vite (precisa do Postgres: `just db-wait`).
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : [
        {
          command: 'cd ../api && uv run uvicorn novelo.main:app --port 8190',
          url: 'http://localhost:8190/api/v1/health',
          reuseExistingServer: true,
          timeout: 60_000,
        },
        { command: 'pnpm dev', url: baseURL, reuseExistingServer: true, timeout: 60_000 },
      ],
  use: {
    baseURL,
    locale: 'pt-PT',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'desktop',
      testMatch: smoke ? SMOKE_SPECS : undefined,
      testIgnore: MOBILE_SPECS,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'] },
      testMatch: MOBILE_SPECS,
    },
  ],
});
