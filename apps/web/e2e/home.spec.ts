import { expect, type Page, test } from '@playwright/test';
import { login } from './helpers';

const OVERVIEW = '**/api/v1/textile/overview';

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe('página inicial', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('gancho com os números reais e uma só chamada principal', async ({ page }) => {
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toContainText('Guimarães recolhe');
    await expect(h1).toContainText('1,92');
    await expect(h1).toContainText('A França, 4,27');
    await expect(h1).toContainText(/Faltam ≈ 1\s?016 t/);
    await expect(h1).toContainText('estimativa');

    await expect(page.getByRole('link', { name: 'Simular a rede' }).first()).toHaveAttribute(
      'href',
      /\/simulator/,
    );
    // Os indicadores continuam a ser o primeiro grupo de definições da página.
    const strip = page.locator('dl').first();
    await expect(strip).toContainText('301,3 t');
    await expect(strip).toContainText('22,9%');
  });

  test('referências por verificar levam selo; as verificadas não', async ({ page }) => {
    const section = page.locator('#problema');
    await expect(section.getByRole('heading', { level: 2 })).toContainText('vezes mais');
    const germany = section.getByRole('listitem').filter({ hasText: 'Alemanha' });
    await expect(germany).toContainText('por verificar');
    const france = section.getByRole('listitem').filter({ hasText: 'França' });
    await expect(france).not.toContainText('por verificar');
    await expect(france.getByRole('link', { name: /Refashion/ })).toBeVisible();
  });

  test('cascata do potencial e relógio regulatório', async ({ page }) => {
    await expect(page.getByRole('img', { name: /Fluxo de têxtil: de um potencial/ })).toBeVisible();
    const clock = page.locator('#relogio');
    await expect(clock.getByRole('heading', { level: 2 })).toContainText(/Em \d+ dias/);
    await expect(clock.getByText('17/04/2028').first()).toBeVisible();
    await expect(clock.getByText('verificado').first()).toBeVisible();
    await expect(clock).toContainText('pagam os produtores');
  });

  test('freguesias: ranking liga ao detalhe e contentores explicam a espera', async ({ page }) => {
    const section = page.locator('#territorio');
    await expect(section.getByRole('img', { name: /Mapa das 48 freguesias/ })).toBeVisible();
    await expect(section).toContainText('20/10/2026');
    const second = section.locator('ol > li').nth(1).getByRole('button');
    const name = (await second.locator('span.truncate').innerText()).trim();
    await second.hover();
    await expect(section.locator('[aria-live="polite"]')).toContainText(name);
    await second.click();
    await expect(second).toHaveAttribute('aria-pressed', 'true');
  });

  test('fronteira de Pareto abre o cenário com o teclado', async ({ page }) => {
    const section = page.locator('#decisao');
    const points = section.getByRole('link', { name: /por ano a .* euros por tonelada/ });
    await expect(points.first()).toBeVisible();
    await points.first().focus();
    await expect(section.getByRole('status')).toContainText('Custo por tonelada');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/scenarios\/[0-9a-f-]+/);
  });

  test('provas: fontes, manchetes e separadores', async ({ page }) => {
    const proofs = page.locator('#provas');
    await expect(proofs.getByText('Vitrus Ambiente').first()).toBeVisible();
    await expect(proofs).toContainText('59,4%');
    await proofs.getByRole('tab', { name: /^Freguesias/ }).click();
    await expect(page).toHaveURL(/tab=parishes/);
    await expect(proofs.getByText('1–10 de 48')).toBeVisible();
  });

  test('sem cenários mostra o estado vazio com a próxima ação', async ({ page }) => {
    await page.route(OVERVIEW, async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      await route.fulfill({
        response,
        json: { ...body, scenario_frontier: [], pareto_ids: [] },
      });
    });
    await page.reload();
    const empty = page.locator('#decisao');
    await expect(empty).toContainText('Sem cenários calculados');
    await expect(empty.getByRole('link', { name: 'Calcular o primeiro cenário' })).toBeVisible();
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

  test('o copiloto abre a partir do gancho', async ({ page }) => {
    await page.getByRole('button', { name: 'Perguntar ao copiloto' }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
});

test.describe('movimento reduzido', () => {
  test.use({ reducedMotion: 'reduce' });
  test('mostra logo os valores finais e não oferece pausa', async ({ page }) => {
    await login(page);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('1,92');
    await expect(page.getByRole('button', { name: /animações/ })).toHaveCount(0);
    // Sem contagem: o número visível já é o final, logo ao primeiro frame.
    const visible = await page.locator('#home-hero-title [role="img"] > span').first().innerText();
    expect(visible).toBe('1,92');
  });
});

test.describe('pausa das animações', () => {
  test('o botão pausa e retoma', async ({ page }) => {
    await login(page);
    const button = page.getByRole('button', { name: 'Pausar animações' });
    await button.click();
    await expect(page.getByRole('button', { name: 'Retomar animações' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

test.describe('telemóvel', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
  test('sem scroll horizontal e com alvos tocáveis', async ({ page }) => {
    await login(page);
    await page.waitForTimeout(500);
    await noHorizontalOverflow(page);
    const cta = page.getByRole('link', { name: 'Simular a rede' }).first();
    const box = await cta.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(40);
    await page.locator('#relogio').scrollIntoViewIfNeeded();
    await noHorizontalOverflow(page);
    await page.locator('#decisao').scrollIntoViewIfNeeded();
    await noHorizontalOverflow(page);
  });
});
