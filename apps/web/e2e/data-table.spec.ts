import { readFileSync } from 'node:fs';
import { expect, type Page, test } from '@playwright/test';
import { login, readZipEntry } from './helpers';

// Circuitos atuais: 40 linhas reais da Vitrus, 7 delas orgânicas.
const TABLE = (page: Page) => page.getByRole('table');
const names = async (page: Page) =>
  (await TABLE(page).getByRole('columnheader').allInnerTexts()).map((t) => t.trim());

async function filterByTypology(page: Page, value: string) {
  await page.getByRole('button', { name: /^Filtros/ }).click();
  await page.getByRole('button', { name: 'Tipologia', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('checkbox', { name: new RegExp(value) })
    .click();
  await page.keyboard.press('Escape');
}

async function download(page: Page, menuItem: string | RegExp) {
  const wait = page.waitForEvent('download');
  await page.getByTestId('dt-export').click();
  await page.getByRole('menuitem', { name: menuItem }).click();
  const file = await wait;
  const path = await file.path();
  return { name: file.suggestedFilename(), data: readFileSync(path) };
}

test.describe('tabela de dados: desktop', () => {
  test.describe.configure({ timeout: 90_000 });
  test.beforeEach(async ({ page }) => {
    await login(page);
    await page.goto('/pt/circuits');
    await expect(page.getByText('1–25 de 40')).toBeVisible();
  });

  test('filtros: chips removíveis, contagens, intervalo, URL partilhável e limpar tudo', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /^Filtros/ }).click();
    await page.getByRole('button', { name: 'Tipologia', exact: true }).click();
    const dialog = page.getByRole('dialog');
    // contagens por faceta
    await expect(dialog.getByRole('checkbox', { name: /Orgânicos/ })).toBeVisible();
    await expect(dialog.locator('li', { hasText: 'Orgânicos' })).toContainText('7');
    await dialog.getByRole('checkbox', { name: /Orgânicos/ }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByText('1–7 de 7 · filtrado de 40')).toBeVisible();
    const chips = page.getByRole('list', { name: 'Filtros ativos' });
    await expect(chips).toContainText('Tipologia: Orgânicos');
    expect(page.url()).toContain('t.circuits=');

    // a URL partilha o estado
    await page.reload();
    await expect(page.getByText('1–7 de 7 · filtrado de 40')).toBeVisible();
    await expect(page.getByRole('list', { name: 'Filtros ativos' })).toContainText('Orgânicos');

    // intervalo numérico (Dias com recolha, por valor)
    await page.getByRole('button', { name: /^Filtros/ }).click();
    await page.getByRole('button', { name: 'Dias', exact: true }).click();
    await page.getByRole('dialog').getByLabel('Mínimo').fill('7');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('list', { name: 'Filtros ativos' })).toContainText('Dias: ≥ 7');

    // remover um chip
    await page.getByRole('button', { name: /^Remover filtro Dias/ }).click();
    await expect(page.getByRole('list', { name: 'Filtros ativos' })).not.toContainText('Dias');

    // pesquisa por coluna (texto) a partir do menu do cabeçalho
    await page.getByRole('button', { name: 'Limpar tudo' }).click();
    await expect(page.getByText('1–25 de 40')).toBeVisible();
    await page.getByRole('button', { name: 'Menu da coluna Viaturas' }).click();
    await page.getByRole('dialog').getByPlaceholder('Valor').fill('AR-81-SQ');
    await page.keyboard.press('Escape');
    await expect(page.getByText(/filtrado de 40/)).toBeVisible();
    expect(await page.getByRole('table').getByRole('row').count()).toBeGreaterThan(1);
    await page.getByRole('button', { name: 'Limpar tudo' }).click();
    await expect(page.getByText('1–25 de 40')).toBeVisible();
    expect(page.url()).not.toContain('t.circuits');
  });

  test('vistas guardadas: guardar, aplicar e apagar', async ({ page }) => {
    await filterByTypology(page, 'Orgânicos');
    await page.getByRole('button', { name: 'Ordenar por Circuito' }).click();
    await page.getByTestId('dt-views').click();
    await page.getByPlaceholder('Nome da vista').fill('Só orgânicos');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('dt-views')).toContainText('Só orgânicos');

    await page.getByRole('button', { name: 'Limpar tudo' }).click();
    await expect(page.getByText('1–25 de 40')).toBeVisible();

    await page.getByTestId('dt-views').click();
    await page.getByRole('button', { name: 'Só orgânicos', exact: true }).click();
    await expect(page.getByText('1–7 de 7 · filtrado de 40')).toBeVisible();

    // sobrevive a recarregar
    await page.goto('/pt/circuits');
    await page.getByTestId('dt-views').click();
    await expect(page.getByRole('button', { name: 'Só orgânicos', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Apagar a vista Só orgânicos' }).click();
    await expect(page.getByRole('button', { name: 'Só orgânicos', exact: true })).toHaveCount(0);
  });

  test('colunas: reordenar com o teclado, fixar, ocultar e redimensionar', async ({ page }) => {
    const before = await names(page);
    const idx = (list: string[], label: string) => list.findIndex((t) => t.includes(label));
    expect(idx(before, 'Viaturas')).toBeGreaterThan(idx(before, 'Dias'));

    await page.getByTestId('dt-columns').click();
    const grip = page.getByRole('button', { name: 'Mover a coluna Viaturas' });
    await grip.focus();
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Escape');
    const after = await names(page);
    expect(idx(after, 'Viaturas')).toBeLessThan(idx(after, 'Dias'));

    // fixar à esquerda: fica `sticky` com deslocamento
    await page.getByRole('button', { name: 'Menu da coluna Tipologia' }).click();
    await page.getByRole('button', { name: 'Fixar à esquerda' }).click();
    const pos = await TABLE(page)
      .getByRole('columnheader', { name: /Tipologia/ })
      .evaluate((el) => getComputedStyle(el).position);
    expect(pos).toBe('sticky');

    // ocultar pelo menu da coluna
    await page.getByRole('button', { name: 'Menu da coluna Recolha' }).click();
    await page.getByRole('button', { name: 'Ocultar coluna' }).click();
    await expect(TABLE(page).getByRole('columnheader', { name: /Recolha/ })).toHaveCount(0);

    // redimensionar pelo menu da coluna (alternativa ao arrastar)
    const handle = page.getByRole('separator', { name: 'Redimensionar a coluna Estado' });
    const w0 = Number(await handle.getAttribute('aria-valuenow'));
    await page.getByRole('button', { name: 'Menu da coluna Estado' }).click();
    await page.getByRole('button', { name: 'Alargar coluna' }).click();
    await page.getByRole('button', { name: 'Alargar coluna' }).click();
    await page.keyboard.press('Escape');
    await expect(handle).toHaveAttribute('aria-valuenow', String(w0 + 40));

    // tudo persiste ao recarregar
    await page.reload();
    await expect(page.getByText('1–25 de 40')).toBeVisible();
    await expect(TABLE(page).getByRole('columnheader', { name: /Recolha/ })).toHaveCount(0);
    expect(idx(await names(page), 'Viaturas')).toBeLessThan(idx(await names(page), 'Dias'));
    await expect(
      page.getByRole('separator', { name: 'Redimensionar a coluna Estado' }),
    ).toHaveAttribute('aria-valuenow', String(w0 + 40));
  });

  test('teclado no cabeçalho: um só ponto de paragem e ↓ abre o menu da coluna', async ({
    page,
  }) => {
    const sort = page.getByRole('button', { name: 'Ordenar por Tipologia' });
    await sort.focus();
    await page.keyboard.press('Enter');
    await expect(TABLE(page).getByRole('columnheader', { name: /Tipologia/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await page.keyboard.press('ArrowDown');
    await expect(
      page.getByRole('dialog').getByRole('button', { name: 'Fixar à esquerda' }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sort).toBeFocused();
    // Tab salta para o cabeçalho seguinte (o botão do menu e o separador não são paragens)
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Ordenar por Recolha' })).toBeFocused();
  });

  test('ordenação múltipla com Shift e indicador numerado', async ({ page }) => {
    await page.getByRole('button', { name: 'Ordenar por Tipologia' }).click();
    await page
      .getByRole('button', { name: 'Ordenar por Circuito' })
      .click({ modifiers: ['Shift'] });
    await expect(TABLE(page).getByRole('columnheader', { name: /Tipologia/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await expect(TABLE(page).getByRole('columnheader', { name: /Circuito/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await expect(TABLE(page).getByRole('columnheader', { name: /Circuito/ })).toContainText('2');
  });

  test('exportar CSV: BOM, ponto e vírgula, filtrado, seleção e nome com data', async ({
    page,
  }) => {
    const all = await download(page, /Descarregar CSV/);
    expect(all.name).toMatch(/^circuitos-\d{4}-\d{2}-\d{2}\.csv$/);
    const csv = all.data.toString('utf8');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).trimEnd().split('\r\n');
    expect(lines[0]).toContain(';');
    expect(lines[0]).toContain('Circuito');
    // 1 cabeçalho + as 40 linhas filtradas (por omissão exporta o que está filtrado, não só a página)
    expect(lines.length).toBeGreaterThanOrEqual(41);

    await filterByTypology(page, 'Orgânicos');
    const filtered = (await download(page, /Descarregar CSV/)).data.toString('utf8');
    expect(filtered.slice(1).trimEnd().split('\r\n')).toHaveLength(8);
    expect(filtered).not.toContain('PAYT');
  });

  test('exportar XLSX e JSON: ficheiros válidos com os dados filtrados', async ({ page }) => {
    await filterByTypology(page, 'Orgânicos');
    const xlsx = await download(page, /Descarregar Excel/);
    expect(xlsx.name).toMatch(/\.xlsx$/);
    expect(xlsx.data.subarray(0, 2).toString()).toBe('PK');
    const sheet = readZipEntry(xlsx.data, 'xl/worksheets/sheet1.xml') ?? '';
    expect(sheet).toContain('<autoFilter ref="A1:');
    expect((sheet.match(/<row /g) ?? []).length).toBe(8);
    expect(readZipEntry(xlsx.data, 'xl/styles.xml')).toContain('dd/mm/yyyy');

    const json = await download(page, /Descarregar JSON/);
    const rows = JSON.parse(json.data.toString('utf8')) as { code: string; typology: string }[];
    expect(rows).toHaveLength(7);
    expect(rows[0]).toHaveProperty('code');
  });

  test('exportar: valores crus e vírgula como separador', async ({ page }) => {
    await page.getByTestId('dt-export').click();
    await page.getByRole('menuitemradio', { name: /Vírgula \(,\)/ }).click();
    await page.getByRole('menuitemradio', { name: /^Crus/ }).click();
    await page.keyboard.press('Escape');
    const csv = (await download(page, /Descarregar CSV/)).data.toString('utf8');
    const header = csv.slice(1).split('\r\n')[0] ?? '';
    expect(header).toContain(',');
    expect(header).not.toContain(';');
  });

  test('seleção: caixas, Shift para intervalo, página, todas as filtradas e exportar a seleção', async ({
    page,
  }) => {
    const rowBoxes = TABLE(page).getByRole('checkbox', { name: /^Selecionar (?!as linhas)/ });
    await rowBoxes.nth(0).click();
    await rowBoxes.nth(3).click({ modifiers: ['Shift'] });
    const bar = page.getByTestId('dt-selection-bar');
    await expect(bar).toContainText('4 selecionadas');

    // exportar só a seleção
    const sel = await (async () => {
      const wait = page.waitForEvent('download');
      await bar.getByRole('button', { name: 'Exportar seleção' }).click();
      await page.getByRole('menuitem', { name: /Descarregar CSV/ }).click();
      const f = await wait;
      return readFileSync(await f.path()).toString('utf8');
    })();
    expect(sel.slice(1).trimEnd().split('\r\n')).toHaveLength(5);

    // página inteira e depois as 40
    await TABLE(page).getByRole('checkbox', { name: 'Selecionar as linhas desta página' }).click();
    await expect(bar).toContainText('25 selecionadas');
    await bar.getByRole('button', { name: /Selecionar as 40 filtradas/ }).click();
    await expect(bar).toContainText('40 selecionadas');
    await expect(page.getByText(/40 selecionadas/).last()).toBeVisible();

    await bar.getByRole('button', { name: 'Limpar seleção' }).click();
    await expect(bar).toHaveCount(0);
  });

  test('teclado: / pesquisa, setas entre linhas, Espaço seleciona, Esc limpa', async ({ page }) => {
    await page.keyboard.press('/');
    const search = page.getByRole('searchbox');
    await expect(search).toBeFocused();
    await page.keyboard.type('BIO');
    await expect(page.getByText(/filtrado de 40/)).toBeVisible();
    await page.keyboard.press('Escape'); // limpa a pesquisa
    await expect(search).toHaveValue('');
    await search.blur();

    const rows = TABLE(page).locator('tbody tr[data-row-index]');
    await rows.first().focus();
    await page.keyboard.press('ArrowDown');
    await expect(rows.nth(1)).toBeFocused();
    await page.keyboard.press('Space');
    await expect(page.getByTestId('dt-selection-bar')).toContainText('1 selecionadas');
    await page.keyboard.press('End');
    await expect(rows.last()).toBeFocused();
    await page.keyboard.press('Home');
    await expect(rows.first()).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('dt-selection-bar')).toHaveCount(0);
  });

  test('densidade compacta é lembrada', async ({ page }) => {
    const row = TABLE(page).locator('tbody tr[data-row-index]').nth(3);
    const h0 = (await row.boundingBox())?.height ?? 0;
    await page.getByRole('button', { name: 'Densidade compacta' }).click();
    await expect.poll(async () => (await row.boundingBox())?.height ?? 999).toBeLessThan(h0);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Densidade compacta' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('rodapé com totais (quando há agregados) e rolagem contínua', async ({ page }) => {
    await page.getByRole('combobox', { name: 'Linhas por página' }).click();
    await page.getByRole('option', { name: 'Rolagem contínua' }).click();
    await expect(page.getByText('1–40 de 40')).toBeVisible();
    await expect(TABLE(page).locator('tbody tr[data-row-index]')).toHaveCount(40);
  });
});

test.describe('tabela de dados: telemóvel 390', () => {
  test.describe.configure({ timeout: 90_000 });
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });

  test('folha de filtros com tudo, cartões e chips', async ({ page }) => {
    await login(page);
    await page.goto('/pt/circuits');
    await expect(page.getByTestId('dt-filters-mobile')).toBeVisible();
    await expect(page.getByRole('table')).toBeHidden();

    await page.getByTestId('dt-filters-mobile').click();
    const sheet = page.getByRole('dialog');
    await expect(sheet.getByText('Filtros e vista')).toBeVisible();
    await sheet.getByRole('button', { name: 'Tipologia' }).click();
    await sheet.getByRole('checkbox', { name: /Orgânicos/ }).click();
    await expect(sheet.getByRole('button', { name: 'Ver 7 resultados' })).toBeVisible();
    await sheet.getByRole('button', { name: 'Ver 7 resultados' }).click();
    await expect(page.getByRole('list', { name: 'Filtros ativos' })).toContainText('Orgânicos');
    await expect(page.locator('ul[aria-label] > li').first()).toBeVisible();

    // sem overflow horizontal
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await page.getByRole('button', { name: 'Remover filtro Tipologia: Orgânicos' }).click();
    await expect(page.getByText('1–25 de 40')).toBeVisible();
  });
});
