// Opções do Paraglide partilhadas pelo Vite (dev/build) e por `pnpm i18n` (typecheck/testes): um só runtime gerado.
export default {
  project: './project.inlang',
  outdir: './src/paraglide',
  // O idioma vem do URL (/pt, /en); sem prefixo usa a preferência guardada ou a língua do browser.
  strategy: ['url', 'localStorage', 'preferredLanguage', 'baseLocale'],
  urlPatterns: [
    // Páginas com slug traduzido: /credits na app, /pt/creditos e /en/credits no URL (a regra geral vem a seguir).
    {
      pattern: '/credits',
      localized: [
        ['pt-PT', '/pt/creditos'],
        ['en', '/en/credits'],
      ],
    },
    {
      pattern: '/:path(.*)?',
      localized: [
        ['pt-PT', '/pt/:path(.*)?'],
        ['en', '/en/:path(.*)?'],
      ],
    },
  ],
};
