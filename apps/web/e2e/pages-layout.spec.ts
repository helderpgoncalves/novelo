import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe('Páginas reorganizadas', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('separadores mudam de vista e ficam no URL', async ({ page }) => {
    await page.goto('/pt/circuits');
    await expect(page.getByRole('tab', { name: /^Circuitos/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await page.getByRole('tab', { name: 'Por tipologia' }).click();
    await expect(page).toHaveURL(/tab=typology/);
    await expect(page.getByRole('row', { name: /Orgânicos/ })).toBeVisible();

    await page.goto('/pt/localities');
    await page.getByRole('tab', { name: 'Por frequência' }).click();
    await expect(page.getByRole('row', { name: /dias por semana/ }).first()).toBeVisible();

    await page.goto('/pt/fleet');
    await page.getByRole('tab', { name: /^Viaturas/ }).click();
    await expect(page.getByRole('row', { name: /29-48-XU/ })).toBeVisible();
  });

  test('pressupostos filtram por origem', async ({ page }) => {
    await page.goto('/pt/assumptions');
    await page.getByRole('button', { name: 'Dados da Vitrus', exact: true }).click();
    // Dados da Vitrus: o têxtil no lixo por habitante (Vitrus + APA); os custos e taxas de captura são pressupostos.
    await expect(page.getByText('Têxtil no lixo por habitante e mês').first()).toBeVisible();
    await expect(page.getByText('Taxa de captura')).toHaveCount(0);
    await expect(page.getByText('Investimento por ponto')).toHaveCount(0);
  });

  test('sem overflow horizontal em telemóvel', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const path of [
      '',
      'circuits',
      'fleet',
      'localities',
      'lots',
      'market',
      'brands',
      'reports',
      'triage',
      'assumptions',
      'account',
      'users',
    ]) {
      await page.goto(`/pt/${path}`);
      await expect(page.locator('#content h1').first()).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow, path).toBeLessThanOrEqual(0);
    }
  });
});
