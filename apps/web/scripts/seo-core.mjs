// Funções puras de SEO partilhadas pelo pré-render (scripts/prerender.mjs) e pelos testes (src/lib/seo.test.ts):
// metas por rota e idioma, JSON-LD, resumo semântico para rastreadores e sitemap. Sem I/O nem dependências.
// Os textos vêm de messages/{pt-PT,en}.json, as mesmas mensagens que a app usa em execução (head() das rotas).

export const SITE = 'https://novelo.helder.si';

/** Idiomas: prefixo no URL, etiqueta BCP 47 do `<html lang>`, `og:locale` e etiqueta do Intl. */
export const LOCALES = {
  'pt-PT': { prefix: 'pt', lang: 'pt-PT', og: 'pt_PT', intl: 'pt-PT', file: 'pt-PT' },
  en: { prefix: 'en', lang: 'en', og: 'en_GB', intl: 'en-GB', file: 'en' },
};
export const LOCALE_IDS = /** @type {const} */ (['pt-PT', 'en']);
/** `x-default` aponta ao idioma base. */
export const DEFAULT_LOCALE = 'pt-PT';

/**
 * Rotas públicas pré-renderizadas. `index: false` leva `noindex` (entrada e registo têm título e OG mas não valor de
 * pesquisa). `og`: imagem de partilha em /og/novelo-partilha-{og}-{pt|en}.png.
 */
export const ROUTES = [
  { id: 'landing', path: '', index: true, og: 'landing', title: 'title_landing', description: 'landing_description', alt: 'seo_og_alt_landing' },
  { id: 'login', path: 'login', index: false, og: 'entrar', title: 'title_login', description: 'seo_login_description', alt: 'seo_og_alt_entrar' },
  { id: 'register', path: 'register', index: false, og: 'entrar', title: 'title_register', description: 'seo_register_description', alt: 'seo_og_alt_entrar', },
  { id: 'privacy', path: 'privacy', index: true, og: 'landing', title: 'title_privacy_policy', description: 'seo_privacy_description', alt: 'seo_og_alt_landing', crumb: 'public_nav_privacy' },
  { id: 'terms', path: 'terms', index: true, og: 'landing', title: 'title_terms', description: 'seo_terms_description', alt: 'seo_og_alt_landing', crumb: 'public_nav_terms' },
];

/** Substitui `{nome}` pelos parâmetros (o mesmo formato das mensagens do Paraglide). */
export const format = (text, params = {}) =>
  String(text).replace(/\{(\w+)\}/g, (_, k) => (k in params ? String(params[k]) : `{${k}}`));

export const escapeHtml = (text) =>
  String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** URL absoluto de uma rota num idioma: `/pt/` para a landing, `/pt/privacy` para as outras. */
export function routeUrl(locale, route) {
  const { prefix } = LOCALES[locale];
  return route.path === '' ? `${SITE}/${prefix}/` : `${SITE}/${prefix}/${route.path}`;
}

export const ogImageUrl = (locale, route) =>
  `${SITE}/og/novelo-partilha-${route.og}-${LOCALES[locale].prefix}.png`;

const text = (messages, key, params) => format(messages[key] ?? '', params);

/** Perguntas e respostas da FAQ real da landing (as mesmas mensagens que o ecrã mostra). */
export function landingFaq(messages, locale) {
  const count = new Intl.NumberFormat(LOCALES[locale].intl).format(2751);
  return [1, 2, 3, 4, 5, 6].map((n) => ({
    q: text(messages, `landing_faq_q${n}`),
    a: text(messages, `landing_faq_a${n}`, { count }),
  }));
}

/** Grafo JSON-LD: Organization, WebSite e SoftwareApplication em todas; FAQPage na landing; BreadcrumbList nas internas. */
/** @returns {{ '@context': string, '@graph': Array<Record<string, any>> }} */
export function buildJsonLd(route, locale, messages) {
  const url = routeUrl(locale, route);
  const graph = [
    {
      '@type': 'Organization',
      '@id': `${SITE}/#org`,
      name: 'Novelo',
      url: `${SITE}/`,
      logo: `${SITE}/icons/icon-512.png`,
      email: 'novelo@heldergoncalves.io',
      sameAs: ['https://github.com/helderpgoncalves/novelo'],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE}/#site`,
      url: `${SITE}/`,
      name: 'Novelo',
      inLanguage: LOCALE_IDS.map((l) => LOCALES[l].lang),
      publisher: { '@id': `${SITE}/#org` },
    },
    {
      '@type': 'SoftwareApplication',
      name: 'Novelo',
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      inLanguage: LOCALES[locale].lang,
      description: text(messages, 'landing_description'),
      url: routeUrl(locale, ROUTES[0]),
      publisher: { '@id': `${SITE}/#org` },
    },
  ];
  if (route.id === 'landing') {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      inLanguage: LOCALES[locale].lang,
      mainEntity: landingFaq(messages, locale).map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    });
  }
  if (route.crumb) {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Novelo', item: routeUrl(locale, ROUTES[0]) },
        { '@type': 'ListItem', position: 2, name: text(messages, route.crumb), item: url },
      ],
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

const meta = (attr, key, value) => `<meta ${attr}="${key}" content="${escapeHtml(value)}" />`;

/** Bloco `<head>` por rota e idioma: título, descrição, canonical, hreflang, Open Graph, Twitter, robots e JSON-LD. */
export function buildHead(route, locale, messages) {
  const loc = LOCALES[locale];
  const other = LOCALE_IDS.find((l) => l !== locale);
  const url = routeUrl(locale, route);
  const title = text(messages, route.title);
  const description = text(messages, route.description);
  const image = ogImageUrl(locale, route);
  const alt = text(messages, route.alt);
  const lines = [
    `<title>${escapeHtml(title)}</title>`,
    meta('name', 'description', description),
    ...(route.index ? [] : [meta('name', 'robots', 'noindex, nofollow')]),
    `<link rel="canonical" href="${url}" />`,
    ...LOCALE_IDS.map((l) => `<link rel="alternate" hreflang="${LOCALES[l].lang}" href="${routeUrl(l, route)}" />`),
    `<link rel="alternate" hreflang="x-default" href="${routeUrl(DEFAULT_LOCALE, route)}" />`,
    meta('property', 'og:type', 'website'),
    meta('property', 'og:site_name', 'Novelo'),
    meta('property', 'og:url', url),
    meta('property', 'og:title', title),
    meta('property', 'og:description', description),
    meta('property', 'og:image', image),
    meta('property', 'og:image:type', 'image/png'),
    meta('property', 'og:image:width', '1200'),
    meta('property', 'og:image:height', '630'),
    meta('property', 'og:image:alt', alt),
    meta('property', 'og:locale', loc.og),
    meta('property', 'og:locale:alternate', LOCALES[other].og),
    meta('name', 'twitter:card', 'summary_large_image'),
    meta('name', 'twitter:title', title),
    meta('name', 'twitter:description', description),
    meta('name', 'twitter:image', image),
    meta('name', 'twitter:image:alt', alt),
    `<script type="application/ld+json">${JSON.stringify(buildJsonLd(route, locale, messages)).replace(/</g, '\\u003c')}</script>`,
  ];
  return lines.join('\n    ');
}

/**
 * Preloads só do que é crítico no primeiro ecrã: as duas fontes e, na landing, a fotografia do hero (versão clara, uma
 * por direção de arte; o navegador só pede a que corresponde à media query).
 */
export function buildPreloads(route) {
  const fonts = ['newsreader-display-roman', 'inter-landing'].map(
    (f) => `<link rel="preload" href="/fonts/${f}.woff2" as="font" type="font/woff2" crossorigin />`,
  );
  if (route.id !== 'landing') return fonts.join('\n    ');
  const img = (media, name, widths) =>
    `<link rel="preload" as="image" type="image/avif" media="${media}" imagesrcset="${widths.map((w) => `/landing/${name}-${w}.avif ${w}w`).join(', ')}" imagesizes="100vw" fetchpriority="high" />`;
  return [
    ...fonts,
    img('(max-width: 767px) and (prefers-color-scheme: light)', 'hero-mobile-light', [432, 864, 1296]),
    img('(min-width: 768px) and (max-width: 1023px) and (prefers-color-scheme: light)', 'hero-4x3-light', [768, 1536]),
    img('(min-width: 1024px) and (prefers-color-scheme: light)', 'hero-16x9-light', [640, 1280, 1920]),
  ].join('\n    ');
}

const nf = (locale, value, digits = 0) =>
  new Intl.NumberFormat(LOCALES[locale].intl, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);

/**
 * Resumo semântico da landing para quem lê só o HTML (rastreadores sem JavaScript, pré-visualizações): h1, apoio,
 * números reais, método, funcionalidades, FAQ e ligações. Vai fora do ecrã dentro de `#root` e some quando o React monta.
 */
export function buildSummary(locale, messages) {
  const t = (key, params) => escapeHtml(text(messages, key, params));
  const prefix = LOCALES[locale].prefix;
  const li = (items) => items.map((x) => `<li>${x}</li>`).join('');
  const features = ['simulator', 'scenarios', 'whatif', 'triage', 'lots', 'exchange', 'report', 'map', 'copilot', 'onboarding', 'roles', 'pwa'];
  const stats = [
    `${nf(locale, 301.3, 1)} t ${t('landing_stat_collected_label')} (${t('landing_stat_collected_source')})`,
    `${nf(locale, 4)} ${t('landing_stat_entities_label')} (${t('landing_stat_entities_source')})`,
    `${nf(locale, 156830)} ${t('landing_stat_people_label')} (${t('landing_stat_people_source')})`,
  ];
  const faq = landingFaq(messages, locale)
    .map(({ q, a }) => `<h3>${escapeHtml(q)}</h3><p>${escapeHtml(a)}</p>`)
    .join('');
  return [
    `<div data-prerender="" style="position:absolute;width:1px;height:1px;margin:-1px;overflow:hidden;clip:rect(0 0 0 0)">`,
    `<header><p>${t('landing_eyebrow')}</p><h1>Novelo: ${t('landing_title')}</h1><p>${t('landing_lead')}</p>`,
    `<p><a href="/${prefix}/login">${t('landing_sign_in')}</a> · <a href="/${prefix}/register">${t('landing_register')}</a></p></header>`,
    `<main><section><h2>${t('landing_numbers_title')}</h2><ul>${li(stats)}</ul><p>${t('landing_numbers_note')}</p></section>`,
    `<section><h2>${t('landing_problem_title')}</h2><p>${t('landing_problem_lead')}</p><p>${t('landing_problem_directive')}</p></section>`,
    `<section><h2>${t('landing_method_title')}</h2><p>${t('landing_method_lead')}</p><ol>${li([1, 2, 3].map((n) => `<strong>${t(`landing_how_${n}_title`)}</strong> ${t(`landing_how_${n}_text`)}`))}</ol></section>`,
    `<section><h2>${t('landing_features_title')}</h2><ul>${li(features.map((f) => `<strong>${t(`landing_feat_${f}_title`)}</strong> ${t(`landing_feat_${f}_text`)}`))}</ul></section>`,
    `<section><h2>${t('landing_rigor_title')}</h2><p>${t('landing_rigor_lead')}</p><h3>${t('landing_not_title')}</h3><ul>${li([1, 2, 3, 4].map((n) => t(`landing_not_${n}`)))}</ul><h3>${t('landing_limits_title')}</h3><ul>${li([1, 2, 3, 4, 5].map((n) => t(`landing_limit_${n}`)))}</ul></section>`,
    `<section><h2>${t('landing_faq_title')}</h2>${faq}</section></main>`,
    `<footer><p><a href="/${prefix}/privacy">${t('public_nav_privacy')}</a> · <a href="/${prefix}/terms">${t('public_nav_terms')}</a> · <a href="mailto:novelo@heldergoncalves.io">novelo@heldergoncalves.io</a></p></footer>`,
    `</div>`,
  ].join('');
}

const SEO_TAGS = [
  /<title>[\s\S]*?<\/title>\s*/g,
  /<meta\s+name="description"[^>]*>\s*/g,
  /<link\s+rel="canonical"[^>]*>\s*/g,
  /<link\s+rel="alternate"\s+hreflang[^>]*>\s*/g,
  /<meta\s+property="og:[^"]*"[^>]*>\s*/g,
  /<meta\s+name="twitter:[^"]*"[^>]*>\s*/g,
  /<meta\s+name="robots"[^>]*>\s*/g,
  /<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/g,
];

/** Remove do HTML base as metas que cada rota volta a escrever. */
export function stripSeoTags(html) {
  return SEO_TAGS.reduce((acc, re) => acc.replace(re, ''), html);
}

/** HTML final de uma rota: `lang`, `<head>` localizado, preloads e, na landing, o resumo dentro de `#root`. */
export function renderRoute(baseHtml, route, locale, messages) {
  const lang = LOCALES[locale].lang;
  let html = stripSeoTags(baseHtml).replace(/<html lang="[^"]*"/, `<html lang="${lang}"`);
  html = html.replace(
    '</head>',
    `    ${buildHead(route, locale, messages)}\n    ${buildPreloads(route)}\n  </head>`,
  );
  if (route.id === 'landing') {
    html = html.replace('<div id="root">', `<div id="root">${buildSummary(locale, messages)}`);
  }
  return html;
}

/** sitemap.xml: só as rotas indexáveis; cada URL lista todas as variantes (incluindo ela própria) e `x-default`. */
export function buildSitemap(lastmod) {
  const urls = [];
  for (const route of ROUTES.filter((r) => r.index)) {
    for (const locale of LOCALE_IDS) {
      const alternates = [
        ...LOCALE_IDS.map((l) => `    <xhtml:link rel="alternate" hreflang="${LOCALES[l].lang}" href="${routeUrl(l, route)}"/>`),
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${routeUrl(DEFAULT_LOCALE, route)}"/>`,
      ];
      urls.push(`  <url>\n    <loc>${routeUrl(locale, route)}</loc>\n    <lastmod>${lastmod}</lastmod>\n${alternates.join('\n')}\n  </url>`);
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
}
