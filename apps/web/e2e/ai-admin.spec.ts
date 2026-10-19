import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe('Painel de IA', () => {
  test('administrador vê as 6 tarefas e abre o seletor da triagem', async ({ page }) => {
    await login(page);
    await page.goto('/pt/admin/ai');
    await expect(page.getByRole('heading', { level: 1, name: 'Painel de IA' })).toBeVisible();

    await page.getByRole('tab', { name: 'Modelos por funcionalidade' }).click();
    for (const id of ['copilot', 'whatif', 'explain', 'briefing', 'alert_resolution', 'triage']) {
      await expect(page.getByTestId(`ai-task-${id}`)).toBeVisible();
    }

    await page
      .getByTestId('ai-task-triage')
      .getByRole('button', { name: /Alterar/ })
      .click();
    const picker = page.getByTestId('ai-model-picker');
    await expect(picker).toBeVisible();
    // Sem chave do OpenRouter o catálogo pode falhar: o erro tem de ser claro, com tentar de novo.
    const rows = picker.getByTestId('ai-model-row');
    const error = picker.getByRole('alert');
    await expect(
      rows.first().or(error).or(picker.getByText('Nenhum modelo encontrado')),
    ).toBeVisible({
      timeout: 20_000,
    });
    if (await rows.count()) {
      await expect(picker.getByText('Imagem').first()).toBeVisible();
    } else if (await error.count()) {
      await expect(error.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
    }
  });

  test('os outros separadores têm estado claro', async ({ page }) => {
    await login(page);
    await page.goto('/pt/admin/ai');
    await expect(page.getByText('Custo do mês')).toBeVisible();
    await page.getByRole('tab', { name: 'Orçamento e limites' }).click();
    await expect(page.getByLabel('Orçamento mensal (USD)')).toBeVisible();
    await page.getByRole('tab', { name: 'Avaliação da triagem' }).click();
    await expect(
      page.getByText('Ainda não há avaliação da triagem').or(page.getByText('Modelos comparados')),
    ).toBeVisible();
  });
});
