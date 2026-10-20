import { expect, type Page, test } from '@playwright/test';
import { lastEmail, linkFrom, login, uniqueEmail } from './helpers';

// Entrada sem palavra-passe: link por email (por omissão) e QR do evento (`/join?c=<código>`).
// O código de dev é `novelo-dev` e o email vê-se na caixa de saída de desenvolvimento (EMAIL_TRANSPORT=log).
const CODE = process.env.E2E_QUICK_JOIN_CODE ?? 'novelo-dev';

async function joinByQr(page: Page, name: string, email: string, code = CODE) {
  await page.goto(`/pt/join?c=${code}`);
  await page.getByLabel('Nome', { exact: true }).fill(name);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
}

const skipTour = async (page: Page) => {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Saltar' }).click();
  await expect(dialog).toHaveCount(0);
};

test.describe('entrada sem palavra-passe', () => {
  test('a entrada mostra primeiro o link por email e a palavra-passe como alternativa', async ({
    page,
  }) => {
    await page.goto('/pt/login');
    await expect(page.getByRole('button', { name: 'Receber link de acesso' })).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toHaveCount(0);
    await page.getByRole('link', { name: 'Entrar com palavra-passe' }).click();
    await expect(page).toHaveURL(/method=password/);
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Receber link por email' }).click();
    await expect(page.getByRole('button', { name: 'Receber link de acesso' })).toBeVisible();
  });

  test('email inválido é explicado antes de enviar nada', async ({ page }) => {
    await page.goto('/pt/login');
    await page.getByLabel('Email', { exact: true }).fill('isto-nao-e-email');
    await page.getByRole('button', { name: 'Receber link de acesso' }).click();
    await expect(page.getByText('Email inválido')).toBeVisible();
  });

  test('QR feliz: nome e email chegam, convidado fica dentro, vê a visita e não vê administração', async ({
    page,
  }) => {
    const email = uniqueEmail('qr');
    await joinByQr(page, 'Rita Júri', email);
    await expect(page.getByTestId('join-welcome')).toContainText('Rita');
    await expect(page).toHaveURL(/\/pt\/?$/);

    // Visita guiada: aparece sozinha, mostra números reais e fecha.
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('1,92 kg')).toBeVisible();
    await expect(dialog.getByText('4,27 kg')).toBeVisible();
    await dialog.getByRole('button', { name: 'Seguinte' }).click();
    await dialog.getByRole('button', { name: 'Seguinte' }).click();
    await dialog.getByRole('button', { name: 'Seguinte' }).click();
    await expect(dialog.getByText(/conta de convidado/i)).toBeVisible();
    await dialog.getByRole('button', { name: 'Explorar sozinho' }).click();
    await expect(dialog).toHaveCount(0);

    // Não volta sozinha; volta a pedido.
    await page.reload();
    await expect(page.locator('#content h1').first()).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Menu da conta' }).click();
    await page.getByRole('menuitem', { name: 'Ver visita guiada' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Saltar' }).click();

    // Sem administração: nada na navegação e o URL direto explica porquê.
    await expect(page.getByRole('link', { name: 'Utilizadores' })).toHaveCount(0);
    await page.goto('/pt/users');
    await expect(page.getByText(/conta de convidado/i).first()).toBeVisible();
  });

  test('QR com código errado explica e oferece a entrada normal', async ({ page }) => {
    await joinByQr(page, 'Ana Teste', uniqueEmail('errado'), 'codigo-errado');
    await expect(page.getByRole('heading', { name: 'Este QR já não é válido' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ir para a entrada' })).toBeVisible();
  });

  test('QR sem código explica o que falta', async ({ page }) => {
    await page.goto('/pt/join');
    await expect(page.getByRole('heading', { name: 'Falta o código do QR' })).toBeVisible();
  });

  test('QR com o consentimento por dar não envia', async ({ page }) => {
    await page.goto(`/pt/join?c=${CODE}`);
    await page.getByLabel('Nome', { exact: true }).fill('Sem Consentimento');
    await page.getByLabel('Email', { exact: true }).fill(uniqueEmail('semconsent'));
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await expect(page.getByText('Aceita para poderes entrar.')).toBeVisible();
  });

  test('QR com email que já tem conta não inicia sessão: envia o link', async ({ page }) => {
    const email = uniqueEmail('repetido');
    await joinByQr(page, 'Primeira Vez', email);
    await expect(page).toHaveURL(/\/pt\/?$/);
    await page.context().clearCookies();

    await joinByQr(page, 'Outra Pessoa', email);
    await expect(page.getByRole('heading', { name: 'Já tens conta' })).toBeVisible();
    await expect(page.getByTestId('magic-sent-email')).toHaveText(email);
    // Não ficou com sessão: a app continua a pedir entrada.
    await page.goto('/pt/circuits');
    await expect(page).toHaveURL(/\/pt\/login/);
  });

  test('link por email: pedir, abrir, entrar no destino e não reutilizar', async ({ page }) => {
    const email = uniqueEmail('link');
    // Cria a conta por QR e sai.
    await joinByQr(page, 'Link Teste', email);
    await expect(page).toHaveURL(/\/pt\/?$/);
    await skipTour(page);
    await page.getByRole('button', { name: 'Menu da conta' }).click();
    await page.getByRole('menuitem', { name: 'Terminar sessão' }).click();
    await expect(page).toHaveURL(/\/pt\/login/);

    await page.goto('/pt/login?next=%2Fscenarios');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByRole('button', { name: 'Receber link de acesso' }).click();
    await expect(page.getByRole('heading', { name: 'Verifica o teu email' })).toBeVisible();
    await expect(page.getByTestId('magic-sent-email')).toHaveText(email);
    await expect(page.getByRole('button', { name: /Reenviar em \d+ s/ })).toBeDisabled();

    // O email mais recente é o do link (o de boas-vindas é anterior).
    let mail = await lastEmail(email);
    for (let i = 0; i < 20 && !/magic-link\?token=/.test(mail.text); i++) {
      await page.waitForTimeout(250);
      mail = await lastEmail(email);
    }
    const link = linkFrom(mail.text);
    expect(link).toContain('/magic-link?token=');

    await page.goto(link);
    await expect(page).toHaveURL(/\/pt\/scenarios/);
    await expect(page).not.toHaveURL(/token=/);
    await expect(page.locator('#content h1').first()).toBeVisible();

    // Já usado: explica e oferece novo link para o email conhecido.
    await page.getByRole('button', { name: 'Menu da conta' }).click();
    await page.getByRole('menuitem', { name: 'Terminar sessão' }).click();
    await page.goto(link);
    await expect(page.getByRole('heading', { name: 'Este link já não funciona' })).toBeVisible();
    await expect(
      page.getByRole('button', { name: `Enviar novo link para ${email}` }),
    ).toBeVisible();
  });

  test('link inventado ou incompleto não deixa entrar', async ({ page }) => {
    await page.goto('/pt/magic-link?token=inventado-inventado-inventado-1234567890');
    await expect(page.getByRole('heading', { name: 'Este link já não funciona' })).toBeVisible();
    await expect(page).not.toHaveURL(/token=/);
    await page.goto('/pt/magic-link');
    await expect(page.getByRole('heading', { name: 'Este link já não funciona' })).toBeVisible();
  });
});

test.describe('administração dos convidados', () => {
  test('o admin vê convidados e o cartaz do QR com o link e o código', async ({ page }) => {
    const email = uniqueEmail('lista');
    await joinByQr(page, 'Convidada Lista', email);
    await expect(page).toHaveURL(/\/pt\/?$/);
    await page.context().clearCookies();

    await login(page);
    await page.goto('/pt/users?tab=guests');
    await expect(page.getByRole('table').getByText(email)).toBeVisible();

    await page.getByRole('tab', { name: /Cartaz do QR/ }).click();
    await expect(page).toHaveURL(/tab=poster/);
    await expect(page.getByTestId('event-poster')).toBeVisible();
    await expect(page.getByText('Lê o QR, escreve o teu nome e email, e entras.')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Código do evento' })).toHaveValue(CODE);
    await expect(page.getByRole('textbox', { name: 'Link de entrada' })).toHaveValue(/\/join\?c=/);
    await expect(page.getByRole('button', { name: 'Imprimir' })).toBeEnabled();
    await expect(page.getByRole('link', { name: 'Descarregar SVG' })).toHaveAttribute(
      'download',
      'novelo-qr.svg',
    );
  });
});
