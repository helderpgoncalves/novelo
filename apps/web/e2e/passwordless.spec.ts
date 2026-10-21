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
  const dialog = page.getByTestId('onboarding-story');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: /Saltar/ }).click();
  await expect(dialog).toHaveCount(0);
};

test.describe('entrada sem palavra-passe', () => {
  test('a entrada mostra primeiro o link por email e a palavra-passe como alternativa', async ({
    page,
  }) => {
    await page.goto('/pt/login');
    await expect(page.getByRole('button', { name: 'Receber link de acesso' })).toBeVisible();
    await expect(page.getByLabel('Palavra-passe', { exact: true })).toHaveCount(0);
    await page.getByRole('link', { name: 'Entrar com palavra-passe' }).click();
    await expect(page).toHaveURL(/method=password/);
    await expect(page.getByLabel('Palavra-passe', { exact: true })).toBeVisible();
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

    // Apresentação: aparece sozinha, mostra números reais da API e fecha.
    const dialog = page.getByTestId('onboarding-story');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('301,3 t')).toBeVisible();
    await expect(dialog.getByText('11,5%')).toBeVisible();
    await page.keyboard.press('End');
    await expect(dialog.getByText(/conta de convidado/i)).toBeVisible();
    await dialog.getByRole('button', { name: 'Concluir' }).click();
    await expect(dialog).toHaveCount(0);

    // Não volta sozinha; volta a pedido.
    await page.reload();
    await expect(page.locator('#content h1').first()).toBeVisible();
    await expect(page.getByTestId('onboarding-story')).toHaveCount(0);
    await page.getByRole('button', { name: 'Menu da conta' }).click();
    await page.getByRole('menuitem', { name: 'Rever a apresentação' }).click();
    await expect(page.getByTestId('onboarding-story')).toBeVisible();
    await page.getByRole('button', { name: /Saltar/ }).click();

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

// O email pode não sair (fornecedor em baixo, endereço bloqueado, demasiados pedidos): o ecrã diz a verdade e dá saídas.
test.describe('verifica o teu email: quando o email não sai', () => {
  const ENTRY = '**/api/v1/auth/magic-link';
  const unavailable = { code: 'email_unavailable', message: 'x', details: null };

  async function requestLink(page: Page, email = 'sem.email@example.pt') {
    await page.goto('/pt/login');
    await page.getByLabel('Email', { exact: true }).fill(email);
    await page.getByRole('button', { name: 'Receber link de acesso' }).click();
    return email;
  }

  test('503 no pedido: ecrã de problema com alternativas, nunca o de sucesso', async ({ page }) => {
    let calls = 0;
    await page.route(ENTRY, (route) => {
      calls += 1;
      if (calls === 1) return route.fulfill({ status: 503, json: unavailable });
      return route.fulfill({ status: 204 });
    });
    const email = await requestLink(page);
    const problem = page.getByTestId('email-problem');
    await expect(problem).toBeVisible();
    await expect(problem).toHaveAttribute('data-kind', 'unavailable');
    await expect(
      page.getByRole('heading', { name: 'Não conseguimos enviar o email' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Verifica o teu email' })).toHaveCount(0);
    await expect(problem).toContainText(email);
    // Saídas: tentar de novo, outro email, palavra-passe e suporte (sem o endereço no HTML).
    await expect(problem.getByRole('button', { name: 'Tentar de novo' })).toBeVisible();
    await expect(problem.getByRole('link', { name: 'Entrar com palavra-passe' })).toBeVisible();
    await expect(problem.getByRole('button', { name: 'Escrever ao suporte' })).toBeVisible();
    expect(await page.content()).not.toContain('novelo@heldergoncalves.io');

    // Tentar de novo: agora sai, e passa ao ecrã de sucesso.
    await problem.getByRole('button', { name: 'Tentar de novo' }).click();
    await expect(page.getByRole('heading', { name: 'Verifica o teu email' })).toBeVisible();
    await expect(page.getByTestId('magic-sent-email')).toHaveText(email);
  });

  test('503 num reenvio troca o ecrã de sucesso pelo de problema', async ({ page }) => {
    await page.clock.install();
    let calls = 0;
    await page.route(ENTRY, (route) => {
      calls += 1;
      if (calls === 1) return route.fulfill({ status: 204 });
      return route.fulfill({ status: 503, json: unavailable });
    });
    await requestLink(page);
    await expect(page.getByRole('heading', { name: 'Verifica o teu email' })).toBeVisible();
    // Texto honesto e a dica do convite.
    await expect(page.getByText(/Pedimos o envio/)).toBeVisible();
    await expect(page.getByText(/Tens um convite\? Usa este mesmo email/)).toBeVisible();
    // A contagem de 30 s: ao fim dela o botão liberta; aqui adiantamos o relógio.
    await expect(page.getByRole('button', { name: /Reenviar em \d+ s/ })).toBeDisabled();
    await page.clock.fastForward(31_000);
    await page.getByRole('button', { name: 'Reenviar link' }).click();
    await expect(page.getByTestId('email-problem')).toBeVisible();
  });

  test('409: endereço bloqueado tem mensagem própria e não oferece repetir', async ({ page }) => {
    await page.route(ENTRY, (route) =>
      route.fulfill({
        status: 409,
        json: { code: 'email_suppressed', message: 'x', details: null },
      }),
    );
    await requestLink(page);
    const problem = page.getByTestId('email-problem');
    await expect(problem).toHaveAttribute('data-kind', 'suppressed');
    await expect(
      page.getByRole('heading', { name: 'Este endereço não recebe os nossos emails' }),
    ).toBeVisible();
    await expect(problem.getByRole('button', { name: 'Tentar de novo' })).toHaveCount(0);
    await expect(problem.getByRole('button', { name: 'Usar outro email' })).toBeVisible();
  });

  test('429 num reenvio avisa e volta a bloquear o botão', async ({ page }) => {
    await page.clock.install();
    let calls = 0;
    await page.route(ENTRY, (route) => {
      calls += 1;
      if (calls === 1) return route.fulfill({ status: 204 });
      return route.fulfill({
        status: 429,
        json: { code: 'rate_limited', message: 'x', details: null },
      });
    });
    await requestLink(page);
    await page.clock.fastForward(31_000);
    await page.getByRole('button', { name: 'Reenviar link' }).click();
    await expect(page.getByText(/emails a mais em pouco tempo/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Reenviar em \d+ s/ })).toBeDisabled();
  });
});

test('recuperar a palavra-passe: 503 mostra o problema e o reenvio tem contagem', async ({
  page,
}) => {
  let calls = 0;
  await page.route('**/api/v1/auth/forgot-password', (route) => {
    calls += 1;
    if (calls === 1) {
      return route.fulfill({
        status: 503,
        json: { code: 'email_unavailable', message: 'x', details: null },
      });
    }
    return route.fulfill({ status: 204 });
  });
  await page.goto('/pt/forgot-password');
  await page.getByLabel('Email da conta').fill('esqueci@example.pt');
  await page.getByRole('button', { name: 'Enviar link de recuperação' }).click();
  await expect(page.getByTestId('email-problem')).toBeVisible();
  // Sem a opção «palavra-passe» (é a que se perdeu).
  await expect(page.getByRole('link', { name: 'Entrar com palavra-passe' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Tentar de novo' }).click();
  await expect(page.getByRole('heading', { name: 'Verifica o teu email' })).toBeVisible();
  await expect(page.getByTestId('magic-sent-email')).toHaveText('esqueci@example.pt');
  await expect(page.getByRole('button', { name: /Reenviar em \d+ s/ })).toBeDisabled();
});

test.describe('administração dos convidados', () => {
  test('o admin vê convidados e o cartaz do QR com o link e o código', async ({ page }) => {
    const email = uniqueEmail('lista');
    await joinByQr(page, 'Convidada Lista', email);
    await expect(page).toHaveURL(/\/pt\/?$/);
    await page.context().clearCookies();

    await login(page);
    await page.goto('/pt/users?tab=invitations');
    await expect(page.getByRole('table').getByText(email)).toBeVisible();

    await page.getByRole('button', { name: 'Cartaz do QR' }).click();
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
