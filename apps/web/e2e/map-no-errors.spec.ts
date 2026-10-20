import { expect, type Page, test } from '@playwright/test';
import { login } from './helpers';

/**
 * Regressão do "Worker failed to load" em produção: o MapLibre 6 procurava o worker ao lado do bundle, o Vite não o
 * emitia e o nginx devolvia o index.html. Só se vê num build de produção, por isso corre-se contra a imagem web
 * (nginx com CSP): `docker build -f apps/web/Dockerfile -t novelo-web-test .`, `docker run --network novelo-dev_default
 * -p 3191:80 novelo-web-test` e `E2E_BASE_URL=http://localhost:3191 pnpm e2e map-no-errors`.
 * Em `just dev` (Vite) o worker vem de node_modules e o teste passa na mesma, mas não prova a produção.
 */

// Domínios externos que a CSP permite aos mapas (ver security-headers.conf).
const ALLOWED_ORIGINS = new Set(['https://basemaps.cartocdn.com']);
const isAllowedExternal = (url: URL) =>
  ALLOWED_ORIGINS.has(url.origin) ||
  /^https:\/\/([a-z0-9-]+\.)?basemaps\.cartocdn\.com$/.test(url.origin);

interface Probe {
  problems: string[];
  external: Set<string>;
  workerStatus: number[];
}

async function probe(page: Page, base: string): Promise<Probe> {
  const out: Probe = { problems: [], external: new Set(), workerStatus: [] };
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning')
      out.problems.push(`console.${msg.type()}: ${msg.text()}`);
  });
  page.on('pageerror', (e) => out.problems.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) =>
    out.problems.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`),
  );
  page.on('response', async (res) => {
    const url = new URL(res.url());
    if (url.origin !== base) out.external.add(url.origin);
    if (/maplibre-gl-worker/.test(url.pathname)) {
      out.workerStatus.push(res.status());
      const type = res.headers()['content-type'] ?? '';
      if (!/javascript/.test(type)) out.problems.push(`worker com content-type ${type}`);
    }
    if (res.status() >= 400 && !url.pathname.startsWith('/api/'))
      out.problems.push(`HTTP ${res.status()}: ${res.url()}`);
  });
  // Violações da CSP (também aparecem como erro de consola, aqui ficam com a diretiva).
  await page.addInitScript(() => {
    document.addEventListener('securitypolicyviolation', (e) =>
      console.error(`CSP ${e.violatedDirective}: ${e.blockedURI}`),
    );
  });
  return out;
}

async function expectMapLoaded(page: Page) {
  const canvas = page.locator('canvas.maplibregl-canvas').first();
  await expect(canvas).toBeVisible();
  // Só há tiles e rótulos quando o worker respondeu: espera pelo mapa "parado" e com camadas pintadas.
  await page.waitForFunction(
    () => {
      const c = document.querySelector('canvas.maplibregl-canvas');
      return (
        !!c &&
        c.clientWidth > 100 &&
        !document.querySelector('.maplibregl-map.maplibregl-map-loading')
      );
    },
    undefined,
    { timeout: 20_000 },
  );
  await page.waitForTimeout(2500);
}

test.describe('mapas em build de produção: sem erros de consola', () => {
  const pages = [
    ['mapa', '/pt/map'],
    ['rede municipal', '/pt/map?preset=municipal'],
    ['frota', '/pt/fleet?tab=map'],
  ] as const;

  for (const [name, path] of pages) {
    test(name, async ({ page, baseURL }) => {
      const base = new URL(baseURL ?? 'http://localhost:3190').origin;
      const seen = await probe(page, base);
      await login(page);
      await page.goto(path);
      await expectMapLoaded(page);
      await page.evaluate(() => localStorage.setItem('novelo-theme', 'dark'));
      await page.reload();
      await expectMapLoaded(page);

      expect(seen.problems).toEqual([]);
      // Só o mapa de base da CARTO sai do domínio (Turnstile não aparece em páginas autenticadas).
      for (const origin of seen.external)
        expect(isAllowedExternal(new URL(origin)), origin).toBe(true);
      // O worker foi mesmo pedido ao mesmo domínio (em dev vem de /node_modules/.vite e o nome também contém maplibre).
      expect(seen.workerStatus.length).toBeGreaterThan(0);
      expect(seen.workerStatus.every((s) => s === 200 || s === 304)).toBe(true);
    });
  }
});
