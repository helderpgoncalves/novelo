/**
 * Números da landing: só a Regra Zero (AGENTS.md) e o que está nos docs. Nenhum é inventado; cada grupo diz de onde vem.
 * Estimativas levam a etiqueta no ecrã.
 */
import mapData from './data/guimaraes-map.json';
import quality from './data/quality.json';
import {
  CAPTURE_PCT,
  COLLECTED_T,
  INHABITANTS,
  POTENTIAL_T,
  RESIDUAL_KG_PER_INHAB_MONTH,
  RESIDUAL_T,
  RSU_T,
  TEXTILE_SHARE_OF_RSU_PCT,
  TREATMENT_EUR_PER_T,
  VITRUS_RSU_T,
} from './numbers';

export const FACTS = {
  collectedT: COLLECTED_T,
  entities: 4,
  kgPerInhabMonth: 0.16,
  inhabitants: INHABITANTS,
  /** Indiferenciado recolhido pela Vitrus em 2025 (Relatório e Contas 2025, p. 8). */
  vitrusRsuT: VITRUS_RSU_T,
  /** Estimativa: indiferenciado do concelho todo (Vitrus ÷ 0,840). */
  rsuT: RSU_T,
  textileShareOfRsuPct: TEXTILE_SHARE_OF_RSU_PCT,
  /** Estimativa (docs/dados/analise-dados-recebidos.md, respostas de 22 out 2026): é a procura do modelo, o que há para desviar. */
  residualT: RESIDUAL_T,
  /** Estimativa: kg por habitante e mês que ainda vão para o lixo (≈ 1,596). */
  residualKgPerInhabMonth: RESIDUAL_KG_PER_INHAB_MONTH,
  potentialT: POTENTIAL_T,
  /** Estimativa: recolhido ÷ gerado (≈ 9,1 %). */
  capturePct: CAPTURE_PCT,
  /** Vitrus, 22 out 2026: tratamento do indiferenciado em aterro, 40 €/t de TGR + 65,64 €/t da Resinorte (custo evitado por tonelada desviada). */
  treatmentEurPerT: TREATMENT_EUR_PER_T,
  /** Meta francesa: 4,27 kg por habitante e ano × habitantes (Refashion, por verificar). */
  franceT: 669.7,
  /** Rede de partida (Vitrus). Nenhuma viatura está livre à tarde (Vitrus, 22 out 2026): a rede de têxtil precisa de uma viatura nova. */
  circuits: 40,
  vehicles: 29,
  places: 82,
  /** Destino do recolhido (Vitrus, 2025). */
  reuse: 59.4,
  recycling: 26.5,
  reject: 14.1,
  /**
   * Cenário de referência por freguesia de 60 000 €/ano (estimativa, 22 out 2026, modelo com a viatura de têxtil nova e as
   * respostas da Vitrus de 22 out): gasta 45 828 €, 445,8 t a 102,8 €/t; P10/P50/P90 de 500 amostras (semente 7).
   * docs/engenharia/dados-e-modelo.md; números tirados da API por video/scripts/prepare-numbers.mjs.
   */
  scenario60k: {
    /** Dia em que estes números foram recalculados (a legenda da Fig. 3 mostra-o; nunca escrito à mão na mensagem). */
    computedOn: '2026-10-22',
    budget: 60000,
    cost: 45828,
    tonnes: 445.8,
    eurPerT: 102.8,
    p10: 82.0,
    p50: 104.4,
    p90: 141.3,
    /** Tratamento evitado (toneladas × 105,64 €/t, Vitrus) e custo líquido (custo anual − tratamento evitado). */
    avoidedTreatment: 47093,
    netCost: -1264,
  },
  /** Cenário base do exemplo do Copiloto: 40 000 €/ano por freguesia, mesma base e pressupostos (gasta 26 909 €, 378,5 t). */
  scenarioBase: { budget: 40000, cost: 26909, tonnes: 378.5 },
  /**
   * Têxtil reutilizável do cenário de 60 000 €/ano (estimativa): toneladas × quota de reutilização de 2025 (59,4% nas 4
   * entidades; 50,0% a 72,9% nas entidades com pesagem) e custo ÷ reutilizável. KPIs `reusable_t*` e `eur_per_reusable_t`
   * do cenário; os €/t baixo e alto são o custo ÷ `reusable_t_high` / `_low`.
   */
  reusable60k: {
    tonnes: 264.9,
    low: 222.9,
    high: 324.8,
    eurPerT: 173.0,
    eurPerTLow: 141.1,
    eurPerTHigh: 205.6,
  },
  /** Escolas do pacote municipal (`producer_types`), candidatas a pontos com pessoas (pontos assistidos). */
  schools: 86,
  /**
   * Teto do modelo por freguesia (estimativa, 22 out 2026; docs/engenharia/dados-e-modelo.md, secção 5): sem contentores
   * (local existente e recolha a pedido, orçamento sem limite) e, só como referência, com o contentor de rua à densidade francesa.
   */
  ceilingNoContainersT: 772.1,
  ceilingWithStreetT: 1282.6,
  /** Pacote municipal (Vitrus, 20 out 2026) e geometria: gerados por scripts/gen-landing-data.mjs a partir de data/processed. */
  municipalContainers: mapData.municipal.containers,
  municipalSites: mapData.municipal.sites,
  municipalDemandSites: mapData.municipal.demandSites,
  parishes: mapData.parishes.length,
  placesLocated: mapData.places.length,
} as const;

export const MAP = mapData;
export const QUALITY = quality;

/** Repositório público do projeto. */
export const REPO_URL = 'https://github.com/helderpgoncalves/novelo';

/** Fontes citadas no texto como [n]; os títulos (traduzidos) estão em `landing_ref_n`. */
export const REF_LINKS: Record<number, string | null> = {
  // APA, estatística de resíduos urbanos indicada pela Vitrus (sem ligação direta ao valor).
  1: null,
  2: 'https://eur-lex.europa.eu/legal-content/PT/TXT/HTML/?uri=OJ:L_202501892',
  3: 'https://www.ine.pt/',
  4: null,
  5: 'https://www.dgterritorio.gov.pt/cartografia/cartografia-tematica/caop',
  6: 'https://rapport-activite.refashion.fr/collecter',
};
