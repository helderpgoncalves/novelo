import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe('navegação e rotas antigas', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('a barra lateral conta a história por secções', async ({ page }) => {
    const nav = page.getByRole('navigation', { name: 'Principal' }).first();
    for (const section of [
      'Decidir',
      'Provar',
      'Dados da Vitrus',
      'Operação do piloto',
      'Prestar contas',
    ]) {
      await expect(nav.getByText(section, { exact: true })).toBeVisible();
    }
    for (const item of [
      'Ponto de partida',
      'Mapa',
      'Simulador',
      'Cenários',
      'Piloto',
      'Copiloto',
    ]) {
      await expect(nav.getByRole('link', { name: item, exact: true })).toBeVisible();
    }
    // O que saiu da navegação: a rede de contentores de têxtil que não existe e os ecrãs que vivem dentro de Lotes.
    for (const gone of ['Cobertura da rede', 'Bolsa de fibra', 'Evidência por marca']) {
      await expect(nav.getByRole('link', { name: gone })).toHaveCount(0);
    }
  });

  test('o item ativo acompanha as sub-rotas', async ({ page }) => {
    await page.goto('/pt/scenarios/compare');
    const nav = page.getByRole('navigation', { name: 'Principal' }).first();
    await expect(nav.getByRole('link', { name: 'Cenários', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('/coverage leva ao mapa com a camada de cobertura', async ({ page }) => {
    await page.goto('/pt/coverage?radius=500');
    await expect(page).toHaveURL(/\/pt\/map\?fill=cover/);
    await expect(page.getByRole('heading', { level: 1, name: /Mapa da rede/ })).toBeVisible();
    await expect(page.getByRole('radio', { name: /Cobertura a 300 m/ }).first()).toBeChecked();
  });

  test('/market e /brands abrem os separadores de Lotes e passaporte', async ({ page }) => {
    await page.goto('/pt/market');
    await expect(page).toHaveURL(/\/pt\/lots\?tab=market/);
    await expect(page.getByRole('heading', { level: 1, name: 'Lotes e passaporte' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Bolsa de fibra/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByText(/Reutilização primeiro/).first()).toBeVisible();

    await page.goto('/pt/brands');
    await expect(page).toHaveURL(/\/pt\/lots\?tab=brands/);
    await expect(page.getByRole('tab', { name: /Evidência por marca/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  test('o mapa não mostra a camada de contentores de têxtil e não dá erros', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !/basemaps\.cartocdn|Failed to load resource/.test(msg.text()))
        errors.push(msg.text());
    });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/pt/map');
    await expect(page.getByRole('heading', { level: 1, name: /Mapa da rede/ })).toBeVisible();
    await expect(page.getByRole('switch', { name: /^Contentores/ })).toHaveCount(0);
    await expect(page.getByText(/esta camada fica vazia/)).toHaveCount(0);
    await page.waitForTimeout(1500);
    expect(errors).toEqual([]);
  });
});
