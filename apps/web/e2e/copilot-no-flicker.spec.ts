import { expect, type Page, request, test } from '@playwright/test';
import { errorSightings, watchForErrors } from './error-watch';
import { approveByEmail, login, PASSWORD, uniqueEmail } from './helpers';

// Regressão: ao acabar a geração o copiloto não pode mostrar, nem por um frame, nenhum elemento de erro.
// O MutationObserver apanha o que um screenshot não apanha (um erro que vive 1 ms).

const API = process.env.E2E_API_URL ?? 'http://localhost:8190';
const user = { email: uniqueEmail('flicker'), password: PASSWORD };

test.beforeAll(async () => {
  const api = await request.newContext({ baseURL: API });
  const res = await api.post('/api/v1/auth/register', {
    data: { email: user.email, password: user.password, name: 'Teste Flicker', locale: 'pt-PT' },
  });
  expect(res.ok()).toBeTruthy();
  await api.dispose();
  await approveByEmail(user.email); // contas novas esperam por aprovação
});

test.beforeEach(() => test.setTimeout(150_000));

async function settle(page: Page) {
  const last = page.getByTestId('copilot-assistant-message').last();
  await expect(last).toHaveAttribute('data-state', 'complete', { timeout: 120_000 });
  // Margem para reconciliação, invalidações e eventos tardios (`verification`, `usage`, título).
  await page.waitForTimeout(2_500);
}

test('página /chat: sem elementos de erro durante nem depois do stream', async ({ page }) => {
  await watchForErrors(page);
  await login(page, user);
  await page.goto('/pt/chat');
  const box = page.getByRole('combobox', { name: 'Pergunta ao copiloto' });
  await box.fill('Quanto têxtil se recolheu em 2025?');
  await box.press('Enter');
  await settle(page);
  expect(await errorSightings(page)).toEqual([]);
});

test('painel ⌘K: sem elementos de erro durante nem depois do stream', async ({ page }) => {
  await watchForErrors(page);
  await login(page, user);
  await page.keyboard.press('ControlOrMeta+k');
  const box = page.getByRole('combobox', { name: 'Pergunta ao copiloto' });
  await expect(box).toBeVisible();
  await box.fill('Quantos habitantes tem Guimarães?');
  await box.press('Enter');
  await settle(page);
  expect(await errorSightings(page)).toEqual([]);
});

test.describe('telemóvel 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('página /chat: sem elementos de erro durante nem depois do stream', async ({ page }) => {
    await watchForErrors(page);
    await login(page, user);
    await page.goto('/pt/chat');
    const box = page.getByRole('combobox', { name: 'Pergunta ao copiloto' });
    await box.fill('Quanto têxtil se recolheu em 2025?');
    await box.press('Enter');
    await settle(page);
    expect(await errorSightings(page)).toEqual([]);
  });

  test('painel: sem elementos de erro durante nem depois do stream', async ({ page }) => {
    await watchForErrors(page);
    await login(page, user);
    await page.goto('/pt/simulator');
    await expect(page.locator('#content h1').first()).toBeVisible();
    await page.getByRole('button', { name: /Abrir o copiloto/ }).click();
    const box = page.getByRole('combobox', { name: 'Pergunta ao copiloto' });
    await box.fill('Quantos habitantes tem Guimarães?');
    await box.press('Enter');
    await settle(page);
    expect(await errorSightings(page)).toEqual([]);
  });
});
