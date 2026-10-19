import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe('idioma e tema', () => {
  test('mudar para inglês muda a interface e o URL, e persiste na conta', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Mudar idioma' }).click();
    await page.getByRole('menuitemradio', { name: 'English' }).click();
    await expect(page).toHaveURL(/\/en\/?$/);
    await expect(page.getByRole('heading', { level: 1, name: /Guimarães collects/ })).toBeVisible();
    await expect(page.locator('dl').first()).toContainText('301.3 t');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');

    // Um novo contexto sem preferência local segue a preferência guardada na conta.
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: /Guimarães collects/ })).toBeVisible();

    // Volta a português para não afetar os outros testes.
    await page.getByRole('button', { name: 'Change language' }).click();
    await page.getByRole('menuitemradio', { name: 'Português' }).click();
    await expect(page).toHaveURL(/\/pt\/?$/);
  });

  test('erros do servidor aparecem em inglês quando a interface está em inglês', async ({
    page,
  }) => {
    await page.goto('/en/login');
    await page.getByLabel('Email').fill('admin@bitsapiens.io');
    await page.getByLabel('Password', { exact: true }).fill('wrong-password-1');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toContainText('Wrong email or password.');
  });

  test('URL sem prefixo redireciona para o idioma preferido', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/pt\/login/);
  });

  test('tema escuro aplica-se e mantém-se ao recarregar', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Mudar tema' }).click();
    await page.getByRole('menuitemradio', { name: 'Escuro' }).click();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/dark/);
    await page.getByRole('button', { name: 'Mudar tema' }).click();
    await page.getByRole('menuitemradio', { name: 'Claro' }).click();
    await expect(page.locator('html')).not.toHaveClass(/dark/);
  });
});
