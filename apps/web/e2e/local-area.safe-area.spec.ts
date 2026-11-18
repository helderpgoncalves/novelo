import { expect, type Page, test } from '@playwright/test';
import { adminApi, deleteByEmail, login, PASSWORD, uniqueEmail } from './helpers';

type Locality = { id: string; name: string; parish_code: string | null };

/** A equipa convida uma conta de local (papel `local` + local + natureza) e devolve o link do convite. */
async function inviteLocal(email: string, kind: 'assistido' | 'b2b' = 'assistido') {
  const api = await adminApi();
  try {
    const localities = (await (await api.get('/api/v1/network/localities')).json()) as Locality[];
    const locality = localities[0];
    if (!locality) throw new Error('a base tem de ter localidades');
    const invitation = await api.post('/api/v1/users/invitations', {
      data: { email, role: 'local', locality_id: locality.id, local_kind: kind },
    });
    expect(invitation.ok(), 'convite de local').toBeTruthy();
    const link = await api.post(
      `/api/v1/users/invitations/${((await invitation.json()) as { id: string }).id}/link`,
    );
    expect(link.ok(), 'link do convite').toBeTruthy();
    const url = ((await link.json()) as { url: string }).url;
    return { url, locality };
  } finally {
    await api.dispose();
  }
}

/** Aceita o convite (a API cria a conta com password) para o login por formulário funcionar. */
async function acceptInvitation(url: string) {
  const token = new URL(url).searchParams.get('token');
  expect(token, 'token do convite').toBeTruthy();
  const api = await adminApi();
  try {
    const accepted = await api.post('/api/v1/auth/invitations/accept', {
      data: { token, name: 'Direção de Teste', password: PASSWORD },
    });
    expect(accepted.ok(), 'aceitar o convite').toBeTruthy();
  } finally {
    await api.dispose();
  }
}

/** O login da conta de local: entra e a home manda para /local (a conta pertence ao local, nunca à equipa). */
async function loginLocal(page: Page, email: string) {
  await page.goto('/pt/login?method=password');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Palavra-passe', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.waitForURL(/\/pt\/local/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

// O fluxo do local, telemóvel primeiro (este ficheiro corre só no projeto `mobile`, Pixel 7). #59.
test.describe('conta de local: «Duas portas»', () => {
  let email: string;

  test.beforeEach(() => {
    email = uniqueEmail('local');
  });

  test.afterEach(async () => {
    await deleteByEmail(email);
  });

  test('aviso «sacos prontos», rondas com peso medido e certificado opt-in', async ({ page }) => {
    const { url, locality } = await inviteLocal(email);
    await acceptInvitation(url);
    await loginLocal(page, email);

    // A home do local: o sítio no cabeçalho e o herói com o aviso por dar.
    await expect(page.getByRole('heading', { name: locality.name })).toBeVisible();
    // A localidade é partilhada entre corridas: anular um aviso que tenha ficado ativo antes de começar.
    const hero = page.getByRole('button', { name: /Tem sacos prontos\?|Aviso enviado/ }).first();
    if ((await hero.textContent())?.includes('Aviso enviado')) {
      await hero.click();
      await page.getByRole('button', { name: 'Anular aviso' }).click();
      await expect(page.getByRole('button', { name: /Tem sacos prontos\?/ })).toBeVisible();
    }
    await expect(page.getByText('Tem sacos prontos?')).toBeVisible();

    // Porta 1 — a única escrita: avisar com 3 sacos e ver o ativo.
    await page.getByRole('button', { name: /Tem sacos prontos\?/ }).click();
    await expect(page.getByRole('heading', { name: 'Avisar sacos prontos' })).toBeVisible();
    const bags = page.getByLabel('Número de sacos');
    await expect(bags).toHaveValue('2'); // o protótipo começa em 2
    await page.getByRole('button', { name: 'Mais um saco' }).click();
    await page
      .getByPlaceholder('Nota para a equipa (opcional) — ex.: sala 12, porta dos fundos')
      .fill('sala 12');
    await page.getByRole('button', { name: 'Avisar a viatura' }).click();
    await expect(page.getByText('Aviso enviado — sacos prontos')).toBeVisible();

    // Reabrir: o herói mostra o ativo e a folha traz «Anular».
    await page.getByRole('button', { name: /Aviso enviado — sacos prontos/ }).click();
    await expect(page.getByText('Aviso ativo')).toBeVisible();
    await expect(page.getByText('3 sacos prontos')).toBeVisible();
    await page.keyboard.press('Escape');

    // Porta 2 — leitura: sem paragens o vazio diz-o sem inventar números; a localidade é partilhada
    // entre corridas, por isso aceita-se também o histórico de paragens já escrito.
    await page.getByRole('button', { name: /As nossas rondas/ }).click();
    const vazio = page.getByText(/Ainda não há paragens neste local/);
    const paragem = page.locator('li a[href^="/passport/"]').first();
    await expect(vazio.or(paragem)).toBeVisible();
    await page.keyboard.press('Escape');

    // Porta 3 — certificado opt-in: desligado não há página; ligado, a página pública existe.
    const accountId = await page.evaluate(async () => {
      const res = await fetch('/api/v1/local/account');
      return ((await res.json()) as { id: string }).id;
    });
    const certUrl = `/pt/certificado/${accountId}`;
    // O 404 afirma-se na API (a SPA do web responde 200 a qualquer rota com o seu invólucro).
    const status = await page.evaluate(async (id) => {
      const res = await fetch(`/api/v1/public/locals/${id}/certificate`);
      return res.status;
    }, accountId);
    expect(status).toBe(404);

    await page.getByRole('button', { name: /Certificado público/ }).click();
    await expect(page.getByRole('dialog').getByText('Desligado — nada é público')).toBeVisible();
    await page.getByRole('switch', { name: 'Publicar certificado' }).click();
    await expect(page.getByText(/Certificado de recolha · rede Novelo/)).toBeVisible();
    await page.keyboard.press('Escape');

    // A página pública (nova página, sem sessão não é preciso: é pública) mostra os kg agregados.
    const pub = page.context().request;
    const res = await pub.get(certUrl);
    expect(res.ok(), 'certificado público depois do opt-in').toBeTruthy();
    await page.goto(certUrl);
    await expect(page.getByText('Certificado de recolha · rede Novelo')).toBeVisible();
    await expect(page.getByText(/Sem dados de doadores/)).toBeVisible();
  });

  test('uma paragem pesada aparece nas rondas com «medido»', async ({ page }) => {
    const { url, locality } = await inviteLocal(email);
    const api = await adminApi();
    try {
      await acceptInvitation(url);
      // A viatura passa: um lote na paragem do local, um saco pesado na balança (o mesmo do e2e do #55).
      const lot = (await (
        await api.post('/api/v1/lots/stops', { data: { locality_id: locality.id } })
      ).json()) as { code: string };
      const unit = (await (
        await api.post(`/api/v1/lots/${lot.code}/units`, { data: {} })
      ).json()) as {
        id: string;
      };
      expect(
        (
          await api.put(`/api/v1/lots/${lot.code}/units/${unit.id}`, { data: { weight_g: 4300 } })
        ).ok(),
      ).toBeTruthy();

      await loginLocal(page, email);
      await page.getByRole('button', { name: /As nossas rondas/ }).click();
      // O peso é o medido (4,3 kg — o formatKg corta o zero final), com «medido» — nunca «estimativa».
      // A linha do lote é a âncora: a localidade acumula paragens de corridas anteriores.
      const row = page.locator('li', { hasText: lot.code });
      await expect(row).toBeVisible();
      await expect(row.getByText(/4,3 kg/)).toBeVisible();
      await expect(row.getByText('(medido)')).toBeVisible();
    } finally {
      await api.dispose();
    }
  });

  test('quem não é local não entra: a equipa vai para a home, hóspede vai para o login', async ({
    page,
  }) => {
    await login(page); // admin
    await page.goto('/pt/local');
    // A equipa não vê a área do local (apoio é por impersonação, não por entrar aqui).
    await expect(page).toHaveURL(/\/pt\/?$/);
    await page.context().clearCookies();
    await page.goto('/pt/local');
    await expect(page).toHaveURL(/\/login/);
  });
});
