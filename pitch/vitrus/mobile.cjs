#!/usr/bin/env node
/** Capturas de telemóvel (390 × 844 @2x) da app local: bag-check, passaporte, triagem. */
const path = require('node:path');
const { createRequire } = require('node:module');
const { chromium } = createRequire(path.join(__dirname, '../../apps/web/package.json'))('@playwright/test');
const WEB = process.env.WEB || 'http://localhost:3190';
const OUT = path.join(__dirname, 'img');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'pt-PT', isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  for (const [n, r] of [['bag-check', '/pt/bag-check'], ['passport', `/pt/passport/${process.env.LOT || 'NOV-XWEZV2'}`]]) {
    await page.goto(WEB + r, { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT, `m-${n}.png`) });
  }
  await page.goto(`${WEB}/pt/login?method=password`);
  await page.getByLabel('Email').fill('admin@heldergoncalves.io');
  await page.getByLabel('Palavra-passe', { exact: true }).fill(process.env.NOVELO_DEV_PASSWORD || '');
  await page.getByRole('button', { name: /entrar/i }).first().click();
  await page.waitForURL((u) => !/login/.test(u.pathname), { timeout: 20000 });
  await page.goto(`${WEB}/pt/triage`, { waitUntil: 'domcontentloaded' }); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, 'm-triage.png') });
  await browser.close(); console.log('ok');
})();
