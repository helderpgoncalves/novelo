import { expect, test } from '@playwright/test';
import { login } from './helpers';

const noOverflow = (page: import('@playwright/test').Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test('em telemóvel a navegação é uma barra de separadores e "Mais" abre a gaveta', async ({
  page,
}) => {
  await login(page);
  const tabs = page.getByRole('navigation', { name: 'Separadores principais' });
  await expect(tabs).toBeVisible();
  for (const name of ['Início', 'Mapa', 'Simular', 'Copiloto', 'Mais']) {
    const item = tabs.getByRole(name === 'Mais' ? 'button' : 'link', { name });
    await expect(item).toBeVisible();
    const box = await item.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(48);
  }
  await expect(tabs.getByRole('link', { name: 'Início' })).toHaveAttribute('aria-current', 'page');
  expect(await noOverflow(page)).toBe(true);

  await tabs.getByRole('button', { name: 'Mais secções' }).click();
  await page.getByRole('link', { name: 'Circuitos atuais' }).click();
  await expect(page).toHaveURL(/\/pt\/circuits/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Circuitos e viaturas atuais' }),
  ).toBeVisible();
  // Numa secção fora dos 4 destinos, "Mais" fica marcado como ativo.
  await expect(tabs.getByRole('link', { name: 'Início' })).not.toHaveAttribute(
    'aria-current',
    'page',
  );
  await tabs.getByRole('link', { name: 'Mapa' }).click();
  await expect(page).toHaveURL(/\/pt\/map/);
  await expect(tabs.getByRole('link', { name: 'Mapa' })).toHaveAttribute('aria-current', 'page');
});

test('no copiloto a barra de separadores sai de cena e o menu fica no topo', async ({ page }) => {
  await login(page);
  await page.goto('/pt/chat');
  await expect(page.getByTestId('copilot-composer')).toBeVisible();
  await expect(page.getByTestId('tab-bar')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Abrir navegação' })).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
});

test('com o teclado (foco num campo) a barra de separadores esconde-se', async ({ page }) => {
  await login(page);
  await page.goto('/pt/assumptions');
  const field = page.locator('#content input:not([type=checkbox]):not([type=radio])').first();
  await expect(field).toBeVisible();
  await expect(page.getByTestId('tab-bar')).toBeVisible();
  await field.focus();
  await expect(page.getByTestId('tab-bar')).toHaveCount(0);
  await field.blur();
  await expect(page.getByTestId('tab-bar')).toBeVisible();
});

test('o ecrã de entrada funciona em telemóvel', async ({ page }) => {
  // Por defeito o login é por link no email; a password está em ?method=password.
  await page.goto('/pt/login?method=password');
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
});
