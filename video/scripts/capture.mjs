// Capturas da app real para o vídeo, contra a stack de dev (`just dev`, web :3190, api :8190).
// Cada ecrã sai em duas peças: `-base` (o ecrã como se vê, com barra lateral e topo) e `-content` (todo o #content,
// para deslizar dentro da moldura como um scroll verdadeiro). Também a 390 px (telemóvel), para o vídeo vertical.
// Corre com: node scripts/capture.mjs [nome,...]
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

const require = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const { chromium } = require('@playwright/test');
const BASE = process.env.WEB ?? 'http://localhost:3190';
const OUT = new URL('../public/shots/app/', import.meta.url).pathname;
const MANIFEST = new URL('../src/data/shots.json', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch();
const login = await (async () => {
  const ctx = await b.newContext({ baseURL: BASE });
  const res = await ctx.request.post('/api/v1/auth/login', {
    data: { email: 'admin@heldergoncalves.io', password: 'admin-novelo-dev-1' },
    headers: { 'X-Turnstile-Token': 'XXXX.DUMMY.TOKEN.XXXX' },
  });
  if (!res.ok()) throw new Error(`login ${res.status()}`);
  const me = await (await ctx.request.get('/api/v1/auth/me')).json();
  const state = await ctx.storageState();
  state.cookies.push({ name: 'novelo_session', value: '1', domain: 'localhost', path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' });
  await ctx.close();
  return { state, id: me.id };
})();

const api = await b.newContext({ baseURL: BASE, storageState: login.state });
const refs = await (await api.request.get('/api/v1/planning/scenarios/reference')).json();
const ref = (key) => refs.find((s) => s.reference_key === key)?.id;
const IDS = { par60: ref('parish:60000'), sites60: ref('sites:60000'), sites40: ref('sites:40000') };
const lots = await (await api.request.get('/api/v1/lots')).json().catch(() => null);
await api.close();

const PAGES = {
  sim: { url: '/pt/simulator?net=parish&r={par60}', wait: 5000, anchors: ['A rede no mapa'] },
  scenario: { url: '/pt/scenarios/{par60}', wait: 4000, anchors: ['Plano de recolha', 'Têxtil reutilizável'] },
  coverage: { url: '/pt/scenarios/{par60}?tab=coverage', wait: 4000, anchors: [] },
  uncertainty: { url: '/pt/scenarios/{par60}?tab=uncertainty', wait: 10000, anchors: [] },
  compare: { url: '/pt/scenarios/compare?a={sites60}&b={sites40}', wait: 4000, anchors: [] },
  lot: { url: '/pt/lots/NOV-M9Z34P', wait: 3000, anchors: [] },
  municipal: { url: '/pt/municipal', wait: 6000, anchors: [] },
  reports: { url: '/pt/reports', wait: 3000, anchors: [] },
  start: { url: '/pt/', wait: 4000, anchors: [] },
};
const DEVICES = {
  desktop: { width: 1440, height: 900, dsf: 2, mobile: false },
  mobile: { width: 390, height: 844, dsf: 3, mobile: true },
};

async function shoot(name, page, deviceKey) {
  const dev = DEVICES[deviceKey];
  const ctx = await b.newContext({
    baseURL: BASE,
    viewport: { width: dev.width, height: dev.height },
    deviceScaleFactor: dev.dsf,
    isMobile: dev.mobile,
    hasTouch: dev.mobile,
    storageState: login.state,
    locale: 'pt-PT',
    timezoneId: 'Europe/Lisbon',
    colorScheme: 'light',
    reducedMotion: 'reduce',
  });
  await ctx.addInitScript((id) => {
    try {
      localStorage.setItem('novelo-theme', 'light');
      localStorage.setItem(`novelo.tour.seen.${id}`, '1');
      sessionStorage.removeItem('novelo.tour.pending');
    } catch {}
    const css = '::-webkit-scrollbar{width:0!important;height:0!important;display:none!important} *{scrollbar-width:none!important} [data-sonner-toaster],[data-testid=starter-checklist]{display:none!important}';
    const add = () => { const s = document.createElement('style'); s.textContent = css; document.documentElement.appendChild(s); };
    if (document.documentElement) add(); else document.addEventListener('DOMContentLoaded', add);
  }, login.id);
  const p = await ctx.newPage();
  await p.goto(page.url.replace(/\{(\w+)\}/g, (_, k) => IDS[k]), { waitUntil: 'networkidle' });
  await p.locator('#content h1').first().waitFor({ timeout: 30000 });
  await p.waitForTimeout(page.wait);
  await p.evaluate(() => document.activeElement?.blur());
  await p.mouse.move(dev.width - 2, 2);
  const info = await p.evaluate((anchors) => {
    const c = document.querySelector('#content');
    const r = c.getBoundingClientRect();
    const found = {};
    for (const text of anchors) {
      const el = [...c.querySelectorAll('h1,h2,h3')].find((h) => h.textContent?.trim().startsWith(text));
      if (el) found[text] = Math.round(el.getBoundingClientRect().top - r.top + c.scrollTop);
    }
    return { x: r.x, y: r.y, w: r.width, h: r.height, sh: c.scrollHeight, anchors: found };
  }, page.anchors);
  const base = `${name}-${deviceKey}-base.png`;
  const content = `${name}-${deviceKey}-content.png`;
  await p.screenshot({ path: `${OUT}${base}` });
  const extra = Math.max(0, Math.ceil(info.sh - info.h));
  await p.setViewportSize({ width: dev.width, height: dev.height + extra });
  await p.waitForTimeout(Math.min(4000, 1200 + page.wait / 3));
  await p.evaluate(() => { document.querySelector('#content').scrollTop = 0; });
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}${content}`, clip: { x: info.x, y: info.y, width: info.w, height: info.sh } });
  await ctx.close();
  console.log(name, deviceKey, JSON.stringify(info));
  return { base, content, viewport: [dev.width, dev.height], rect: [info.x, info.y, info.w, info.h], contentHeight: info.sh, anchors: info.anchors };
}

const only = process.argv[2] ? process.argv[2].split(',') : null;
const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
for (const [name, page] of Object.entries(PAGES)) {
  if (only && !only.includes(name)) continue;
  for (const dev of Object.keys(DEVICES)) {
    try {
      manifest[`${name}-${dev}`] = await shoot(name, page, dev);
    } catch (e) {
      console.log('FAIL', name, dev, String(e).slice(0, 300));
    }
  }
}
writeFileSync(MANIFEST, JSON.stringify(manifest, null, 1));
await b.close();
void lots;
