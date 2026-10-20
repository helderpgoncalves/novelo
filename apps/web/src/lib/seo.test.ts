import { describe, expect, it } from 'vitest';
import en from '../../messages/en.json';
import pt from '../../messages/pt-PT.json';
import {
  auditHtml,
  buildHead,
  buildJsonLd,
  buildPreloads,
  buildSitemap,
  buildSummary,
  LOCALE_IDS,
  landingFaq,
  ROUTES,
  renderRoute,
  routePath,
  routeUrl,
  SITE,
  stripSeoTags,
} from '../../scripts/seo-core.mjs';

const MESSAGES = { 'pt-PT': pt, en } as Record<string, Record<string, string>>;
const BASE = `<!doctype html><html lang="pt-PT"><head><meta charset="UTF-8" />
<title>velho</title><meta name="description" content="velha" />
<link rel="canonical" href="https://novelo.helder.si/" /><meta property="og:title" content="velho" />
<meta name="twitter:card" content="x" /></head><body><div id="root"><div class="boot-splash"></div></div></body></html>`;

describe('metas por rota e idioma', () => {
  for (const locale of LOCALE_IDS) {
    for (const route of ROUTES) {
      it(`${locale} ${route.id}: título ≤ 60, descrição ≤ 160, URLs absolutos`, () => {
        const messages = MESSAGES[locale] as Record<string, string>;
        expect(messages[route.title]?.length).toBeLessThanOrEqual(60);
        const description = messages[route.description] ?? '';
        expect(description.length).toBeGreaterThan(60);
        expect(description.length).toBeLessThanOrEqual(160);
        const head = buildHead(route, locale, messages);
        for (const url of head.match(/(?:href|content)="(https?:[^"]+)"/g) ?? []) {
          expect(url).toMatch(/="https:\/\/(novelo\.helder\.si|github\.com|schema\.org)/);
        }
        expect(head.match(/rel="canonical"/g)).toHaveLength(1);
        expect(head).toContain(`href="${routeUrl(locale, route)}"`);
        expect(head).toContain('hreflang="x-default"');
        expect(head).toContain('og:image:alt');
        expect(head).toContain('twitter:card" content="summary_large_image"');
        expect(head.includes('noindex')).toBe(!route.index);
      });
    }
  }

  it('hreflang é recíproco: cada variante aponta para as duas', () => {
    for (const route of ROUTES) {
      const urls = LOCALE_IDS.map((l) => routeUrl(l, route));
      for (const locale of LOCALE_IDS) {
        const head = buildHead(route, locale, MESSAGES[locale] as Record<string, string>);
        for (const url of urls)
          expect(head).toContain(
            `hreflang="${url.includes('/en/') ? 'en' : 'pt-PT'}" href="${url}"`,
          );
      }
    }
  });

  it('og:locale e og:locale:alternate por idioma', () => {
    const pt1 = buildHead(ROUTES[0], 'pt-PT', pt as Record<string, string>);
    expect(pt1).toContain('og:locale" content="pt_PT"');
    expect(pt1).toContain('og:locale:alternate" content="en_GB"');
    const en1 = buildHead(ROUTES[0], 'en', en as Record<string, string>);
    expect(en1).toContain('og:locale" content="en_GB"');
    expect(en1).toContain('/og/novelo-partilha-landing-en.png');
  });
});

describe('JSON-LD', () => {
  it('landing: Organization, WebSite, SoftwareApplication e FAQPage com as 6 perguntas reais', () => {
    const ld = buildJsonLd(ROUTES[0], 'pt-PT', pt as Record<string, string>);
    const types = ld['@graph'].map((n) => n['@type']);
    expect(types).toEqual(['Organization', 'WebSite', 'SoftwareApplication', 'FAQPage']);
    const faq = ld['@graph'][3] ?? {};
    expect(faq.mainEntity).toHaveLength(6);
    expect(faq.mainEntity[0].name).toBe(pt.landing_faq_q1);
    expect(landingFaq(pt as Record<string, string>, 'pt-PT')[5]?.a).not.toContain('{count}');
  });

  it('páginas internas: BreadcrumbList com Início > página', () => {
    const privacy = ROUTES.find((r) => r.id === 'privacy');
    if (!privacy) throw new Error('rota em falta');
    const ld = buildJsonLd(privacy, 'en', en as Record<string, string>);
    const crumbs = ld['@graph'].find((n) => n['@type'] === 'BreadcrumbList') ?? {};
    expect(crumbs.itemListElement.map((i: { item: string }) => i.item)).toEqual([
      `${SITE}/en/`,
      `${SITE}/en/privacy`,
    ]);
  });

  it('o bloco é JSON válido e não fecha o <script>', () => {
    const head = buildHead(ROUTES[0], 'pt-PT', pt as Record<string, string>);
    const raw = /<script type="application\/ld\+json">(.*)<\/script>/s.exec(head)?.[1] ?? '';
    expect(() => JSON.parse(raw)).not.toThrow();
  });
});

describe('pré-render', () => {
  it('stripSeoTags remove só o que cada rota volta a escrever', () => {
    const out = stripSeoTags(BASE);
    expect(out).not.toMatch(/<title>|canonical|og:title|twitter:card|name="description"/);
    expect(out).toContain('<meta charset="UTF-8" />');
  });

  it('landing: head localizado e resumo semântico (h1, FAQ) dentro de #root', () => {
    const html = renderRoute(BASE, ROUTES[0], 'en', en as Record<string, string>);
    expect(html).toContain('<html lang="en"');
    expect(html).toContain(`<title>${en.title_landing}</title>`);
    expect(html.match(/<h1>/g)).toHaveLength(1);
    expect(html).toContain('<div id="root"><div data-prerender=""');
    expect(html).toContain(en.landing_faq_q1);
  });

  it('landing: preload do hero vem dos links do manifesto, com atributos escapados; outras rotas não os emitem', () => {
    const heroLinks = [
      {
        rel: 'preload',
        as: 'image',
        type: 'image/avif',
        media: '(min-width: 640px) and (prefers-color-scheme: light)',
        imagesrcset:
          '/landing/hero-wide-light-960.aaaa1111.avif 960w, /landing/hero-wide-light-1440.bbbb2222.avif 1440w',
        imagesizes: 'max(100vw, min(160vh, 1536px))',
        fetchpriority: 'high',
      },
      { rel: 'preload', as: 'image', media: '"><script>', imagesrcset: '/landing/x.avif 1w' },
    ];
    const html = renderRoute(BASE, ROUTES[0], 'pt-PT', pt as Record<string, string>, [], heroLinks);
    expect(html).toContain(
      '<link rel="preload" as="image" type="image/avif" media="(min-width: 640px) and (prefers-color-scheme: light)" imagesrcset="/landing/hero-wide-light-960.aaaa1111.avif 960w, /landing/hero-wide-light-1440.bbbb2222.avif 1440w" imagesizes="max(100vw, min(160vh, 1536px))" fetchpriority="high" />',
    );
    expect(html).not.toContain('<script>');
    expect(html).not.toMatch(/hero-(16x9|4x3|mobile)/);
    expect(buildPreloads(ROUTES[0], [])).not.toContain('as="image"');
    const other = ROUTES.find((r) => r.id !== 'landing');
    if (!other) throw new Error('sem rota além da landing');
    expect(buildPreloads(other, heroLinks)).not.toContain('as="image"');
  });

  it('o resumo usa números reais formatados no idioma', () => {
    expect(buildSummary('pt-PT', pt as Record<string, string>)).toContain('301,3 t');
    expect(buildSummary('en', en as Record<string, string>)).toContain('156,830');
  });
});

describe('créditos e licenças (slug traduzido)', () => {
  const credits = ROUTES.find((r) => r.id === 'credits');
  if (!credits) throw new Error('rota em falta');
  it('URL por idioma: /pt/creditos e /en/credits, indexável', () => {
    expect(routePath('pt-PT', credits)).toBe('creditos');
    expect(routePath('en', credits)).toBe('credits');
    expect(routeUrl('pt-PT', credits)).toBe(`${SITE}/pt/creditos`);
    expect(routeUrl('en', credits)).toBe(`${SITE}/en/credits`);
    expect(credits.index).toBe(true);
  });
  it('hreflang cruzado, canonical próprio e sem noindex', () => {
    const head = buildHead(credits, 'pt-PT', pt as Record<string, string>);
    expect(head).toContain(`rel="canonical" href="${SITE}/pt/creditos"`);
    expect(head).toContain(`hreflang="pt-PT" href="${SITE}/pt/creditos"`);
    expect(head).toContain(`hreflang="en" href="${SITE}/en/credits"`);
    expect(head).toContain(`hreflang="x-default" href="${SITE}/pt/creditos"`);
    expect(head).not.toContain('noindex');
    const en1 = buildHead(credits, 'en', en as Record<string, string>);
    expect(en1).toContain(`rel="canonical" href="${SITE}/en/credits"`);
    expect(en1).toContain('Credits and licences');
  });
  it('as outras rotas mantêm o mesmo caminho nos dois idiomas', () => {
    for (const r of ROUTES.filter((x) => x.id !== 'credits'))
      expect(routePath('pt-PT', r)).toBe(routePath('en', r));
  });
  it('o rodapé do resumo da landing liga aos créditos do idioma certo', () => {
    expect(buildSummary('pt-PT', pt as Record<string, string>)).toContain('href="/pt/creditos"');
    expect(buildSummary('en', en as Record<string, string>)).toContain('href="/en/credits"');
  });
});

describe('sitemap', () => {
  const xml = buildSitemap('2026-10-20');
  it('só rotas indexáveis, com lastmod, hreflang completo e x-default', () => {
    expect(xml).toContain('<loc>https://novelo.helder.si/pt/</loc>');
    expect(xml).toContain('<loc>https://novelo.helder.si/en/privacy</loc>');
    expect(xml).toContain('<loc>https://novelo.helder.si/pt/creditos</loc>');
    expect(xml).toContain('<loc>https://novelo.helder.si/en/credits</loc>');
    expect(xml).not.toContain('/pt/credits<');
    expect(xml).not.toContain('/en/creditos');
    expect(xml).not.toContain('/login');
    expect(xml.match(/<lastmod>2026-10-20<\/lastmod>/g)).toHaveLength(8);
    expect(
      xml.match(/hreflang="x-default" href="https:\/\/novelo\.helder\.si\/pt\/"/g),
    ).toHaveLength(2);
    expect(xml.match(/xhtml:link/g)).toHaveLength(8 * 3);
  });
});

describe('auditoria da CSP e páginas públicas sem splash', () => {
  const SPLASH = `<div class="boot-splash" role="status"><svg class="brand-spin"></svg><!-- brand:splash:end --></div>`;
  const base = BASE.replace('<div class="boot-splash"></div>', SPLASH);
  for (const route of ROUTES) {
    it(`${route.id}: sem splash no #root, sem inline executável, sem email literal`, () => {
      const html = renderRoute(base, route, 'pt-PT', pt as Record<string, string>, [
        '/assets/landing-x.js',
      ]);
      expect(auditHtml(html, { publicPage: true })).toEqual([]);
      expect(html).not.toContain('boot-splash');
      expect(html).not.toContain('@');
      expect(html.includes('rel="modulepreload"')).toBe(route.id === 'landing');
    });
  }
  it('apanha script inline, handlers e javascript:', () => {
    expect(auditHtml('<script>alert(1)</script>')).toHaveLength(1);
    expect(auditHtml('<script type="module">x()</script>')).toHaveLength(1);
    expect(
      auditHtml('<script type="application/ld+json">{"a":1}</script><script src="/a.js"></script>'),
    ).toEqual([]);
    expect(auditHtml('<a href="x" onclick="y()">')).toHaveLength(1);
    expect(auditHtml('<a href="javascript:void(0)">')).toHaveLength(1);
    expect(
      auditHtml('<div id="root"><div class="boot-splash"></div></div>', { publicPage: true }),
    ).toHaveLength(1);
  });
});
