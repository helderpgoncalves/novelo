import { expect, test } from '@playwright/test';
import { login } from './helpers';

test('em telemóvel a navegação abre numa gaveta e não há scroll horizontal', async ({ page }) => {
  await login(page);
  await expect(page.getByRole('button', { name: 'Abrir navegação' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.getByRole('button', { name: 'Abrir navegação' }).click();
  await page.getByRole('link', { name: 'Circuitos atuais' }).click();
  await expect(page).toHaveURL(/\/pt\/circuits/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Circuitos e viaturas atuais' }),
  ).toBeVisible();
});

test('o ecrã de entrada funciona em telemóvel', async ({ page }) => {
  await page.goto('/pt/login');
  await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
