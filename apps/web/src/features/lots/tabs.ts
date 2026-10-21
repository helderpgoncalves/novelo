/** Separadores de «Lotes e passaporte». Fora dos componentes para a rota os importar sem arrastar o resto. */
export const LOTS_TABS = ['lots', 'market', 'brands'] as const;
export type LotsTab = (typeof LOTS_TABS)[number];
