#!/usr/bin/env node
/**
 * Capturas de ecrã da app (stack de dev local, com `scripts/seed/demo_seed.py`) para o deck da Vitrus.
 *   node pitch/vitrus/shots.cjs            -> pitch/vitrus/img/app-*.png
 * Janela 1600 × 900 (16:9), pt-PT, sessão de administrador de dev.
 */
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { chromium } = createRequire(path.join(__dirname, '../../apps/web/package.json'))('@playwright/test');

const WEB = process.env.WEB || 'http://localhost:3190';
const API = process.env.API || 'http://localhost:8190/api/v1';
const OUT = path.join(__dirname, 'img');
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1.5, locale: 'pt-PT' });
  const page = await ctx.newPage();
  await page.goto(`${WEB}/pt/login?method=password`);
  await page.getByLabel('Email').fill('admin@heldergoncalves.io');
  await page.getByLabel('Palavra-passe', { exact: true }).fill(process.env.NOVELO_DEV_PASSWORD || '');
  await page.getByRole('button', { name: /entrar/i }).first().click();
  await page.waitForURL((u) => !/login/.test(u.pathname), { timeout: 20000 });

  const api = ctx.request;
  const scenarios = await (await api.get(`${API}/planning/scenarios`)).json();
  const byName = (re) => scenarios.find((s) => re.test(s.label));
  const lots = await (await api.get(`${API}/lots`)).json();
  const lotCodes = (Array.isArray(lots) ? lots : lots.items || []).map((l) => l.code);
  console.log('lots', lotCodes);
  const A = byName(/Cenário A/i);
  const B = byName(/Cenário B · sem contentores \(proposta\) · 60 000 €\/ano$/i) || byName(/Cenário B/i);
  const P90 = byName(/Por freguesia · 90 000/i);
  const P40 = byName(/Por freguesia · 40 000/i);
  const S60 = byName(/Locais reais · 60 000 €\/ano$/i);
  const D2 = byName(/Duas freguesias/i);
  const WI = scenarios.find((s) => /E se/i.test(s.label));
  console.log({ A: A?.label, B: B?.label, D2: D2?.label, WI: WI?.label });
  const shots = [
    ['home', '/pt/'],
    ['scenarios', '/pt/scenarios'],
    A && B ? ['compare-ab', `/pt/scenarios/compare?a=${A.id}&b=${B.id}`] : null,
    B && P90 ? ['compare-budget', `/pt/scenarios/compare?a=${B.id}&b=${P90.id}`] : null,
    B ? ['scenario-b', `/pt/scenarios/${B.id}`] : null,
    B ? ['scenario-b-kpis2', `/pt/scenarios/${B.id}`, 330] : null,
    WI ? ['whatif-result', `/pt/scenarios/${WI.id}?tab=whatif`, 280] : null,
    B ? ['scenario-b-network', `/pt/scenarios/${B.id}?tab=network`, 560] : null,
    B ? ['scenario-b-coverage', `/pt/scenarios/${B.id}?tab=coverage`, 430] : null,
    B ? ['scenario-b-uncertainty', `/pt/scenarios/${B.id}?tab=uncertainty`, 600] : null,
    B ? ['scenario-b-whatif', `/pt/scenarios/${B.id}?tab=whatif`, 300] : null,
    S60 ? ['scenario-sites', `/pt/scenarios/${S60.id}`] : null,
    S60 ? ['scenario-sites-network', `/pt/scenarios/${S60.id}?tab=network`, 560] : null,
    D2 ? ['duas', `/pt/scenarios/${D2.id}`] : null,
    D2 ? ['duas-network', `/pt/scenarios/${D2.id}?tab=network`, 560] : null,
    ['simulator', '/pt/simulator'],
    ['municipal', '/pt/municipal'],
    ['municipal-candidates', '/pt/municipal?tab=candidates', 330],
    ['municipal-b2b', '/pt/municipal?tab=b2b', 260],
    ['municipal-gaps', '/pt/municipal?tab=gaps'],
    ['municipal-quality', '/pt/municipal?tab=quality'],
    ['triage', '/pt/triage'],
    ['lots', '/pt/lots'],
    ['brands', '/pt/lots?tab=brands'],
    ['market', '/pt/lots?tab=market'],
    lotCodes[0] ? ['lot', `/pt/lots/${lotCodes[0]}`] : null,
    lotCodes[4] ? ['lot-delivered', `/pt/lots/${lotCodes[4]}`] : null,
    lotCodes[4] ? ['passport', `/pt/passport/${lotCodes[4]}`] : null,
    ['reports', '/pt/reports'],
    ['bag-check', '/pt/bag-check'],
    ['pilot', '/pt/pilot'],
    ['assumptions', '/pt/assumptions'],
    ['coverage', '/pt/map?fill=cover'],
    ['map', '/pt/map'],
    ['fleet', '/pt/fleet'],
    ['validation', '/pt/validation'],
    ['data-quality', '/pt/data-quality'],
    ['circuits', '/pt/circuits'],
  ].filter(Boolean);

  for (const [name, route, scrollY] of shots) {
    try {
      await page.goto(`${WEB}${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(2500);
      if (scrollY) { await page.evaluate((y) => { for (const e of [document.scrollingElement, document.querySelector('main'), document.querySelector('#content')]) e?.scrollTo?.(0, y); }, scrollY); await page.waitForTimeout(1200); }
      await page.screenshot({ path: path.join(OUT, `app-${name}.png`) });
      console.log('ok', name, page.url());
    } catch (e) {
      console.log('FALHOU', name, String(e).slice(0, 120));
    }
  }
  await browser.close();
})();
