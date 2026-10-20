/**
 * Números da landing: só a Regra Zero (AGENTS.md) e o que está nos docs. Nenhum é inventado; cada grupo diz de onde vem.
 * Estimativas levam a etiqueta no ecrã.
 */
import mapData from './data/guimaraes-map.json';
import quality from './data/quality.json';

export const FACTS = {
  /** Vitrus Ambiente, 2025 (4 entidades). */
  collectedT: 301.3,
  entities: 4,
  kgPerInhabMonth: 0.16,
  /** INE, Censos 2021. */
  inhabitants: 156830,
  /** Estimativa: 0,7 kg/hab/mês × habitantes (docs/engenharia/dados-e-modelo.md, secção 1). */
  potentialT: 1317.4,
  capturePct: 22.9,
  /** Taxa de captura calibrada do contentor de rua: 22,9 % ÷ 80 %. */
  streetCapturePct: 28.6,
  /** Limite alcançável do modelo e meta francesa (docs, cenário de referência; a meta francesa está por verificar). */
  ceilingT: 562.6,
  franceT: 669.7,
  /** Rede de partida (Vitrus). */
  circuits: 40,
  vehicles: 29,
  places: 82,
  /** Destino do recolhido (Vitrus, 2025). */
  reuse: 59.4,
  recycling: 26.5,
  reject: 14.1,
  /** Cenário de 60 000 €/ano (estimativa, docs/engenharia/dados-e-modelo.md, secção 5). */
  scenario60k: { budget: 60000, eurPerT: 122.7, p10: 92.5, p50: 123.8, p90: 164.7 },
  /** Pacote municipal e geometria. */
  municipalContainers: 2751,
  parishes: mapData.parishes.length,
  placesLocated: mapData.places.length,
} as const;

export const MAP = mapData;
export const QUALITY = quality;

/** Repositório público do projeto. */
export const REPO_URL = 'https://github.com/helderpgoncalves/novelo';

/** Fontes citadas no texto como [n]; os títulos (traduzidos) estão em `landing_ref_n`. */
export const REF_LINKS: Record<number, string | null> = {
  1: 'https://urbact.eu/sites/default/files/2026-01/Guimaraes_IAP_PT.pdf',
  2: 'https://eur-lex.europa.eu/legal-content/PT/TXT/HTML/?uri=OJ:L_202501892',
  3: 'https://www.ine.pt/',
  4: null,
  5: 'https://www.dgterritorio.gov.pt/cartografia/cartografia-tematica/caop',
  6: 'https://rapport-activite.refashion.fr/collecter',
};
