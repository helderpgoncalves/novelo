/** Separadores da página inicial da app. Fora de `home-page.tsx` para a rota os importar sem arrastar os gráficos. */
export const HOME_TABS = ['entities', 'flows', 'waste', 'parishes'] as const;
export type HomeTab = (typeof HOME_TABS)[number];
