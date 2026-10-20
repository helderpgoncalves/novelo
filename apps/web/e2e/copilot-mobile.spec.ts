import { expect, type Page, request, test } from '@playwright/test';
import { login, PASSWORD, uniqueEmail } from './helpers';

// Copiloto em telemóvel (390×844 e 430×932, claro e escuro): ecrã inteiro, cabeçalho de uma linha,
// estado vazio sóbrio, menu "+", histórico em folha e gráfico legível. Com SHOTS=<pasta> guarda capturas.

const API = process.env.E2E_API_URL ?? 'http://localhost:8190';
const SHOTS = process.env.SHOTS;
const user = { email: uniqueEmail('copiloto-mobile'), password: PASSWORD };

test.describe.configure({ mode: 'serial' });
test.beforeEach(() => test.setTimeout(150_000));

test.beforeAll(async () => {
  const api = await request.newContext({ baseURL: API });
  const res = await api.post('/api/v1/auth/register', {
    data: { email: user.email, password: user.password, name: 'Teste Mobile', locale: 'pt-PT' },
  });
  expect(res.ok()).toBeTruthy();
  await api.dispose();
});

const shot = async (page: Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
};
const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const sizes = [
  { w: 390, h: 844 },
  { w: 430, h: 932 },
];
const schemes = ['light', 'dark'] as const;

for (const { w, h } of sizes) {
  for (const scheme of schemes) {
    test.describe(`${w}×${h} ${scheme}`, () => {
      test.use({
        viewport: { width: w, height: h },
        hasTouch: true,
        isMobile: true,
        colorScheme: scheme,
      });
      const tag = `${w}-${scheme}`;

      test('painel: cabeçalho de uma linha, vazio sóbrio, menu + e histórico', async ({ page }) => {
        await login(page, user);
        await page.goto('/pt/simulator');
        await expect(page.locator('#content h1').first()).toBeVisible();
        await page.getByRole('button', { name: /Abrir o copiloto/ }).click();
        const panel = page.getByRole('dialog', { name: 'Copiloto Novelo' });
        await expect(panel).toBeVisible();

        // Ecrã inteiro e cabeçalho compacto.
        const box = await panel.boundingBox();
        expect(box?.width).toBeGreaterThanOrEqual(w - 1);
        expect(box?.height).toBeGreaterThanOrEqual(h - 1);
        const header = panel.locator('header').first();
        expect((await header.boundingBox())?.height).toBeLessThanOrEqual(52 + 1);

        // Estado vazio: saudação, três perguntas do ecrã, contexto removível, sem faíscas.
        await expect(panel.getByText('Em que posso ajudar?')).toBeVisible();
        await expect(
          panel.getByTestId('copilot-empty-suggestions').getByRole('button'),
        ).toHaveCount(3);
        await expect(panel.getByTestId('copilot-context-chip')).toContainText('Simulador da rede');
        await expect(page.getByRole('button', { name: 'Ir para o fim' })).toHaveCount(0);
        await expect(panel.locator('svg.lucide-sparkles, svg.lucide-sparkle')).toHaveCount(0);
        expect(await overflow(page)).toBeLessThanOrEqual(1);
        const input = panel.getByRole('combobox', { name: 'Pergunta ao copiloto' });
        expect(await input.evaluate((el) => getComputedStyle(el).fontSize)).toBe('16px');
        for (const b of await panel.getByTestId('copilot-composer').locator('button').all()) {
          expect(
            (await b.boundingBox())?.height,
            (await b.getAttribute('aria-label')) ?? '',
          ).toBeGreaterThanOrEqual(43);
        }
        await shot(page, `vazio-${tag}`);

        // Menu "+".
        await panel.getByRole('button', { name: 'Anexar ou mencionar' }).click();
        const menu = page.getByRole('menu');
        await expect(menu.getByRole('menuitem')).toHaveCount(4);
        await shot(page, `mais-${tag}`);
        await page.keyboard.press('Escape');

        // Remover o contexto.
        await panel.getByRole('button', { name: 'Deixar de enviar o ecrã atual' }).click();
        await expect(panel.getByTestId('copilot-context-chip')).toHaveCount(0);

        // Menu "⋯" e histórico em folha inferior.
        await panel.getByRole('button', { name: 'Mais opções' }).click();
        await page.getByRole('menuitem', { name: 'Conversas' }).click();
        const history = page.getByRole('dialog', { name: 'Conversas' });
        await expect(history).toBeVisible();
        await shot(page, `historico-${tag}`);
      });

      test('página /chat: só o essencial visível e sem "Ir para o fim" no vazio', async ({
        page,
      }) => {
        await login(page, user);
        await page.goto('/pt/chat');
        const root = page.getByTestId('copilot-page');
        await expect(root).toBeVisible();
        await expect(page.getByRole('tab', { name: 'Artefactos' })).toBeHidden();
        await expect(page.getByRole('button', { name: 'Ir para o fim' })).toHaveCount(0);
        await expect(root.getByTestId('copilot-empty-suggestions')).toBeVisible();
        expect(await overflow(page)).toBeLessThanOrEqual(1);
        await shot(page, `pagina-${tag}`);
        await root.getByRole('button', { name: 'Mais opções' }).click();
        await expect(page.getByRole('menuitem', { name: 'Artefactos' })).toBeVisible();
      });
    });
  }
}

test.describe('resposta com gráfico (390×844 escuro)', () => {
  test.use({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
    colorScheme: 'dark',
  });

  test('gráfico a sangrar, legível, sem rolagem horizontal', async ({ page }) => {
    await login(page, user);
    await page.goto('/pt/chat');
    const box = page.getByRole('combobox', { name: 'Pergunta ao copiloto' });
    await box.fill('Mostra um gráfico de barras da recolha por entidade em 2025.');
    await box.press('Enter');
    const chart = page.getByTestId('copilot-chart').first();
    await expect(chart).toBeVisible({ timeout: 120_000 });
    await expect(page.getByTestId('copilot-assistant-message').first()).toHaveAttribute(
      'data-state',
      /complete|error|cancelled/,
      { timeout: 120_000 },
    );
    expect(await overflow(page)).toBeLessThanOrEqual(1);
    const figure = page.getByTestId('copilot-artifact').first();
    expect((await figure.boundingBox())?.width).toBeGreaterThanOrEqual(389);
    await chart.scrollIntoViewIfNeeded();
    await shot(page, 'grafico-390-dark');
  });
});

test.describe('histórico agrupado e desktop', () => {
  test.describe('telemóvel', () => {
    test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

    test('conversas agrupadas por data na folha inferior', async ({ page }) => {
      await login(page, user);
      await page.goto('/pt/chat');
      await page.getByRole('button', { name: 'Conversas' }).click();
      const sheet = page.getByRole('dialog', { name: 'Conversas' });
      await expect(sheet.getByRole('heading', { name: 'Hoje' })).toBeVisible();
      await expect(sheet.getByTestId('copilot-thread-item').first()).toBeVisible();
      await shot(page, 'historico-grupos-390');
    });
  });

  test.describe('desktop', () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test('painel lateral e página com duas colunas', async ({ page }) => {
      await login(page, user);
      await page.goto('/pt/coverage');
      await expect(page.locator('#content h1').first()).toBeVisible();
      await page.keyboard.press('Control+k');
      const panel = page.getByRole('dialog', { name: 'Copiloto Novelo' });
      await expect(panel).toBeVisible();
      await expect(panel.getByTestId('copilot-empty-suggestions').getByRole('button')).toHaveCount(
        3,
      );
      expect((await panel.boundingBox())?.width).toBeLessThan(800);
      await shot(page, 'painel-desktop');
      await page.keyboard.press('Escape');

      await page.goto('/pt/chat');
      await expect(page.getByRole('tab', { name: 'Artefactos' })).toBeVisible();
      await expect(page.getByTestId('copilot-thread-list')).toBeVisible();
      await page.getByTestId('copilot-thread-item').first().getByRole('button').first().click();
      await expect(page.getByTestId('copilot-assistant-message').first()).toBeVisible();
      await shot(page, 'pagina-desktop');
    });
  });
});
