/** Separadores da administração de IA. Fora de `ai-admin-page.tsx` para a rota os importar sem arrastar os gráficos. */
export const AI_TABS = ['overview', 'models', 'limits', 'triage'] as const;
export type AiTab = (typeof AI_TABS)[number];
