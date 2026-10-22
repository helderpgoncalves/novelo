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
    // Na página inicial as perguntas falam do ponto de partida.
    await expect(panel.getByRole('button', { name: /taxa de captura atual/ })).toBeVisible();
    await expect(panel.getByRole('button', { name: /ponto de partida/ })).toBeVisible();
    await expect(panel.getByRole('button', { name: /Para onde vai o têxtil/ })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
  });

  test('uma pergunta simples devolve resposta ou um erro claro', async ({ page }) => {
    await page.getByRole('button', { name: /Abrir o copiloto/ }).click();
    const panel = page.getByRole('dialog', { name: 'Copiloto Novelo' });
    await panel.getByLabel('Pergunta ao copiloto').fill('Quanto têxtil se recolheu em 2025?');
    await panel.getByLabel('Pergunta ao copiloto').press('Enter');
    // O título provisório do painel repete a pergunta: procura-a na mensagem do utilizador.
    await expect(
      panel
        .getByTestId('copilot-user-message')
        .filter({ hasText: 'Quanto têxtil se recolheu em 2025?' }),
    ).toBeVisible();
    await expect(
      panel.getByTestId('copilot-assistant-message').or(panel.getByText(/não respondeu/)),
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
