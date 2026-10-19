import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe('copiloto de IA', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('Ctrl+K abre o painel com estado vazio e sugestões', async ({ page }) => {
    await page.keyboard.press('Control+k');
    const panel = page.getByRole('dialog', { name: 'Copiloto Novelo' });
    await expect(panel).toBeVisible();
    await expect(panel.getByText('Em que posso ajudar?')).toBeVisible();
    await expect(panel.getByRole('button', { name: /60 mil euros/ })).toBeVisible();
    await expect(panel.getByRole('button', { name: /meta francesa/ })).toBeVisible();
    await expect(panel.getByRole('button', { name: /lacuna de cobertura/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
  });

  test('uma pergunta simples devolve resposta ou um erro claro', async ({ page }) => {
    await page.getByRole('button', { name: /Abrir o copiloto/ }).click();
    const panel = page.getByRole('dialog', { name: 'Copiloto Novelo' });
    await panel.getByLabel('Pergunta ao copiloto').fill('Quanto têxtil se recolheu em 2025?');
    await panel.getByLabel('Pergunta ao copiloto').press('Enter');
    await expect(panel.getByText('Quanto têxtil se recolheu em 2025?')).toBeVisible();
    await expect(
      panel.getByText(/Números verificados|Números por verificar|não respondeu/),
    ).toBeVisible({ timeout: 90_000 });
  });
});

test.describe('qualidade dos dados', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/pt/data-quality');
  });

  test('separadores, contagens e fontes', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Qualidade dos dados', level: 1 }),
    ).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Alertas/ })).toHaveAttribute(
      'data-state',
      'active',
    );
    await page.getByRole('tab', { name: /^Fontes recebidas/ }).click();
    await expect(page).toHaveURL(/tab=sources/);
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('sugerir resolução num alerta mostra a sugestão ou um erro claro', async ({ page }) => {
    await page.getByRole('button', { name: 'Sugerir resolução' }).first().click();
    await expect(
      page
        .getByText(/Sugestão da IA, ainda não aplicada|Sugestão automática, ainda não aplicada/)
        .or(page.getByText('Não foi possível sugerir uma resolução')),
    ).toBeVisible({ timeout: 90_000 });
  });
});
