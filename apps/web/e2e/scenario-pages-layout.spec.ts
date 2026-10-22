import { expect, type Page, test } from '@playwright/test';
import { login } from './helpers';

// Páginas que o júri usa para decidir (simulador, resultado, detalhe de um cenário em todos os separadores, incluindo a
// Cobertura, comparar e a lista): nunca scroll horizontal da página e nunca texto por cima de texto. Para cada largura e
// tema, recolhe as caixas visíveis de títulos, KPIs (dt/dd), botões e ligações-botão do conteúdo, recortadas pelos
// contentores com overflow (uma tabela larga rola por dentro, sem contar como sobreposição), e falha se duas se
// intersetarem ou se alguma sair do ecrã. Sem animações (`reducedMotion: 'reduce'`): o estado final.
test.describe.configure({ mode: 'parallel' });

const WIDTHS = [
  [320, 640],
  [390, 844],
  [768, 1024],
  [1440, 900],
] as const;

const ITEMS = [
  'h1',
  'h2',
  'h3',
  'dt',
  'dd',
  'button',
  'a[data-slot="button"]',
  '[role="tab"]',
  '[role="radio"]',
];

type Box = { name: string; x: number; y: number; w: number; h: number };

/** Caixas visíveis no conteúdo, já recortadas pelos antepassados com overflow; pares ascendente/descendente não contam. */
async function collect(page: Page) {
  return page.evaluate((items) => {
    const root = document.querySelector('#content');
    if (!root) return { boxes: [], related: [], width: 0 };
    const clipOf = (el: Element) => {
      let r = el.getBoundingClientRect();
      let { left, top, right, bottom } = r;
      for (let p = el.parentElement; p && p !== root.parentElement; p = p.parentElement) {
        const s = getComputedStyle(p);
        if (s.overflowX !== 'visible' || s.overflowY !== 'visible') {
          r = p.getBoundingClientRect();
          left = Math.max(left, r.left);
          top = Math.max(top, r.top);
          right = Math.min(right, r.right);
          bottom = Math.min(bottom, r.bottom);
        }
      }
      return { x: left, y: top, w: right - left, h: bottom - top };
    };
    const shown = (el: Element) => {
      if (el.closest('[hidden], [aria-hidden="true"], [data-sticky-actions], .maplibregl-map'))
        return false;
      const s = getComputedStyle(el);
      return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0;
    };
    const describe = (el: Element) => {
      const text = (el.textContent ?? '').trim().replace(/\s+/g, ' ').slice(0, 32);
      return `${el.tagName.toLowerCase()} «${text}»`;
    };
    const els = [...new Set(items.flatMap((s) => [...root.querySelectorAll(s)]))].filter(shown);
    const kept: Element[] = [];
    const boxes: Box[] = [];
    for (const el of els) {
      const b = clipOf(el);
      if (b.w <= 2 || b.h <= 2) continue;
      kept.push(el);
      boxes.push({ name: describe(el), ...b });
    }
    const related: [number, number][] = [];
    kept.forEach((a, i) => {
      kept.forEach((b, j) => {
        if (j > i && (a.contains(b) || b.contains(a))) related.push([i, j]);
      });
    });
    return { boxes, related, width: document.documentElement.clientWidth };
  }, ITEMS);
}

// Meio píxel de tolerância: caixas encostadas (arredondamentos) não são sobreposição.
const overlaps = (a: Box, b: Box) =>
  a.x + 0.5 < b.x + b.w && b.x + 0.5 < a.x + a.w && a.y + 0.5 < b.y + b.h && b.y + 0.5 < a.y + a.h;

/** Espera pelo fim das cargas (esqueletos e pedidos) e pelas fontes, para medir o layout final. */
async function settle(page: Page) {
  await expect(page.locator('#content h1').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#content [aria-busy="true"]')).toHaveCount(0, { timeout: 45_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(250);
}

async function assertLayout(page: Page, label: string) {
  await settle(page);
  const overflow = await page.evaluate(() => {
    const content = document.querySelector('#content');
    return Math.max(
      document.documentElement.scrollWidth - window.innerWidth,
      content ? content.scrollWidth - content.clientWidth : 0,
    );
  });
  expect(overflow, `${label}: scroll horizontal`).toBeLessThanOrEqual(0);

  const { boxes, related, width } = await collect(page);
  expect(boxes.length, `${label}: elementos medidos`).toBeGreaterThan(2);
  const skip = new Set(related.map(([i, j]) => `${i}:${j}`));
  const clashes: string[] = [];
  boxes.forEach((a, i) => {
    boxes.forEach((b, j) => {
      if (j > i && !skip.has(`${i}:${j}`) && overlaps(a, b)) clashes.push(`${a.name} × ${b.name}`);
    });
  });
  const outside = boxes
    .filter((b) => b.x < -0.5 || b.x + b.w > width + 0.5)
    .map((b) => `${b.name} (${Math.round(b.x)}…${Math.round(b.x + b.w)} de ${width})`);
  expect(clashes, `${label}: sobreposições`).toEqual([]);
  expect(outside, `${label}: fora do ecrã`).toEqual([]);

  // Nada que flutue (ex.: «Primeiros passos») pode tapar a barra de ação presa ao fundo do simulador.
  const covered = await page.evaluate(() => {
    const bar = document.querySelector('[data-sticky-actions]');
    if (!bar || bar.getBoundingClientRect().height === 0) return [];
    const r = bar.getBoundingClientRect();
    const points = [0.1, 0.5, 0.9].flatMap((fx) =>
      [0.3, 0.7].map((fy) => [r.left + r.width * fx, r.top + r.height * fy] as const),
    );
    return points
      .filter(([, y]) => y < window.innerHeight)
      .map(([x, y]) => document.elementFromPoint(x, y))
      .filter((el): el is Element => el != null && !bar.contains(el))
      .map((el) => `${el.tagName.toLowerCase()} «${(el.textContent ?? '').trim().slice(0, 24)}»`);
  });
  expect(covered, `${label}: barra de ação tapada`).toEqual([]);
}

interface Summary {
  id: string;
  label: string;
  siting?: string | null;
  status: string;
}

/** Dois cenários calculados: um por locais reais e um por freguesia (os de referência, quando existem). */
async function pickScenarios(page: Page): Promise<{ sites: Summary; parish: Summary }> {
  const res = await page.request.get('/api/v1/planning/scenarios');
  expect(res.ok()).toBeTruthy();
  const all = ((await res.json()) as Summary[]).filter((s) => s.status !== 'infeasible');
  const ref = (s: Summary) => (s.label.startsWith('Referência') ? 0 : 1);
  const sorted = [...all].sort((a, b) => ref(a) - ref(b));
  const sites = sorted.find((s) => s.siting === 'sites');
  const parish = sorted.find((s) => s.siting !== 'sites');
  if (!sites || !parish) throw new Error('Faltam cenários calculados (por locais e por freguesia)');
  return { sites, parish };
}

for (const scheme of ['light', 'dark'] as const) {
  for (const [width, height] of WIDTHS) {
    test.describe(`cenários ${width}×${height} ${scheme}`, () => {
      test.use({ viewport: { width, height }, colorScheme: scheme, reducedMotion: 'reduce' });

      test('simulador, resultado, detalhe, comparar e lista sem sobreposições', async ({
        page,
      }) => {
        // 15 páginas, algumas com cálculos à parte (incerteza, robustez, cobertura).
        test.setTimeout(420_000);
        await login(page);
        const { sites, parish } = await pickScenarios(page);

        const pages: [string, string][] = [
          ['simulador', '/pt/simulator'],
          ['simulador por freguesia', '/pt/simulator?net=parish'],
          ['resultado (locais)', `/pt/simulator?from=${sites.id}&r=${sites.id}`],
          ['resultado (freguesia)', `/pt/simulator?from=${parish.id}&r=${parish.id}`],
          ['cenário · resumo', `/pt/scenarios/${sites.id}`],
          ['cenário · rede', `/pt/scenarios/${sites.id}?tab=network`],
          ['cenário · cobertura', `/pt/scenarios/${sites.id}?tab=coverage`],
          ['cenário · incerteza', `/pt/scenarios/${sites.id}?tab=uncertainty`],
          ['cenário · e se', `/pt/scenarios/${sites.id}?tab=whatif`],
          ['cenário freguesia · resumo', `/pt/scenarios/${parish.id}`],
          ['cenário freguesia · rede', `/pt/scenarios/${parish.id}?tab=network`],
          ['cenário freguesia · cobertura', `/pt/scenarios/${parish.id}?tab=coverage`],
          ['comparar', `/pt/scenarios/compare?a=${sites.id}&b=${parish.id}`],
          ['comparar vazio', '/pt/scenarios/compare'],
          ['lista', '/pt/scenarios'],
        ];
        for (const [label, path] of pages) {
          await page.goto(path);
          if (path.includes('tab=coverage')) {
            // A matriz chega num pedido à parte: espera pelo indicador fora/dentro das zonas urbanas e pela tabela.
            await expect(page.getByTestId('coverage-equity')).toBeVisible({ timeout: 45_000 });
            // A tabela e os cartões de telemóvel coexistem no DOM: conta só o que está à vista.
            await expect(
              page
                .getByText(/Creixomil|Azurém|Urgezes/)
                .filter({ visible: true })
                .first(),
            ).toBeVisible({ timeout: 45_000 });
          }
          if (path.includes('compare?a=')) {
            // A robustez é calculada à parte: espera pela frase para medir o cartão completo.
            await expect(page.getByText(/das amostras,|Empate/).first()).toBeVisible({
              timeout: 45_000,
            });
          }
          await assertLayout(page, label);
        }
      });
    });
  }
}
