/**
 * Números-base de Guimarães para as páginas públicas (landing, entrada), num só sítio e sem dependências pesadas. A app
 * autenticada lê-os da API; aqui ficam estáticos porque a landing não faz pedidos. Fonte: docs/engenharia/dados-e-modelo.md
 * (secção 1) e a resposta da Vitrus de 21 out 2026.
 */

/** Vitrus Ambiente, 2025: RSU recolhido (mentor, 21 out 2026) e têxtil recolhido à parte (4 entidades). */
export const RSU_T = 43051;
export const COLLECTED_T = 301.27;
/** APA, indicado pela Vitrus: têxtil no RSU (%). */
export const TEXTILE_SHARE_OF_RSU_PCT = 5.4;
/** INE, Censos 2021. */
export const INHABITANTS = 156830;
/** Estimativa: têxtil que ainda vai para o lixo (43 051 t × 5,4% ≈ 2 324,8 t por ano). */
export const RESIDUAL_T = (RSU_T * TEXTILE_SHARE_OF_RSU_PCT) / 100;
/** Estimativa: têxtil gerado no total (o que vai para o lixo mais o recolhido à parte ≈ 2 626,0 t). */
export const POTENTIAL_T = RESIDUAL_T + COLLECTED_T;

/** Estimativa: kg por habitante e mês que ainda vão para o lixo (≈ 1,235). */
export const RESIDUAL_KG_PER_INHAB_MONTH = (RESIDUAL_T * 1000) / INHABITANTS / 12;
/** Estimativa: recolhido ÷ gerado (≈ 11,5 %). */
export const CAPTURE_PCT = (COLLECTED_T / POTENTIAL_T) * 100;
