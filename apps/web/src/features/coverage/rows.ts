import type { CoverageSummary, ParishCoverage, ZoneOut } from '@/client';

export interface ParishRow {
  code: string;
  name: string;
  population: number;
  /** Pontos que a referência daria à freguesia (mesma fórmula do servidor: população / habitantes por ponto). */
  reference: number;
  /** Cobertura calculada; `null` enquanto não houver contentores. */
  coverage: ParishCoverage | null;
}

/** Uma linha por freguesia: a população vem das zonas (INE), a cobertura do cálculo, se existir. */
export function buildRows(zones: ZoneOut[], summary: CoverageSummary): ParishRow[] {
  const byCode = new Map(summary.parishes.map((p) => [p.parish_code, p]));
  const perPoint = summary.reference.people_per_point;
  return zones.map((z) => {
    const coverage = summary.state === 'ok' ? (byCode.get(z.code) ?? null) : null;
    return {
      code: z.code,
      name: z.name,
      population: z.population,
      reference: coverage?.reference_points ?? Math.round(z.population / perPoint),
      coverage,
    };
  });
}
