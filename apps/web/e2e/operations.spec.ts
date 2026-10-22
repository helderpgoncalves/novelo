import { expect, test } from '@playwright/test';
import { login } from './helpers';

const ITEM = {
  garment_type: 'jumper',
  condition: 'reuse',
  composition: [
    { fibre: 'wool', pct: 80 },
    { fibre: 'polyester', pct: 20 },
  ],
  brand: 'Zara',
  estimated_weight_g: 400,
  confidence: 0.9,
};

test.describe('lotes, passaporte, bolsa e marcas', () => {
  test('ciclo completo do lote até à reserva do reciclador', async ({ page }) => {
    await login(page);
    // A triagem por foto precisa do modelo; aqui prepara-se o lote pela API e testa-se tudo o que vem a seguir.
    const lot = (await (
      await page.request.post('/api/v1/lots', { data: { parish_code: null } })
    ).json()) as { code: string };
    for (const item of [
      ITEM,
      {
        ...ITEM,
        garment_type: 'tshirt',
        composition: [{ fibre: 'cotton', pct: 100 }],
        estimated_weight_g: 150,
      },
    ]) {
      expect(
        (await page.request.post(`/api/v1/lots/${lot.code}/items`, { data: item })).ok(),
      ).toBeTruthy();
    }

    await page.goto(`/pt/lots/${lot.code}`);
    await expect(page.getByRole('heading', { level: 1, name: lot.code })).toBeVisible();
    await expect(page.getByRole('img', { name: `QR do lote ${lot.code}` })).toBeVisible();
    await page.getByRole('button', { name: 'Fechar lote' }).click();
    await expect(page.getByText('Estado do lote atualizado')).toBeVisible();

    // «Imprimir etiqueta»: na impressão fica a etiqueta (QR, código e resumo) e sai o resto da página.
    await page.emulateMedia({ media: 'print' });
    await expect(page.getByRole('img', { name: `QR do lote ${lot.code}` })).toBeVisible();
    await expect(page.getByText('2 peças · 0,55 kg')).toBeVisible();
    await expect(page.getByRole('tab', { name: /Peças do lote/ })).toBeHidden();
    await page.emulateMedia({ media: 'screen' });
    // O QR traz fundo branco: lê-se também no tema escuro.
    const qr = await page.request.get(`/api/v1/public/lots/${lot.code}/qr`);
    expect(await qr.text()).toContain('fill="#fff"');

    // Passaporte público: abre sem sessão.
    const browser = page.context().browser();
    if (!browser) throw new Error('browser indisponível');
    const anonymous = await browser.newContext();
    const pub = await anonymous.newPage();
    await pub.goto(`/pt/passport/${lot.code}`);
    await expect(pub.getByRole('heading', { level: 1, name: lot.code })).toBeVisible();
    await expect(pub.getByText('Marcas mais frequentes')).toBeVisible();
    await expect(pub.getByText('Zara (')).toBeVisible();
    // Mesmo peso que a página do lote (0,55 kg, nunca 0,6 kg) e marcado como estimativa.
    await expect(pub.getByText('0,55 kg')).toBeVisible();
    await expect(pub.getByText('estimativa')).toBeVisible();
    await anonymous.close();

    // Bolsa de fibra: reservar.
    await page.goto('/pt/lots?tab=market');
    const card = page.getByRole('listitem').filter({ hasText: lot.code });
    await card.getByRole('button', { name: 'Reservar' }).click();
    await page.getByLabel(/Destino/).fill('Têxtil do Ave, Lda');
    await page.getByLabel('Contacto').fill('geral@textildoave.pt');
    await page.getByRole('dialog').getByRole('button', { name: 'Reservar' }).click();
    await expect(page.getByText('Lote reservado')).toBeVisible();
    await expect(card.getByText('Reservado').first()).toBeVisible();

    // Marcas: evidência com tamanho da amostra.
    await page.getByRole('tab', { name: /Evidência por marca/ }).click();
    await expect(page).toHaveURL(/tab=brands/);
    await expect(page.getByRole('row', { name: /Zara/ })).toBeVisible();
    // O aviso de amostra pequena aparece só abaixo de 30 peças (a base de dev acumula as triagens de cada corrida).
    const { sample_items } = (await (await page.request.get('/api/v1/brands')).json()) as {
      sample_items: number;
    };
    const warning = page.getByText(/menos de 30 peças/);
    if (sample_items < 30) await expect(warning).toBeVisible();
    else await expect(warning).toBeHidden();
  });

  test('triagem sem modelo mostra o estado e deixa abrir lotes', async ({ page }) => {
    await login(page);
    await page.goto('/pt/triage');
    await expect(page.getByRole('heading', { level: 1, name: 'Triagem de peças' })).toBeVisible();
    // Se já há lotes abertos, o ecrã continua o primeiro; senão pede a freguesia e abre um novo.
    const openLot = page.getByRole('button', { name: 'Abrir lote' });
    await expect(openLot.or(page.getByText('Lote atual'))).toBeVisible();
    if (await openLot.isVisible()) await openLot.click();
    await expect(page.getByText('Lote atual')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Analisar peça' })).toBeDisabled();
  });
});
