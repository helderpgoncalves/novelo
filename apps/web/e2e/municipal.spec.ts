import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe('rede municipal de contentores', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('visão geral mostra os KPIs reais e a nota de contexto', async ({ page }) => {
    await page.goto('/pt/municipal');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Rede municipal de contentores' }),
    ).toBeVisible();
    await expect(page.getByText('Contentores municipais, não de têxteis.')).toBeVisible();
    await expect(page.getByText('2 751', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('2 026', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('17,4', { exact: true })).toBeVisible();
    await expect(page.getByText('47,8%').first()).toBeVisible();
  });

  test('o separador ativo vive no URL e os locais abrem o detalhe sem nomes', async ({ page }) => {
    await page.goto('/pt/municipal');
    await page.getByRole('tab', { name: /Locais/ }).click();
    await expect(page).toHaveURL(/tab=sites/);
    await expect(page.getByText('Locais municipais').first()).toBeVisible();
    const row = page.getByRole('row').nth(1);
    await expect(row).toBeVisible();
    await page
      .getByRole('button', { name: /Ações|Mais ações|⋯/ })
      .first()
      .click();
    await page.getByRole('menuitem', { name: 'Ver detalhe' }).click();
    const sheet = page.getByTestId('municipal-site-sheet');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('Contentores neste local')).toBeVisible();
    await expect(page).toHaveURL(/site=S/);
  });

  test('candidatos explicam o critério e levam a etiqueta estimativa', async ({ page }) => {
    await page.goto('/pt/municipal?tab=candidates');
    await expect(page.getByText('Como se escolhem os candidatos')).toBeVisible();
    await expect(page.getByText(/ainda não foi validado com a Vitrus/)).toBeVisible();
    await expect(page.getByText('estimativa', { exact: false }).first()).toBeVisible();
  });

  test('canal B2B mostra lares e hotelaria reais, sem nomes e sem toneladas inventadas', async ({
    page,
  }) => {
    await page.goto('/pt/municipal?tab=b2b');
    await expect(page.getByText('Lares e hotelaria: têxtil limpo, à parte')).toBeVisible();
    await expect(page.getByText('A medir no piloto')).toBeVisible();
    await expect(page.getByText('Lares', { exact: true })).toBeVisible();
    await expect(page.getByText('Hotelaria', { exact: true }).first()).toBeVisible();
    // Os nomes são privados: só aparecem a um admin que os pede.
    await expect(page.getByRole('columnheader', { name: 'Nome' })).toHaveCount(0);
  });

  test('lacunas e qualidade carregam sem erros', async ({ page }) => {
    await page.goto('/pt/municipal?tab=gaps');
    await expect(page.getByText('Onde falta mais')).toBeVisible();
    await expect(page.getByText('Lordelo').first()).toBeVisible();
    await page.goto('/pt/municipal?tab=quality');
    await expect(page.getByText('Alertas da rede municipal')).toBeVisible();
    await expect(
      page.locator('table').getByText('Contentores sem coordenadas').first(),
    ).toBeVisible();
  });

  test('o mapa liga as camadas municipais por preset e distingue as redes por forma', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/pt/map');
    // Ponto de partida: nada municipal ligado.
    await expect(page.getByRole('button', { name: 'Rede de têxteis' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('button', { name: 'Rede municipal' }).first().click();
    await expect(page).toHaveURL(/preset=municipal/);
    await expect(page.getByRole('button', { name: 'Rede municipal' }).first()).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByText('Contentores municipais, não de têxteis.').first()).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Enterrado/ })).toBeVisible();
    await page.getByRole('radio', { name: /Candidatos a têxteis/ }).click();
    await expect(page).toHaveURL(/sites=candidates/);
    await page.waitForTimeout(1000);
    expect(errors).toEqual([]);
  });

  test('os alertas municipais aparecem e filtram na qualidade dos dados', async ({ page }) => {
    await page.goto('/pt/data-quality?origin=municipal');
    await expect(page.getByRole('button', { name: 'Rede municipal' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByText('Contentores sem coordenadas').first()).toBeVisible();
    await page.getByRole('button', { name: 'Têxteis' }).click();
    await expect(page.getByText('Contentores sem coordenadas')).toHaveCount(0);
  });

  test('a navegação leva à rede municipal', async ({ page }) => {
    // A raiz `/pt/` é a página pública; a navegação lateral vive dentro da aplicação.
    await page.goto('/pt/simulator');
    await page.getByRole('link', { name: 'Rede municipal' }).first().click();
    await expect(page).toHaveURL(/\/pt\/municipal/);
  });
});
