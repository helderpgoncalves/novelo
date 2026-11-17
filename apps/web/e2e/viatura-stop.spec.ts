import { expect, type Page, test } from '@playwright/test';
import { login } from './helpers';

type Locality = { id: string; name: string; parish_code: string | null };

/** Pesos programados do balança falso (a porta `device/port.ts`): 2 600 g e 3 800 g → lote de 6,40 kg. */
const FAKE_PROGRAM = [2_600, 3_800];

async function armFakeDevice(page: Page) {
  await page.addInitScript((program) => {
    localStorage.setItem('novelo-viatura-fake-weights', JSON.stringify(program));
  }, FAKE_PROGRAM);
}

// O ecrã da paragem da viatura (#58): «Cheguei» → scan (o QR do saco, ou etiqueta impressa no dispositivo
// falso) → pratos ≤ 15 kg (a app soma) → «Partir». O peso medido sai no passaporte público como «medido».
test.describe('paragem da viatura com o dispositivo falso', () => {
  test('scan, pesar com o falso, etiqueta sem QR e «Partir» fecham o lote no passaporte', async ({
    page,
  }) => {
    await armFakeDevice(page);
    await login(page);

    // Um local com freguesia (os dados da Vitrus têm 82 localidades).
    const localities = (await (
      await page.request.get('/api/v1/network/localities')
    ).json()) as Locality[];
    const locality = localities.find((l) => l.parish_code !== null);
    if (!locality) throw new Error('a base tem de ter localidades com freguesia');

    await page.goto('/pt/viatura');

    // «Cheguei»: escolher o local e abrir a paragem (um lote por paragem).
    await page.getByLabel('Local da paragem').selectOption({ value: locality.id });
    await page.getByRole('button', { name: /Cheguei/ }).click();
    await expect(page.getByText('Escanear o saco')).toBeVisible();

    // 1.º saco: QR lido (leitura manual da câmara/HID no desktop) e peso do balança falso.
    await page.getByLabel('Ou escreve o código lido').fill('NOV-E2E-SACO-1');
    await page.getByRole('button', { name: 'Registar saco' }).click();
    await expect(page.getByText('NOV-E2E-SACO-1')).toBeVisible();

    await page.getByRole('button', { name: 'Pesar' }).first().click();
    await page.getByRole('button', { name: 'Ler a balança' }).click();
    // O falso lê 2 600 g → o peso confirma-se somado na app.
    await expect(page.getByText('2,60 kg').first()).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar peso do saco' }).click();
    await expect(page.getByRole('button', { name: 'Pesar' })).toBeVisible();

    // 2.º saco sem QR: a etiqueta imprime-se sozinha no dispositivo falso («etiqueta impressa»).
    await page.getByRole('button', { name: 'Saco sem QR: imprimir etiqueta' }).click();
    await expect(page.getByText('etiqueta impressa')).toBeVisible();

    await page.getByRole('button', { name: 'Pesar' }).first().click();
    await page.getByRole('button', { name: 'Ler a balança' }).click();
    await expect(page.getByText('3,80 kg')).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar peso do saco' }).click();

    // Total sempre visível: 2 600 + 3 800 = 6 400 g.
    await expect(page.getByText('6,40 kg').first()).toBeVisible();

    // «Partir»: o único gesto deliberado fecha a paragem (exige todos os sacos pesados).
    await page.getByRole('button', { name: /^Partir/ }).click();
    await expect(page.getByText('O lote segue para a mesa de triagem')).toBeVisible();
    await expect(page.getByText('Tudo sincronizado')).toBeVisible();

    // O passaporte público leva o peso medido (não a estimativa).
    await page.getByRole('link', { name: 'Abrir o passaporte do lote' }).click();
    await expect(page.getByText('medido', { exact: true })).toBeVisible();
    await expect(page.getByText('6,40 kg')).toBeVisible();
    await expect(page.getByText(locality.name).first()).toBeVisible();
  });

  test('saco por pesar trava o «Partir» (a API recusaria)', async ({ page }) => {
    await armFakeDevice(page);
    await login(page);

    const localities = (await (
      await page.request.get('/api/v1/network/localities')
    ).json()) as Locality[];
    const locality = localities.find((l) => l.parish_code !== null);
    if (!locality) throw new Error('a base tem de ter localidades com freguesia');

    await page.goto('/pt/viatura');
    await page.getByLabel('Local da paragem').selectOption({ value: locality.id });
    await page.getByRole('button', { name: /Cheguei/ }).click();
    await expect(page.getByText('Escanear o saco')).toBeVisible();

    await page.getByLabel('Ou escreve o código lido').fill('NOV-E2E-SACO-2');
    await page.getByRole('button', { name: 'Registar saco' }).click();
    await expect(page.getByText('NOV-E2E-SACO-2')).toBeVisible();

    // «Partir» desativado com o saco por pesar; o motivo fica à vista.
    await expect(page.getByRole('button', { name: /^Partir/ })).toBeDisabled();
    await expect(page.getByText('Pesa todos os sacos antes de partir.')).toBeVisible();
    await expect(page.getByText('1 por pesar')).toBeVisible();
  });
});
