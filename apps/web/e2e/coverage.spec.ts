import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe('cobertura da rede e contentores', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('estado à espera de dados explica a chegada a 20 de outubro', async ({ page }) => {
    await page.goto('/pt/coverage');
    await expect(page.getByRole('heading', { level: 1, name: 'Cobertura da rede' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: /chegam a 20 de outubro de 2026/ }),
    ).toBeVisible();
    // A referência francesa leva sempre o selo enquanto não estiver verificada.
    await expect(page.getByText('referência externa, por verificar')).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('table')).toBeVisible();
    await expect(
      page.getByRole('img', { name: /Mapa de Guimarães/ }).or(page.getByLabel(/Mapa de Guimarães/)),
    ).toBeVisible();
  });

  test('o seletor de raio muda o URL', async ({ page }) => {
    await page.goto('/pt/coverage');
    await page.getByRole('button', { name: '500 m' }).click();
    await expect(page).toHaveURL(/radius=500/);
    await expect(page.getByRole('button', { name: '500 m' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('button', { name: '200 m' }).click();
    await expect(page).toHaveURL(/radius=200/);
    await page.reload();
    await expect(page.getByRole('button', { name: '200 m' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('a camada de contentores no mapa não dá erros de consola', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !/basemaps\.cartocdn|Failed to load resource/.test(msg.text()))
        errors.push(msg.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/pt/map');
    await expect(page.getByRole('heading', { level: 1, name: 'Mapa da rede' })).toBeVisible();
    await expect(page.getByText(/Contentores/).first()).toBeVisible();
    // Sem contentores importados a camada fica desligada e explica porquê.
    await expect(page.getByRole('switch', { name: /Contentores/ })).toBeDisabled();
    await expect(page.getByText(/chegam a 20 de outubro/)).toBeVisible();
    await page.waitForTimeout(1500);
    expect(errors).toEqual([]);
  });

  test('o item de navegação leva à cobertura', async ({ page }) => {
    await page.getByRole('link', { name: 'Cobertura da rede' }).first().click();
    await expect(page).toHaveURL(/\/pt\/coverage/);
  });
});
