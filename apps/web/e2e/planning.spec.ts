import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe('simulador e cenários', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('mapa mostra as 48 freguesias com população real', async ({ page }) => {
    await page.goto('/pt/map');
    const strip = page.locator('dl').first();
    await expect(strip).toContainText('48');
    await expect(strip).toContainText('156 830');
    await expect(
      page.getByRole('region', { name: 'Mapa das freguesias de Guimarães' }),
    ).toBeVisible();
    await expect(page.locator('canvas.maplibregl-canvas')).toBeVisible();
    await page.getByRole('button', { name: 'População' }).click();
    await expect(page.getByRole('button', { name: 'População' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('pressupostos mostram a origem de cada número', async ({ page }) => {
    await page.goto('/pt/assumptions');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Pressupostos do modelo' }),
    ).toBeVisible();
    await expect(page.getByText('Dados da Vitrus').first()).toBeVisible();
    await expect(page.getByText('Pressuposto').first()).toBeVisible();
  });

  test('calcular um cenário de ponta a ponta e ver o resultado', async ({ page }) => {
    await page.goto('/pt/simulator');
    await page.getByLabel('Nome do cenário').fill('Cenário E2E');
    await page.getByRole('spinbutton', { name: 'Orçamento anual' }).fill('45000');
    await page.getByRole('button', { name: 'Calcular cenário' }).click();
    await expect(page).toHaveURL(/\/pt\/scenarios\/[0-9a-f-]{36}/, { timeout: 60_000 });
    await expect(page.getByRole('heading', { level: 1, name: 'Cenário E2E' })).toBeVisible();
    await expect(page.getByText('Têxtil captado')).toBeVisible();
    await expect(page.getByText('Custo por tonelada')).toBeVisible();
    await expect(page.locator('canvas.maplibregl-canvas').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Freguesia a freguesia' })).toBeVisible();
    // E se...?: sem chave do OpenRouter a IA está desligada e diz porquê.
    await page.getByLabel('A tua pergunta').fill('E se Serzedelo passar a recolha a pedido?');
    await page.getByRole('button', { name: 'Perguntar' }).click();
    await expect(page.getByText(/está desligado|Entendi/)).toBeVisible();
  });

  test('comparar dois cenários mostra as diferenças', async ({ page }) => {
    const create = async (label: string, budget: number) => {
      const res = await page.request.post('/api/v1/planning/scenarios', {
        data: { label, objective: 'max_tonnes', budget_eur_year: budget },
      });
      expect(res.ok()).toBeTruthy();
      return (await res.json()) as { id: string };
    };
    const a = await create('Pequeno', 15000);
    const b = await create('Grande', 80000);
    await page.goto(`/pt/scenarios/compare?a=${a.id}&b=${b.id}`);
    await expect(page.getByRole('heading', { level: 1, name: 'Comparar cenários' })).toBeVisible();
    await expect(page.getByRole('row', { name: /Têxtil captado/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /Investimento/ })).toBeVisible();
    await page.goto('/pt/scenarios');
    await expect(page.getByRole('link', { name: 'Pequeno' }).first()).toBeVisible();
  });

  test('relatório RAP: gerar o PDF a partir de cenários', async ({ page }) => {
    await page.goto('/pt/reports');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Relatório RAP num clique' }),
    ).toBeVisible();
    const generate = page.getByRole('button', { name: 'Gerar relatório' });
    await expect(generate).toBeEnabled();
    await Promise.all([page.waitForEvent('popup').catch(() => null), generate.click()]);
    await expect(page.getByText('Relatório gerado')).toBeVisible();
    const list = (await (await page.request.get('/api/v1/reports')).json()) as { id: string }[];
    const pdf = await page.request.get(`/api/v1/reports/${list[0]?.id}/pdf`);
    expect(pdf.headers()['content-type']).toBe('application/pdf');
    expect((await pdf.body()).subarray(0, 4).toString()).toBe('%PDF');
    await expect(page.getByRole('row', { name: /Relatório RAP/ }).first()).toBeVisible();
  });
});
