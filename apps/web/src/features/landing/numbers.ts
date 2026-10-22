/**
 * Números-base de Guimarães para as páginas públicas (landing, entrada), num só sítio e sem dependências pesadas. A app
 * autenticada lê-os da API; aqui ficam estáticos porque a landing não faz pedidos. Fonte: docs/dados/analise-dados-recebidos.md
 * (respostas da Vitrus de 22 out 2026) e docs/engenharia/dados-e-modelo.md (secção 1).
 */

/** Vitrus Ambiente, Relatório e Contas 2025, p. 8: indiferenciado recolhido pela Vitrus em 2025 (t). */
export const VITRUS_RSU_T = 43050.5;
/** Idem: parte do indiferenciado do concelho que a Vitrus recolhe (84,0 %). */
export const VITRUS_SHARE_OF_MUNICIPAL_RSU = 0.84;
/** Estimativa: indiferenciado do concelho todo (43 050,5 ÷ 0,840 ≈ 51 250,6 t), a base indicada pela Vitrus a 22 out 2026. */
export const RSU_T = VITRUS_RSU_T / VITRUS_SHARE_OF_MUNICIPAL_RSU;
/** Vitrus Ambiente, 2025: têxtil recolhido à parte (4 entidades). */
export const COLLECTED_T = 301.27;
/** APA, RARU 2025, p. 24: têxtil no indiferenciado (%), indicado pela Vitrus a 22 out 2026. */
export const TEXTILE_SHARE_OF_RSU_PCT = 5.86;
/** INE, Censos 2021. */
export const INHABITANTS = 156830;
/** Estimativa: têxtil que ainda vai para o lixo (51 250,6 t × 5,86 % ≈ 3 003,3 t por ano). */
export const RESIDUAL_T = (RSU_T * TEXTILE_SHARE_OF_RSU_PCT) / 100;
/** Estimativa: têxtil gerado no total (o que vai para o lixo mais o recolhido à parte ≈ 3 304,6 t). */
export const POTENTIAL_T = RESIDUAL_T + COLLECTED_T;

/** Estimativa: kg por habitante e mês que ainda vão para o lixo (≈ 1,596). */
export const RESIDUAL_KG_PER_INHAB_MONTH = (RESIDUAL_T * 1000) / INHABITANTS / 12;
/** Estimativa: recolhido ÷ gerado (≈ 9,1 %). */
export const CAPTURE_PCT = (COLLECTED_T / POTENTIAL_T) * 100;

/** Vitrus, 22 out 2026: taxa de gestão de resíduos (TGR) do indiferenciado em aterro (€/t). */
export const LANDFILL_TAX_EUR_PER_T = 40;
/** Vitrus, 22 out 2026: tarifa da Resinorte para o indiferenciado (€/t). */
export const RESINORTE_GATE_FEE_EUR_PER_T = 65.64;
/** Custo de tratamento evitado por tonelada desviada do lixo (40 + 65,64 = 105,64 €/t). */
export const TREATMENT_EUR_PER_T = LANDFILL_TAX_EUR_PER_T + RESINORTE_GATE_FEE_EUR_PER_T;
