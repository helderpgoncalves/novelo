/** Separadores e camadas da página inicial da app. Fora dos componentes para a rota os importar sem arrastar o mapa nem os gráficos. */
export const HOME_TABS = ['entities', 'flows', 'waste', 'parishes'] as const;
export type HomeTab = (typeof HOME_TABS)[number];

/** Camadas do mapa. A ordem é a dos botões. */
export const LAYER_IDS = [
  'gap',
  'population',
  'density',
  'containers',
  'circuits',
  'data_gaps',
] as const;
export type LayerId = (typeof LAYER_IDS)[number];
