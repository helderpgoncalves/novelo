/**
 * Modelo do mapa «Onde se perdem as 3 003 t»: lê o JSON compacto gerado por `scripts/gen-landing-data.mjs` e dá as escalas do
 * desenho. Funções puras (testadas); o componente só desenha.
 */

/** Forma crua do `guimaraes-sites.json` (listas de números, para ficar pequeno). */
export type RawSites = {
  center: number[];
  points: number[][];
  parishes: number[][];
};

export type Site = {
  x: number;
  y: number;
  /** Têxtil por desviar no local, t/ano (estimativa). */
  t: number;
  /** Índice da freguesia em `guimaraes-map.json`. */
  parish: number;
  /** Anel de distância ao centro (0-9): ordem da entrada animada. */
  ring: number;
};

export type ParishTotal = { index: number; name: string; t: number; sites: number };

export const RINGS = 10;

export function parseSites(raw: RawSites): Site[] {
  return raw.points.map(([x = 0, y = 0, t10 = 0, parish = 0, ring = 0]) => ({
    x,
    y,
    t: t10 / 10,
    parish,
    ring: Math.max(0, Math.min(RINGS - 1, ring)),
  }));
}

/** Freguesias por têxtil por desviar, da maior para a menor (empate: nome). */
export function rankParishes(raw: RawSites, names: readonly string[]): ParishTotal[] {
  return raw.parishes
    .map(([t10 = 0, sites = 0], index) => ({ index, name: names[index] ?? '', t: t10 / 10, sites }))
    .sort((a, b) => b.t - a.t || a.name.localeCompare(b.name, 'pt'));
}

/** Raio do ponto (unidades do viewBox, 1000 de largura): área proporcional ao têxtil, com um mínimo visível. */
export function siteRadius(t: number): number {
  return 2.6 + 3.4 * Math.sqrt(Math.max(0, t));
}

/** Tom do ponto: 0 abaixo de 1 t, 1 até 3 t, 2 a partir de 3 t por ano. */
export function siteTone(t: number): 0 | 1 | 2 {
  if (t < 1) return 0;
  if (t < 3) return 1;
  return 2;
}

/** Opacidade de cada tom (mais têxtil, ponto mais cheio). */
export const TONE_OPACITY = [0.42, 0.68, 0.95] as const;

/** Valores da legenda (t/ano), um por tom. */
export const LEGEND_T = [0.5, 2, 10] as const;

/** Pontos por anel, pela ordem do ficheiro (menos têxtil primeiro, para os maiores ficarem por cima). */
export function byRing(sites: readonly Site[]): Site[][] {
  const rings: Site[][] = Array.from({ length: RINGS }, () => []);
  for (const s of sites) rings[s.ring]?.push(s);
  return rings;
}
