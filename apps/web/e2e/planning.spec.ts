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
    // Valores e origens vêm da API: o ecrã mostra o que o modelo usa, não constantes do teste.
    const params = (await (await page.request.get('/api/v1/planning/parameters')).json()) as {
      values: { rsu_treatment_eur_per_t: number | null };
      meta: { key: string; source: string; note: string | null }[];
    };
    const source = (key: string) => params.meta.find((x) => x.key === key)?.source;
    // Faixa: parâmetros, dados da Vitrus e pressupostos, pela ordem do ecrã.
    const counts = page.getByRole('main').getByRole('definition');
    await expect(counts.nth(0)).toHaveText(String(params.meta.length));
    await expect(counts.nth(1)).toHaveText(
      String(params.meta.filter((x) => x.source === 'vitrus_data').length),
    );
    await expect(counts.nth(2)).toHaveText(
      String(params.meta.filter((x) => x.source === 'assumption').length),
    );
    // Tratamento do indiferenciado: dado da Vitrus (TGR + Resinorte), com a fonte em nota.
    expect(source('rsu_treatment_eur_per_t')).toBe('vitrus_data');
    const treatment = params.values.rsu_treatment_eur_per_t;
    expect(treatment).not.toBeNull();
    await expect(page.getByLabel('Custo de tratamento do indiferenciado')).toHaveValue(
      String(treatment).replace('.', ','),
    );
    await expect(page.getByText(/TGR .*Resinorte/).first()).toBeVisible();
    // Viatura de têxtil dedicada: o preço é pressuposto com fonte; o estaleiro de Polvoreira é dado da Vitrus.
    expect(source('vehicle_capex_eur')).toBe('assumption');
    expect(source('depot_lat')).toBe('vitrus_data');
    await page.getByRole('button', { name: /Viatura de têxtil, estaleiro e otimizador/ }).click();
    await expect(page.getByLabel('Preço da viatura de têxtil (sem compactação)')).toBeVisible();
    await expect(page.getByText(/TED 72690-2025/).first()).toBeVisible();
    await expect(page.getByText(/Polvoreira/).first()).toBeVisible();
  });

  test('calcular um cenário de ponta a ponta e ver o resultado', async ({ page }) => {
    // Otimizador a sério (até SOLVER_TIME_LIMIT_S) e, com chave do OpenRouter, o «E se...?» com o modelo real.
    test.setTimeout(150_000);
    await page.goto('/pt/simulator');
    await page.getByLabel('Nome do cenário').fill('Cenário E2E');
    await page.getByRole('textbox', { name: 'Orçamento anual' }).fill('45000');
    await page.getByRole('button', { name: 'Calcular cenário' }).click();
    // O resultado aparece no próprio simulador, com o estado do cenário e a comparação com 2025.
    await expect(page).toHaveURL(/\/pt\/simulator\?.*r=[0-9a-f-]{36}/, { timeout: 60_000 });
    await expect(page.getByRole('heading', { level: 2, name: 'Cenário E2E' })).toBeVisible();
    await expect(page.getByText('Face a 2025 e à meta')).toBeVisible();
    await expect(page.getByText('Têxtil captado').first()).toBeVisible();
    await expect(page.getByText('Custo por tonelada').first()).toBeVisible();
    // Tratamento evitado (105,64 €/t da Vitrus) e custo líquido: os valores do ecrã são os do cenário guardado.
    const id = new URL(page.url()).searchParams.get('r');
    const scenario = (await (
      await page.request.get(`/api/v1/planning/scenarios/${id}`)
    ).json()) as {
      params: { rsu_treatment_eur_per_t: number | null };
      result: {
        kpis: { avoided_treatment_eur: number | null; net_annual_cost_eur: number | null };
      };
    };
    const { avoided_treatment_eur: avoided, net_annual_cost_eur: net } = scenario.result.kpis;
    expect(avoided).toBeGreaterThan(0);
    expect(net).not.toBeNull();
    const eur = (v: number) =>
      new RegExp(`^-?${String(Math.round(Math.abs(v))).replace(/\B(?=(\d{3})+$)/g, '\\s?')}\\s?€$`);
    const kpi = (label: string) =>
      page
        .locator('dl > div')
        .filter({ has: page.locator('dt', { hasText: label }) })
        .first()
        .locator('dd');
    await expect(kpi('Tratamento evitado')).toHaveText(eur(avoided ?? 0));
    await expect(kpi('Custo líquido para o município')).toHaveText(eur(net ?? 0));
    const treatment = String(scenario.params.rsu_treatment_eur_per_t).replace('.', ',');
    await expect(page.getByText(`× ${treatment} €/t`).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Plano da viatura de têxtil/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Freguesia a freguesia' })).toBeVisible();
    await page.getByRole('link', { name: 'Abrir cenário' }).click();
    await expect(page).toHaveURL(/\/pt\/scenarios\/[0-9a-f-]{36}/);
    await expect(page.getByRole('heading', { level: 1, name: 'Cenário E2E' })).toBeVisible();
    await page.getByRole('tab', { name: 'Rede e rotas' }).click();
    await expect(page.locator('canvas.maplibregl-canvas').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Freguesia a freguesia' })).toBeVisible();
    await page.getByRole('tab', { name: 'E se...?' }).click();
    // E se...?: sem chave do OpenRouter a IA está desligada e diz porquê; com chave, o modelo real responde com o
    // que entendeu («Entendi: …», ver prompts/whatif_v2.md), o que pode levar dezenas de segundos.
    await page.getByLabel('A tua pergunta').fill('E se Serzedelo passar a recolha a pedido?');
    await page.getByRole('button', { name: 'Perguntar' }).click();
    await expect(page.getByText(/está desligado|Entendi/).first()).toBeVisible({ timeout: 60_000 });
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
