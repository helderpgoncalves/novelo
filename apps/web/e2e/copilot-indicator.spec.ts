import { expect, type Page, test } from '@playwright/test';
import { ADMIN, login } from './helpers';

// O símbolo da marca a girar tem de se manter enquanto o modelo trabalha (texto a fluir, ferramentas) e só
// desaparecer no fim (done/erro). O gravador corre a cada frame no browser e guarda cada falha.

test.beforeEach(() => test.setTimeout(150_000));

async function record(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as {
      __ind: { frames: number; textFrames: number; missing: number };
    };
    w.__ind = { frames: 0, textFrames: 0, missing: 0 };
    const tick = () => {
      const msg = document.querySelector('[data-testid="copilot-assistant-message"]:last-of-type');
      if (msg && msg.getAttribute('data-state') === 'streaming') {
        w.__ind.frames += 1;
        if (
          (msg.querySelector('[data-testid="copilot-text"], p, ul, ol')?.textContent ?? '').trim()
        )
          w.__ind.textFrames += 1;
        const spin = msg.querySelector(
          '[data-testid="copilot-thinking"] [data-testid="brand-spinner"]',
        );
        if (!spin) w.__ind.missing += 1;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function ask(page: Page, question: string) {
  const box = page.getByRole('combobox', { name: 'Pergunta ao copiloto' });
  await box.fill(question);
  await box.press('Enter');
  await expect(page.getByTestId('copilot-thinking')).toBeVisible();
  const last = page.getByTestId('copilot-assistant-message').last();
  await expect(last).toHaveAttribute('data-state', 'complete', { timeout: 120_000 });
  await page.waitForTimeout(500);
  const stats = await page.evaluate(
    () =>
      (window as unknown as { __ind: { frames: number; textFrames: number; missing: number } })
        .__ind,
  );
  expect(stats.frames).toBeGreaterThan(5);
  expect(stats.textFrames).toBeGreaterThan(2); // houve texto a fluir com o indicador presente
  expect(stats.missing).toBe(0);
  await expect(page.getByTestId('copilot-thinking')).toHaveCount(0);
  await expect(page.getByTestId('brand-spinner')).toHaveCount(0);
}

test('página /chat: o logo a girar persiste durante o streaming e some no fim', async ({
  page,
}) => {
  await login(page, ADMIN);
  await page.goto('/pt/chat');
  await record(page);
  await ask(page, 'Quanto têxtil se recolheu em 2025? Explica em três parágrafos curtos.');
});

test('painel ⌘K: o logo a girar persiste durante o streaming e some no fim', async ({ page }) => {
  await login(page, ADMIN);
  await page.keyboard.press('ControlOrMeta+k');
  await expect(page.getByRole('combobox', { name: 'Pergunta ao copiloto' })).toBeVisible();
  await record(page);
  await ask(page, 'Quantos habitantes tem Guimarães? Explica com contexto.');
});

test.describe('telemóvel 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('o logo a girar persiste e usa movimento reduzido sem rodar', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await login(page, ADMIN);
    await page.goto('/pt/chat');
    await record(page);
    const box = page.getByRole('combobox', { name: 'Pergunta ao copiloto' });
    await box.fill('Quanto têxtil se recolheu em 2025?');
    await box.press('Enter');
    const spin = page.getByTestId('brand-spinner').first();
    await expect(spin).toBeVisible();
    // Lido de novo a cada tentativa: o indicador pode ser remontado quando a resposta começa a chegar e um nó já
    // desligado do DOM devolve estilos vazios.
    await expect
      .poll(() => spin.evaluate((el) => getComputedStyle(el).animationName))
      .toBe('brand-spin-pulse');
    await expect(page.getByTestId('copilot-assistant-message').last()).toHaveAttribute(
      'data-state',
      'complete',
      {
        timeout: 120_000,
      },
    );
    const stats = await page.evaluate(
      () => (window as unknown as { __ind: { missing: number } }).__ind,
    );
    expect(stats.missing).toBe(0);
  });
});
