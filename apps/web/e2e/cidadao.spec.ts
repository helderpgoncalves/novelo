import { expect, type Page, test } from '@playwright/test';
import { deleteByEmail, lastEmail, linkFrom, uniqueEmail } from './helpers';

// A área do cidadão «/cidadao» (bilhete #63): conta de doador por magic link com 13 anos,
// sacos ativados com apelido privado e declaração «Vai no saco?», saldo só leitura,
// histórico ligado ao passaporte, e a página pública «onde e quando entrego».

test.describe('página pública «onde e quando entrego»', () => {
  test('abre sem sessão e mostra o estado da agenda', async ({ page }) => {
    await page.goto('/pt/onde-quando');
    await expect(
      page.getByRole('heading', { name: /sai à rua no dia da tua freguesia/i }),
    ).toBeVisible();
    // A agenda pode existir ou não (dado introduzido): um dos dois estados é sempre honesto.
    await expect(page.getByText('Dias da ronda')).toBeVisible();
    await expect(page.getByText('Como entregar')).toBeVisible();
    // Link para a carteira visível e tocável (alvo ≥ 40 px).
    await expect(page.getByRole('link', { name: 'A minha carteira' })).toBeVisible();
  });

  test('o herói público da /cidadao aponta para a agenda e para a criação de conta', async ({
    page,
  }) => {
    await page.goto('/pt/cidadao');
    await expect(page.getByRole('heading', { name: /A tua roupa velha vale algo/i })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel(/Que idade tens/i)).toBeVisible();
  });
});

test.describe('conta de doador: magic link com 13+', () => {
  test('idade abaixo de 13 é recusada com mensagem clara', async ({ page }) => {
    await page.goto('/pt/cidadao');
    await page.getByLabel('Email').fill(uniqueEmail('pequeno'));
    await page.getByLabel(/Que idade tens/i).fill('12');
    await page.getByRole('button', { name: 'Entrar com email' }).click();
    await expect(page.getByRole('alert')).toContainText('13 anos ou mais');
    // Continua na porta de entrada (sem ecrã de «abre o email»).
    await expect(page.getByRole('button', { name: 'Entrar com email' })).toBeVisible();
  });

  test('13 anos cria a conta: o magic link abre a carteira', async ({ page }) => {
    const email = uniqueEmail('doador');
    await page.goto('/pt/cidadao');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel(/Que idade tens/i).fill('13');
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Entrar com email' }).click();
    await expect(page.getByText('Abre o teu email')).toBeVisible();

    const mail = await lastEmail(email);
    const link = linkFrom(mail.text);
    expect(link).toContain('/magic-link?token=');
    await page.goto(link);
    // Depois de verificar o email, a sessão de doador cai na carteira (redirect do `next`).
    await expect(page).toHaveURL(/\/pt\/cidadao/);
    await expect(page.getByText('Começa por aqui')).toBeVisible(); // onboarding de marcos
    await expect(page.getByText('Saldo (estimativa)')).toBeVisible();
  });
});

test.describe('carteira do doador', () => {
  // Telemóvel primeiro (aceitação do bilhete): a carteira corre sempre num viewport de telemóvel.
  test.use({ viewport: { width: 390, height: 844 } });

  test('ativar saco com apelido privado e declaração; QR e desativar', async ({ page }) => {
    const email = uniqueEmail('sacos');
    const donor = await createDonorSession(page, email);
    await donor.goto('/pt/cidadao?tab=sacos');
    await donor.getByRole('button', { name: 'Ativar saco' }).first().click();
    await donor.getByLabel('Apelido (opcional, só teu)').fill('Saco da cozinha');
    await donor.getByLabel('«Vai no saco?» (opcional)').selectOption('reuse');
    await donor.getByRole('button', { name: 'Ativar', exact: true }).click();
    await expect(donor.getByText(/Saco NVL-.* ativado/)).toBeVisible();
    await expect(donor.getByText('Saco da cozinha')).toBeVisible();
    await expect(donor.getByText('conteúdo declarado')).toBeVisible();

    // O QR do saco abre numa folha inferior com o código.
    await donor.getByRole('button', { name: 'QR', exact: true }).first().click();
    await expect(donor.getByRole('img', { name: /QR do saco NVL-/ })).toBeVisible();
    await donor.keyboard.press('Escape');

    // Desativar congela o saco.
    await donor.getByRole('button', { name: 'Desativar' }).first().click();
    await expect(donor.getByText('desativado').first()).toBeVisible();
  });

  test('saldo é só leitura e histórico está vazio na conta nova', async ({ page }) => {
    const email = uniqueEmail('saldo');
    const donor = await createDonorSession(page, email);
    await donor.goto('/pt/cidadao?tab=saldo');
    await expect(donor.getByText('pontos · só leitura')).toBeVisible();
    await expect(donor.getByText('Como vai funcionar')).toBeVisible();
    await donor.goto('/pt/cidadao?tab=historico');
    await expect(donor.getByText(/Ainda sem recolhas/)).toBeVisible();
  });

  test('home por papel: o doador nunca cai na app de equipa', async ({ page }) => {
    const email = uniqueEmail('home');
    const donor = await createDonorSession(page, email);
    await donor.goto('/pt/');
    await expect(donor).toHaveURL(/\/pt\/cidadao/);
    await donor.goto('/pt/simulator');
    await expect(donor).toHaveURL(/\/pt\/cidadao/);
  });
});

/** Cria um doador pela porta real (formulário + magic link) e devolve a página com sessão iniciada. */
async function createDonorSession(page: Page, email: string): Promise<Page> {
  await deleteByEmail(email);
  await page.goto('/pt/cidadao');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel(/Que idade tens/i).fill('34');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Entrar com email' }).click();
  await expect(page.getByText('Abre o teu email')).toBeVisible();
  const mail = await lastEmail(email);
  await page.goto(linkFrom(mail.text));
  await expect(page).toHaveURL(/\/pt\/cidadao/);
  await expect(page.getByText('Começa por aqui')).toBeVisible();
  return page;
}
