import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe('planeamento: incerteza, robustez, referência e piloto', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  const createScenario = async (
    page: import('@playwright/test').Page,
    label: string,
    budget: number,
  ) => {
    const res = await page.request.post('/api/v1/planning/scenarios', {
      data: { label, objective: 'max_tonnes', budget_eur_year: budget },
    });
    expect(res.ok()).toBeTruthy();
    return (await res.json()) as { id: string };
  };

  test('calcular um cenário e ver o separador Incerteza com o tornado', async ({ page }) => {
    await page.goto('/pt/simulator');
    // Secções colapsáveis com o valor escolhido e resumo vivo
    await expect(page.getByRole('heading', { level: 2, name: /^Objetivo/ })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: /^Pressupostos/ })).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: /^Restrições por freguesia/ }),
    ).toBeVisible();
    await expect(page.getByText('Por calcular').first()).toBeVisible();
    await page.getByLabel('Nome do cenário').fill('Cenário incerteza');
    await page.getByRole('textbox', { name: 'Orçamento anual' }).fill('45000');
    await page.getByRole('button', { name: 'Calcular cenário' }).click();
    await expect(page).toHaveURL(/\/pt\/simulator\?.*r=[0-9a-f-]{36}/, { timeout: 60_000 });
    await expect(page.getByRole('heading', { level: 2, name: 'Cenário incerteza' })).toBeVisible();
    // Mudar o orçamento deixa o resultado desatualizado até recalcular
    await page.getByRole('textbox', { name: 'Orçamento anual' }).fill('50000');
    await expect(page.getByText('Desatualizado').first()).toBeVisible();
    await page.getByRole('link', { name: 'Ver incerteza' }).click();
    await expect(page).toHaveURL(/\/pt\/scenarios\/[0-9a-f-]{36}\?tab=uncertainty/);
    await page.getByRole('tab', { name: 'Resumo' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Cenário incerteza' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Resumo' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await page.getByRole('tab', { name: 'Incerteza' }).click();
    await expect(page).toHaveURL(/tab=uncertainty/);
    await expect(page.getByRole('heading', { name: 'Que pressupostos pesam mais' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('list', { name: /Gráfico de tornado/ })).toBeVisible();
    await expect(
      page.getByText(/dos maiores fatores de incerteza são pressupostos sem dado/),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Intervalo provável' })).toBeVisible();
    await page.getByRole('button', { name: 'Como foi calculado' }).click();
    await expect(page.getByText('Semente')).toBeVisible();

    await page.getByRole('tab', { name: 'Rede e rotas' }).click();
    await expect(page.locator('canvas.maplibregl-canvas').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Freguesia a freguesia' })).toBeVisible();
  });

  test('comparação mostra a robustez do cenário A face ao B', async ({ page }) => {
    const a = await createScenario(page, 'Robusto A', 60000);
    const b = await createScenario(page, 'Robusto B', 20000);
    await page.goto(`/pt/scenarios/compare?a=${a.id}&b=${b.id}`);
    await expect(page.getByRole('heading', { name: 'Robustez da comparação' })).toBeVisible();
    await expect(page.getByText(/das amostras, Robusto A é melhor do que Robusto B/)).toBeVisible({
      timeout: 30_000,
    });
  });

  test('cenários de referência: desempenho francês com o selo por verificar', async ({ page }) => {
    await page.goto('/pt/scenarios');
    await expect(page.getByRole('heading', { name: 'Cenários de referência' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Desempenho francês' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Referência externa, por verificar')).toBeVisible();
    await expect(page.getByText('Teto alcançável')).toBeVisible();
    await page.getByRole('button', { name: 'Criar cenário' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Criar e calcular' })).toBeVisible();
  });

  test('piloto: resultado real com intervalos, fontes e piso de sinal', async ({ page }) => {
    await page.goto('/pt/pilot');
    await expect(page.getByRole('heading', { level: 1, name: 'Piloto' })).toBeVisible();
    await expect(page.getByText('Têxtil no piloto')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/P10 a P90/).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: '2 freguesias escolhidas' })).toBeVisible();
    await expect(page.getByText('Pontuação de aprendizagem')).toBeVisible();
    await page.getByRole('button', { name: 'A conta do piso, passo a passo' }).click();
    await expect(page.getByRole('cell', { name: 'Rejeito observado' })).toBeVisible();

    await page.getByLabel('Freguesias').fill('3');
    await page.getByRole('button', { name: 'Recomendar piloto' }).click();
    await expect(page).toHaveURL(/k=3/);
    await expect(page.getByRole('heading', { name: '3 freguesias escolhidas' })).toBeVisible({
      timeout: 30_000,
    });
  });
});
