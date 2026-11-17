/**
 * PROTOTIPO (wayfinder #51) — dados fictícios da conta de local assistido.
 * Tudo inventado para se reagir ao formato: nenhum número vem da Vitrus nem da APA.
 * Throwaway: não ligar à API, não migrar para produção.
 */

export interface DestinationSplit {
  reutilizacao: number;
  reciclagem: number;
  rejeito: number;
}

export type Month = 'set' | 'out' | 'nov';

export interface Visit {
  id: string;
  /** '10 nov' */
  dateLabel: string;
  weekday: string;
  fullDate: string;
  month: Month;
  sacos: number;
  weightKg: number;
  /** null = ainda em triagem (destinos medem-se a jusante, na mesa de triagem). */
  destinos: DestinationSplit | null;
  lotCode: string;
  /** A visita teve origem num aviso «sacos prontos». */
  viaAviso?: string;
}

export const SITE = {
  displayName: 'Agrupamento de Escolas de Selho',
  shortName: 'AE de Selho',
  parish: 'Selho (São Jorge) · Guimarães',
  nextRound: 'terça-feira, 24 de novembro',
  certUrl: 'https://novelo.helder.si/certificado/ae-selho',
  people: [
    { name: 'Maria João Ferreira', role: 'Direção', email: 'mjferreira@ae-selho.pt' },
    { name: 'Rui Cardoso', role: 'Secretaria', email: 'rcardoso@ae-selho.pt' },
  ],
} as const;

/** Mais recente primeiro, como o local vai ver. */
export const VISITS: Visit[] = [
  {
    id: 'v5',
    dateLabel: '10 nov',
    weekday: 'terça-feira',
    fullDate: '10 de novembro de 2026',
    month: 'nov',
    sacos: 10,
    weightKg: 22.1,
    destinos: null,
    lotCode: 'NOV-7QK3XM',
    viaAviso: '4 sacos · sala 12 (aviso de 5 nov)',
  },
  {
    id: 'v4',
    dateLabel: '27 out',
    weekday: 'terça-feira',
    fullDate: '27 de outubro de 2026',
    month: 'out',
    sacos: 7,
    weightKg: 16.4,
    destinos: { reutilizacao: 11.5, reciclagem: 3.6, rejeito: 1.3 },
    lotCode: 'NOV-2FH8WD',
  },
  {
    id: 'v3',
    dateLabel: '13 out',
    weekday: 'terça-feira',
    fullDate: '13 de outubro de 2026',
    month: 'out',
    sacos: 9,
    weightKg: 19.6,
    destinos: { reutilizacao: 13.7, reciclagem: 4.3, rejeito: 1.6 },
    lotCode: 'NOV-9AT5KP',
  },
  {
    id: 'v2',
    dateLabel: '29 set',
    weekday: 'terça-feira',
    fullDate: '29 de setembro de 2026',
    month: 'set',
    sacos: 5,
    weightKg: 11.8,
    destinos: { reutilizacao: 8.9, reciclagem: 2.1, rejeito: 0.8 },
    lotCode: 'NOV-6CQ4RB',
  },
  {
    id: 'v1',
    dateLabel: '15 set',
    weekday: 'terça-feira',
    fullDate: '15 de setembro de 2026',
    month: 'set',
    sacos: 6,
    weightKg: 14.2,
    destinos: { reutilizacao: 10.6, reciclagem: 2.6, rejeito: 1.0 },
    lotCode: 'NOV-3MZ7YT',
  },
];

export const AVISO_HISTORY = [
  {
    dateLabel: '5 nov',
    sacos: 4,
    note: 'Roupa de inverno — sala 12',
    outcome: 'Recolhido na ronda de 10 nov',
  },
] as const;

export type PeriodKey = 'letivo' | 'set' | 'out' | 'nov';

export const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'letivo', label: 'Ano letivo' },
  { key: 'set', label: 'Setembro' },
  { key: 'out', label: 'Outubro' },
  { key: 'nov', label: 'Novembro' },
];

export function visitsInPeriod(period: PeriodKey): Visit[] {
  return period === 'letivo' ? VISITS : VISITS.filter((v) => v.month === period);
}

export interface PeriodTotals {
  visitas: number;
  sacos: number;
  kgTotal: number;
  /** Só o que já foi triado e medido; o «em triagem» fica de fora. */
  kgMedido: number;
  split: DestinationSplit | null;
  pct: DestinationSplit | null;
  kgEmTriagem: number;
}

export function totalsFor(visits: Visit[]): PeriodTotals {
  const medidos = visits.filter(
    (v): v is Visit & { destinos: DestinationSplit } => v.destinos !== null,
  );
  const sum = (pick: (d: DestinationSplit) => number) =>
    medidos.reduce((acc, v) => acc + pick(v.destinos), 0);
  const split: DestinationSplit | null =
    medidos.length > 0
      ? {
          reutilizacao: sum((d) => d.reutilizacao),
          reciclagem: sum((d) => d.reciclagem),
          rejeito: sum((d) => d.rejeito),
        }
      : null;
  const kgMedido = split ? split.reutilizacao + split.reciclagem + split.rejeito : 0;
  return {
    visitas: visits.length,
    sacos: visits.reduce((acc, v) => acc + v.sacos, 0),
    kgTotal: visits.reduce((acc, v) => acc + v.weightKg, 0),
    kgMedido,
    split,
    pct:
      split && kgMedido > 0
        ? {
            reutilizacao: (split.reutilizacao / kgMedido) * 100,
            reciclagem: (split.reciclagem / kgMedido) * 100,
            rejeito: (split.rejeito / kgMedido) * 100,
          }
        : null,
    kgEmTriagem: visits.filter((v) => v.destinos === null).reduce((acc, v) => acc + v.weightKg, 0),
  };
}
