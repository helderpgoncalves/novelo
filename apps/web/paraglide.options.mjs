// Opções do Paraglide partilhadas pelo Vite (dev/build) e por `pnpm i18n` (typecheck/testes): um só runtime gerado.
export default {
  project: './project.inlang',
  outdir: './src/paraglide',
  // O idioma vem do URL (/pt, /en); sem prefixo usa a preferência guardada ou a língua do browser.
  strategy: ['url', 'localStorage', 'preferredLanguage', 'baseLocale'],
  urlPatterns: [
    {
      pattern: '/:path(.*)?',
      localized: [
        ['pt-PT', '/pt/:path(.*)?'],
        ['en', '/en/:path(.*)?'],
      ],
    },
  ],
};
