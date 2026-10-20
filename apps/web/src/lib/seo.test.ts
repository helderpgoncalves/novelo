import { describe, expect, it } from 'vitest';
import en from '../../messages/en.json';
import pt from '../../messages/pt-PT.json';
import {
  buildHead,
  buildJsonLd,
  buildSitemap,
  buildSummary,
  LOCALE_IDS,
  landingFaq,
  ROUTES,
  renderRoute,
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
    expect(html).toContain('rel="preload" as="image"');
  });

  it('o resumo usa números reais formatados no idioma', () => {
    expect(buildSummary('pt-PT', pt as Record<string, string>)).toContain('301,3 t');
    expect(buildSummary('en', en as Record<string, string>)).toContain('156,830');
  });
});

describe('sitemap', () => {
  const xml = buildSitemap('2026-10-20');
  it('só rotas indexáveis, com lastmod, hreflang completo e x-default', () => {
    expect(xml).toContain('<loc>https://novelo.helder.si/pt/</loc>');
    expect(xml).toContain('<loc>https://novelo.helder.si/en/privacy</loc>');
    expect(xml).not.toContain('/login');
    expect(xml.match(/<lastmod>2026-10-20<\/lastmod>/g)).toHaveLength(6);
    expect(
      xml.match(/hreflang="x-default" href="https:\/\/novelo\.helder\.si\/pt\/"/g),
    ).toHaveLength(2);
    expect(xml.match(/xhtml:link/g)).toHaveLength(6 * 3);
  });
});
