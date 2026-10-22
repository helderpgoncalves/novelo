import { expect, type Page, test } from '@playwright/test';
import { login } from './helpers';

// As páginas que o júri do Hack4Guimarães percorre (ponto de partida, mapa, copiloto, piloto, validação e pressupostos)
// nunca podem ter títulos, KPIs, botões ou navegação uns por cima dos outros nem fugir do ecrã na horizontal. Para cada
// página, viewport e tema: percorre o conteúdo (rola o `#content` de ecrã em ecrã), mede as caixas visíveis (cortadas
// pelos contentores com scroll, como o utilizador as vê) e falha se duas se intersetarem ou se alguma passar das margens.
// O «Primeiros passos» flutua por cima do conteúdo de propósito e o mapa (MapLibre) desenha-se a si próprio: ficam de fora.
test.describe.configure({ mode: 'parallel' });

const VIEWPORTS = [
  [390, 844],
  [768, 1024],
  [1440, 900],
] as const;

type Ready = (page: Page) => Promise<void>;

const PAGES: { name: string; path: string; ready: Ready }[] = [
  {
    name: 'ponto de partida',
    path: '/pt/',
    ready: async (page) => {
      await expect(page.getByText('Recolhido em 2025').first()).toBeVisible();
      await expect(page.getByRole('radiogroup').first()).toBeVisible();
    },
  },
  {
    name: 'mapa',
    path: '/pt/map',
    ready: async (page) => {
      await expect(page.locator('.maplibregl-canvas').first()).toBeVisible({ timeout: 15_000 });
    },
  },
  {
    name: 'copiloto',
    path: '/pt/chat',
    ready: async (page) => {
      await expect(page.getByTestId('copilot-empty')).toBeVisible();
    },
  },
  {
    name: 'piloto',
    path: '/pt/pilot',
    ready: async (page) => {
      await expect(page.getByText('Têxtil no piloto')).toBeVisible({ timeout: 30_000 });
    },
  },
  {
    name: 'validação',
    path: '/pt/validation',
    ready: async (page) => {
      await expect(page.getByText('Erro mediano').first()).toBeVisible();
    },
  },
  {
    name: 'pressupostos',
    path: '/pt/assumptions',
    ready: async (page) => {
      await expect(page.getByText('Taxa de captura').first()).toBeVisible();
    },
  },
];

/** Títulos, KPIs (rótulo e valor), botões, separadores, campos e a navegação da app (topo, barra lateral, separadores). */
const ITEMS = [
  '#content h1',
  '#content h2',
  '#content .eyebrow',
  '#content dl > div > dt',
  '#content dl > div > dd',
  '#content button',
  '#content a[data-slot="button"]',
  '#content [role="tab"]',
  '#content [role="radio"]',
  '#content input:not([type="hidden"])',
  '#content textarea',
  '[data-testid="topbar"] a',
  '[data-testid="topbar"] button',
  '[data-testid="tab-bar"] a',
  '[data-testid="tab-bar"] button',
  '[data-app-frame] aside nav a',
];
const IGNORE = '.maplibregl-map, [data-testid="starter-checklist"], .sr-only, [aria-hidden="true"]';

type Box = {
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  left: number;
  right: number;
};

/** Caixas visíveis neste momento (recortadas pelos antepassados com scroll) e os pares ascendente/descendente. */
async function collect(page: Page) {
  return page.evaluate(
    ({ items, ignore }) => {
      const clip = (el: Element) => {
        const r = el.getBoundingClientRect();
        let [x1, y1, x2, y2] = [r.left, r.top, r.right, r.bottom];
        for (let p = el.parentElement; p; p = p.parentElement) {
          const s = getComputedStyle(p);
          if (s.overflowX === 'visible' && s.overflowY === 'visible') continue;
          const c = p.getBoundingClientRect();
          x1 = Math.max(x1, c.left);
          y1 = Math.max(y1, c.top);
          x2 = Math.min(x2, c.right);
          y2 = Math.min(y2, c.bottom);
        }
        return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
      };
      const describe = (el: Element) => {
        const label = el.getAttribute('aria-label') ?? el.textContent ?? '';
        return `${el.tagName.toLowerCase()} «${label.trim().replace(/\s+/g, ' ').slice(0, 32)}»`;
      };
      const els = [...new Set(items.flatMap((s) => [...document.querySelectorAll(s)]))].filter(
        (el) => {
          if (el.closest(ignore)) return false;
          // `checkVisibility` também exclui o conteúdo de um <details> fechado (que mantém caixas, mas não se pinta).
          return el.checkVisibility({
            contentVisibilityAuto: true,
            opacityProperty: true,
            visibilityProperty: true,
          });
        },
      );
      const kept: Element[] = [];
      const boxes = els.flatMap((el) => {
        const b = clip(el);
        if (b.w <= 2 || b.h <= 2) return [];
        kept.push(el);
        const raw = el.getBoundingClientRect();
        return [{ name: describe(el), ...b, left: raw.left, right: raw.right }];
      });
      const related: [number, number][] = [];
      kept.forEach((a, i) => {
        kept.forEach((b, j) => {
          if (j > i && (a.contains(b) || b.contains(a))) related.push([i, j]);
        });
      });
      // Itens dentro de uma faixa com scroll horizontal (separadores, tabelas) podem passar da margem: rolam lá dentro.
      const inScroller = kept.map((el) => {
        for (let p = el.parentElement; p; p = p.parentElement) {
          const o = getComputedStyle(p).overflowX;
          if (o === 'auto' || o === 'scroll') return p.id !== 'content';
        }
        return false;
      });
      return { boxes, related, inScroller, width: document.documentElement.clientWidth };
    },
    { items: ITEMS, ignore: IGNORE },
  );
}

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;

for (const scheme of ['light', 'dark'] as const) {
  for (const [width, height] of VIEWPORTS) {
    test.describe(`páginas do júri ${width}×${height} ${scheme}`, () => {
      test.use({ viewport: { width, height }, colorScheme: scheme, reducedMotion: 'reduce' });

      for (const { name, path, ready } of PAGES) {
        test(`${name}: nada se sobrepõe nem sai do ecrã`, async ({ page }) => {
          test.setTimeout(60_000);
          await login(page);
          await page.goto(path);
          await expect(page.locator('#content h1').first()).toBeVisible();
          await ready(page);
          await page.evaluate(() => document.fonts.ready);

          // Sem scroll horizontal: nem a página nem a área de conteúdo.
          const overflow = await page.evaluate(() => {
            const content = document.querySelector('#content');
            return {
              page: document.documentElement.scrollWidth - window.innerWidth,
              content: content ? content.scrollWidth - content.clientWidth : 0,
            };
          });
          expect(overflow.page, 'scroll horizontal da página').toBeLessThanOrEqual(0);
          expect(overflow.content, 'scroll horizontal do conteúdo').toBeLessThanOrEqual(0);

          const steps = await page.evaluate(() => {
            const c = document.querySelector('#content');
            return c ? Math.min(12, Math.ceil(c.scrollHeight / c.clientHeight)) : 1;
          });
          const clashes = new Set<string>();
          const outside = new Set<string>();
          let measured = 0;
          for (let i = 0; i < steps; i++) {
            await page.evaluate((i) => {
              const c = document.querySelector('#content');
              if (c) c.scrollTop = i * c.clientHeight;
            }, i);
            await page.waitForTimeout(120);
            const { boxes, related, inScroller, width: vw } = await collect(page);
            measured = Math.max(measured, boxes.length);
            const skip = new Set(related.map(([a, b]) => `${a}:${b}`));
            boxes.forEach((a, x) => {
              boxes.forEach((b, y) => {
                if (y > x && !skip.has(`${x}:${y}`) && overlaps(a, b))
                  clashes.add(`${a.name} × ${b.name}`);
              });
              if (!inScroller[x] && (a.left < -0.5 || a.right > vw + 0.5))
                outside.add(`${a.name} (${Math.round(a.left)}…${Math.round(a.right)} de ${vw})`);
            });
          }
          expect(measured, 'elementos medidos').toBeGreaterThan(5);
          expect([...clashes], 'sobreposições').toEqual([]);
          expect([...outside], 'fora do ecrã').toEqual([]);
        });
      }
    });
  }
}
