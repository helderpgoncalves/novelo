import { expect, type Page, test } from '@playwright/test';
import { createApprovedUser, deleteByEmail, login, uniqueEmail } from './helpers';

// Apresentação de primeira visita: seis passos com os números da API, teclado, saltar e rever pelo menu da conta.
// Nunca abre sozinha nos outros testes (o administrador e as contas criadas pela API entram por palavra-passe, sem o
// sinal de registo); aqui o teste pede-a com o mesmo sinal que o formulário de registo deixa.
const SHOTS = process.env.E2E_SHOTS;

const askForStory = (page: Page) =>
  page.addInitScript(() => window.sessionStorage.setItem('novelo.tour.pending', '1'));

test.describe('apresentação de primeira visita', () => {
  test.describe.configure({ timeout: 90_000 });

  test('abre na primeira entrada, navega por teclado, salta e reabre pelo menu', async ({
    page,
  }) => {
    const email = uniqueEmail('apresentacao');
    try {
      const account = await createApprovedUser(email, { name: 'Júri Teste' });
      await askForStory(page);
      await login(page, account);

      const story = page.getByTestId('onboarding-story');
      await expect(story).toBeVisible();
      await expect(story.getByRole('heading', { level: 2 })).toContainText(
        'de têxtil por ano ainda vão para o lixo em Guimarães',
      );
      await expect(story).toContainText('01 / 06');
      // Números da API (o resumo de 2025), nunca escritos à mão.
      await expect(story).toContainText('301,3 t');
      await expect(story).toContainText('11,5%');
      await expect(story).toContainText('17 abr 2028');
      // O foco fica no diálogo, no botão principal.
      await expect(story.getByRole('button', { name: 'Seguinte' })).toBeFocused();
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/e2e-story-1.png` });

      await page.keyboard.press('ArrowRight');
      await expect(story).toContainText('02 / 06');
      await expect(story.getByRole('heading', { level: 2 })).toHaveText(
        'Em todo o concelho, no lixo de todos os dias.',
      );
      await expect(story.getByRole('img', { name: /Mapa de Guimarães/ })).toBeVisible();

      await page.keyboard.press('ArrowRight');
      await expect(story).toContainText('03 / 06');
      await expect(story.getByRole('heading', { level: 2 })).toHaveText(
        'Sem contentores de têxtil.',
      );
      await expect(story).toContainText('A Vitrus não quer contentores de têxtil');
      // O plano vem do cenário de referência (ou diz que ainda está a calcular).
      await expect(
        story.getByText(
          /Saco fechado no circuito porta a porta|O plano ainda está a ser calculado/,
        ),
      ).toBeVisible({ timeout: 20_000 });

      await page.keyboard.press('ArrowLeft');
      await expect(story).toContainText('02 / 06');
      await page.keyboard.press('End');
      await expect(story).toContainText('06 / 06');
      await expect(story.getByRole('button', { name: 'Ver o plano' })).toBeVisible();
      await expect(story.getByRole('button', { name: 'Simular a rede' })).toBeVisible();
      await expect(story.getByRole('button', { name: 'Ver o piloto' })).toBeVisible();
      await page.keyboard.press('Home');
      await expect(story).toContainText('01 / 06');

      // Esc salta (e marca como vista na API): não volta a abrir sozinha.
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Escape');
      await expect(story).toHaveCount(0);
      await page.reload();
      await expect(page.locator('#content h1').first()).toBeVisible();
      await page.waitForTimeout(1_200);
      await expect(story).toHaveCount(0);

      // Retomável e revisível pelo menu da conta.
      await page.getByRole('button', { name: 'Menu da conta' }).click();
      await expect(page.getByRole('menuitem', { name: 'Retomar a apresentação' })).toBeVisible();
      await page.getByRole('menuitem', { name: 'Rever a apresentação' }).click();
      await expect(story).toBeVisible();
      await expect(story).toContainText('01 / 06');
      await story.getByRole('button', { name: /Saltar/ }).click();
      await expect(story).toHaveCount(0);
      // O foco volta à página (ao botão do menu), não se perde.
      await expect(page.getByRole('button', { name: 'Menu da conta' })).toBeFocused();
    } finally {
      await deleteByEmail(email);
    }
  });

  test('o último passo leva ao plano no Ponto de partida', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: 'Menu da conta' }).click();
    await page.getByRole('menuitem', { name: 'Rever a apresentação' }).click();
    const story = page.getByTestId('onboarding-story');
    await expect(story).toBeVisible();
    // Navegação direta pela coluna dos passos (ecrã largo).
    await story
      .getByRole('navigation', { name: 'Passos da apresentação' })
      .getByRole('button', { name: /O próximo passo/ })
      .click();
    await expect(story).toContainText('06 / 06');
    await expect(story.getByText('O que mede')).toBeVisible({ timeout: 20_000 });
    await story.getByRole('button', { name: 'Ver o plano' }).click();
    await expect(story).toHaveCount(0);
    await expect(page).toHaveURL(/#plano$/);
  });
});
