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
} from './numbers';

export const FACTS = {
  collectedT: COLLECTED_T,
  entities: 4,
  kgPerInhabMonth: 0.16,
  inhabitants: INHABITANTS,
  rsuT: RSU_T,
  textileShareOfRsuPct: TEXTILE_SHARE_OF_RSU_PCT,
  /** Estimativa (docs/engenharia/dados-e-modelo.md, secção 1): é a procura do modelo, o que há para desviar. */
  residualT: RESIDUAL_T,
  /** Estimativa: kg por habitante e mês que ainda vão para o lixo (≈ 1,235). */
  residualKgPerInhabMonth: RESIDUAL_KG_PER_INHAB_MONTH,
  potentialT: POTENTIAL_T,
  /** Estimativa: recolhido ÷ gerado (≈ 11,5 %). */
  capturePct: CAPTURE_PCT,
  /** Meta francesa: 4,27 kg por habitante e ano × habitantes (Refashion, por verificar). */
  franceT: 669.7,
  /** Rede de partida (Vitrus). */
  circuits: 40,
  vehicles: 29,
  places: 82,
  /** Destino do recolhido (Vitrus, 2025). */
  reuse: 59.4,
  recycling: 26.5,
  reject: 14.1,
  /**
   * Cenário por freguesia de 60 000 €/ano, rede sem contentores (estimativa, base Vitrus + APA de 21 out 2026):
   * 371,7 t a 124,3 €/t; P10/P50/P90 de 500 amostras (semente 7). docs/engenharia/dados-e-modelo.md, secção 5.
   */
  scenario60k: {
    budget: 60000,
    cost: 46192,
    tonnes: 371.7,
    eurPerT: 124.3,
    p10: 97.7,
    p50: 124.7,
    p90: 161.1,
  },
  /** Cenário base do exemplo do Copiloto: 40 000 €/ano, mesma base e pressupostos (gasta 26 151 €, 314,7 t). */
  scenarioBase: { budget: 40000, cost: 26151, tonnes: 314.7 },
  /**
   * Teto do modelo por freguesia (estimativa, 21 out 2026; docs/engenharia/dados-e-modelo.md, secção 5): sem contentores
   * (local existente e recolha a pedido, orçamento sem limite) e, só como referência, com o contentor de rua à densidade francesa.
   */
  ceilingNoContainersT: 597.7,
  ceilingWithStreetT: 992.8,
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
