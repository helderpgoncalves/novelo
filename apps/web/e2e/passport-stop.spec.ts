import { expect, test } from '@playwright/test';
import { login } from './helpers';

type Locality = { id: string; name: string; parish_code: string | null };

// O lote nasce na paragem: peso medido na balança da viatura e a paragem (local e freguesia) no passaporte
// público — nunca o doador nem os QR das unidades. #55.
test.describe('passaporte com peso medido e paragem', () => {
  test('lote pesado na paragem mostra «medido» e o local no passaporte', async ({ page }) => {
    await login(page);

    // Um local com freguesia conhecida (os dados da Vitrus têm 82 localidades).
    const localities = (await (
      await page.request.get('/api/v1/network/localities')
    ).json()) as Locality[];
    const locality = localities.find((l) => l.parish_code !== null);
    if (!locality) throw new Error('a base tem de ter localidades com freguesia');

    // «Cheguei»: abre o lote na paragem, pesa um saco (etiqueta impressa com UUID) e «Partir».
    const lot = (await (
      await page.request.post('/api/v1/lots/stops', { data: { locality_id: locality.id } })
    ).json()) as { code: string };
    const unit = (await (
      await page.request.post(`/api/v1/lots/${lot.code}/units`, { data: {} })
    ).json()) as { id: string; code: string };
    expect(
      (
        await page.request.put(`/api/v1/lots/${lot.code}/units/${unit.id}`, {
          data: { weight_g: 4300 },
        })
      ).ok(),
    ).toBeTruthy();
    expect((await page.request.post(`/api/v1/lots/${lot.code}/departure`)).ok()).toBeTruthy();

    // O QR da etiqueta imprime-se (SVG) com o UUID da unidade.
    const qr = await page.request.get(`/api/v1/lots/${lot.code}/units/${unit.id}/qr`);
    expect(qr.headers()['content-type']).toBe('image/svg+xml');

    // Passaporte público, sem sessão: peso medido (4,3 kg — o formatKg corta o zero) e a paragem; nunca o doador nem os QR das unidades.
    const passportBody = (await (
      await page.request.get(`/api/v1/public/lots/${lot.code}`)
    ).json()) as Record<string, unknown>;
    expect(passportBody.weight_kg).toBe(4.3);
    expect(passportBody.weight_source).toBe('measured');
    expect(passportBody.locality_name).toBe(locality.name);
    expect(JSON.stringify(passportBody)).not.toContain('created_by');
    expect(JSON.stringify(passportBody)).not.toContain('donor');
    expect('units' in passportBody).toBe(false);
    expect('unit_list' in passportBody).toBe(false);

    const browser = page.context().browser();
    if (!browser) throw new Error('browser indisponível');
    const anonymous = await browser.newContext();
    const pub = await anonymous.newPage();
    await pub.goto(`/pt/passport/${lot.code}`);
    await expect(pub.getByRole('heading', { level: 1, name: lot.code })).toBeVisible();
    // A paragem: local e freguesia.
    await expect(pub.getByText(locality.name)).toBeVisible();
    // Peso medido com a etiqueta certa (não «estimativa»).
    await expect(pub.getByText('4,3 kg')).toBeVisible();
    await expect(pub.getByText('medido', { exact: true })).toBeVisible();
    await expect(pub.getByText('estimativa', { exact: true })).toBeHidden();
    // A linha do tempo mostra o «Partir».
    await expect(pub.getByText('Partiu da paragem')).toBeVisible();

    // Lote só estimado (caminho antigo): o passaporte diz «estimativa».
    const legacy = (await (
      await page.request.post('/api/v1/lots', { data: { parish_code: null } })
    ).json()) as {
      code: string;
    };
    await pub.goto(`/pt/passport/${legacy.code}`);
    await expect(pub.getByText('estimativa').first()).toBeVisible();
    await anonymous.close();
  });
});
