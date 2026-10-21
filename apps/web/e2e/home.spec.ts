import { expect, type Page, test } from '@playwright/test';
import { login } from './helpers';

const OVERVIEW = '**/api/v1/textile/overview';

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe('sala de decisão', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('título e faixa de situação com os números reais, selo e fonte', async ({ page }) => {
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toContainText('Guimarães recolhe');
    await expect(h1).toContainText(/≈ 2\s?325 t por ano ainda vão para o lixo/);

    const strip = page.getByRole('region', { name: 'Situação em números' });
    await expect(strip).toContainText('301,3');
    await expect(strip).toContainText('11,5%');
    await expect(strip).toContainText('medido');
    await expect(strip).toContainText('estimativa');
    await expect(strip).toContainText(/\d+\s*dias/);
    await expect(strip).toContainText('Dias até');
  });

  test('mapa: camada, teclado, detalhe e URL partilhável', async ({ page }) => {
    const map = page.getByRole('listbox', { name: /Mapa das 48 freguesias de Guimarães/ });
    await expect(map).toBeVisible();
    await expect(page.getByText('Não existe captura por freguesia').first()).toBeVisible();

    await page
      .getByRole('radio', { name: /Contentores municipais \(não são de têxteis\)/ })
      .click();
    await expect(page).toHaveURL(/layer=containers/);

    await map.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/parish=\w+/);
    await expect(page.getByRole('link', { name: 'Ver no mapa completo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Perguntar ao Copiloto' })).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(page).not.toHaveURL(/parish=/);
  });

  test('orçamento: a alça mexe nos números e abre o simulador com o orçamento', async ({
    page,
  }) => {
    const slider = page.locator('#orcamento').getByRole('slider');
    await expect(slider).toBeVisible();
    await slider.focus();
    await page.keyboard.press('End');
    await expect(page).toHaveURL(/budget=\d+/);
    const open = page.getByRole('link', { name: 'Abrir no simulador com este orçamento' });
    await expect(open).toHaveAttribute('href', /\/simulator\?.*budget=\d+/);
  });

  test('o plano sem contentores: porta a porta com 0 km novos, custo com incerteza e o piloto', async ({
    page,
  }) => {
    const plan = page.locator('#plano');
    await plan.scrollIntoViewIfNeeded();
    await expect(plan.getByRole('heading', { name: /O plano: sem contentores/ })).toBeVisible();
    await expect(plan).toContainText(/\d+ freguesias/);
    await expect(plan).toContainText('0 km novos');
    // O intervalo P10–P90 vem de um POST (sensibilidade); sem ele fica o custo central e o botão para o calcular.
    await expect(plan.getByText(/\d+ €\/t/).first()).toBeVisible({ timeout: 20_000 });
    await expect(plan.getByRole('link', { name: 'Ver o piloto' })).toHaveAttribute(
      'href',
      /\/pilot/,
    );
  });

  test('o fio, confiança dos dados e próximos passos', async ({ page }) => {
    await expect(page.getByRole('img', { name: /Do têxtil gerado, estimado em/ })).toBeVisible();
    const trust = page.locator('#confianca');
    await expect(trust).toContainText('medidos');
    await expect(trust).toContainText('em falta');

    await page.locator('#passos').scrollIntoViewIfNeeded();
    await expect(page.locator('#passos')).toContainText(
      /contas por aprovar|Sem contas por aprovar/,
    );
  });

  test('evidência por baixo da dobra: tabelas com fonte e separador na URL', async ({ page }) => {
    const proofs = page.locator('#provas');
    await proofs.scrollIntoViewIfNeeded();
    await expect(proofs.getByText('Vitrus Ambiente').first()).toBeVisible();
    await proofs.getByRole('tab', { name: /^Freguesias/ }).click();
    await expect(page).toHaveURL(/tab=parishes/);
    await expect(proofs.getByText('1–10 de 48')).toBeVisible();
  });

  test('sem cenários guardados o orçamento mostra o estado vazio com a próxima ação', async ({
    page,
  }) => {
    await page.route(OVERVIEW, async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      await route.fulfill({ response, json: { ...body, scenario_frontier: [], pareto_ids: [] } });
    });
    await page.reload();
    await expect(page.getByText('Ainda não há cenários guardados')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Calcular o primeiro cenário' })).toBeVisible();
  });

  test('erro da API mostra mensagem e permite tentar de novo', async ({ page }) => {
    let fail = true;
    await page.route(OVERVIEW, async (route) => {
      if (fail) await route.fulfill({ status: 500, json: { code: 'boom', message: 'Falhou' } });
      else await route.continue();
    });
    await page.reload();
    await expect(page.getByRole('alert')).toBeVisible();
    fail = false;
    await page.getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Guimarães recolhe');
  });

  test('o Copiloto abre com uma pergunta sugerida', async ({ page }) => {
    await page.locator('#passos').scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: /Que freguesias têm mais têxtil por desviar/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});

test.describe('telemóvel', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test('sem scroll horizontal, faixa em carrossel e alvos tocáveis', async ({ page }) => {
    await login(page);
    await page.waitForTimeout(500);
    await noHorizontalOverflow(page);
    const chip = page.getByRole('radio', { name: 'População', exact: true });
    const box = await chip.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
    await page.locator('#orcamento').scrollIntoViewIfNeeded();
    await noHorizontalOverflow(page);
    await page.locator('#provas').scrollIntoViewIfNeeded();
    await noHorizontalOverflow(page);
  });
});
