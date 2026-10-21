import { expect, type Page, test } from '@playwright/test';

// O hero da landing nunca pode ter texto por cima de texto nem sair do ecrã na horizontal (o dono: «jamais»). Para cada
// viewport e tema, recolhe as caixas de todos os elementos de texto e controlo visíveis do hero (eyebrow, prazo, título,
// subtítulo, botões, cada linha do painel dos números), os nós e a ponta do fio e os controlos da barra do topo, e falha se
// dois se intersetarem (tolerância 0) ou se algum passar das margens. Sem animações (`reducedMotion: 'reduce'`): o estado final.
test.describe.configure({ mode: 'parallel' });

const VIEWPORTS = [
  [320, 640],
  [375, 667],
  [390, 844],
  [768, 1024],
  [820, 1180],
  [1000, 580],
  [1024, 768],
  [1280, 720],
  [1366, 768],
  [1440, 900],
  [1536, 864],
  [1920, 1080],
  [2560, 1300],
] as const;

const HERO_ITEMS = [
  '.lp-hs-eyebrow',
  '.lp-hs-deadline',
  '#landing-title',
  '.lp-hs-lead',
  '.lp-hs-ctas > *',
  '.lp-hsl',
  '.lp-hsl-kicker',
  '.lp-hsl-label',
  '.lp-hsl-v',
  '.lp-hsl-track',
  '.lp-hsl-share',
  '.lp-hsl-hook',
  '.lp-hsl-src',
  '.lp-fio-node',
  '.lp-fio-fray',
];
const NAV_ITEMS = ['header.lp-header a', 'header.lp-header button'];

type Box = { name: string; x: number; y: number; w: number; h: number };

/** Caixas dos elementos visíveis; os pares ascendente/descendente (ex.: o painel e as suas linhas) não contam como colisão. */
async function collect(page: Page) {
  return page.evaluate(
    ({ hero, nav }) => {
      const visible = (el: Element) => {
        const r = el.getBoundingClientRect();
        const s = getComputedStyle(el);
        return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none';
      };
      const describe = (el: Element) => {
        const cls = (el.getAttribute('class') ?? '').split(' ')[0];
        const text = (el.textContent ?? '').trim().slice(0, 28);
        return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ''} «${text}»`;
      };
      const els = [
        ...hero.flatMap((s) => [...document.querySelectorAll(`.lp-hs ${s}`)]),
        ...nav.flatMap((s) => [...document.querySelectorAll(s)]),
      ].filter(visible);
      const unique = [...new Set(els)];
      const boxes = unique.map((el) => {
        const r = el.getBoundingClientRect();
        return { name: describe(el), x: r.left, y: r.top, w: r.width, h: r.height };
      });
      const related: [number, number][] = [];
      unique.forEach((a, i) => {
        unique.forEach((b, j) => {
          if (j > i && (a.contains(b) || b.contains(a))) related.push([i, j]);
        });
      });
      return { boxes, related, width: document.documentElement.clientWidth };
    },
    { hero: HERO_ITEMS, nav: NAV_ITEMS },
  );
}

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

for (const scheme of ['light', 'dark'] as const) {
  for (const [width, height] of VIEWPORTS) {
    test.describe(`hero ${width}×${height} ${scheme}`, () => {
      test.use({ viewport: { width, height }, colorScheme: scheme, reducedMotion: 'reduce' });

      test('nada se sobrepõe nem sai do ecrã', async ({ page }) => {
        await page.goto('/pt/');
        await expect(page.locator('#landing-title')).toBeVisible();
        await expect(page.locator('.lp-hsl')).toBeVisible();
        await page.evaluate(() => document.fonts.ready);
        // A contagem de dias do prazo só chega no cliente: espera por ela para medir a linha completa.
        await expect(
          page.locator('.lp-hs-deadline-days[data-ready="true"]').first(),
        ).toBeAttached();

        const { boxes, related, width: vw } = await collect(page);
        expect(boxes.length, 'elementos medidos').toBeGreaterThan(15);
        const skip = new Set(related.map(([i, j]) => `${i}:${j}`));
        const clashes: string[] = [];
        boxes.forEach((a, i) => {
          boxes.forEach((b, j) => {
            if (j > i && !skip.has(`${i}:${j}`) && overlaps(a, b))
              clashes.push(`${a.name} × ${b.name}`);
          });
        });
        const outside = boxes
          .filter((b) => b.x < 0 || b.x + b.w > vw)
          .map((b) => `${b.name} (${Math.round(b.x)}…${Math.round(b.x + b.w)} de ${vw})`);
        expect(clashes, 'sobreposições').toEqual([]);
        expect(outside, 'fora do ecrã').toEqual([]);
      });
    });
  }
}
