import type { Overview, OverviewMilestone, OverviewParish } from '@/client';

const DAY_MS = 86_400_000;

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * Dias de calendário entre hoje (hora local) e uma data ISO (`2028-04-17` ou um carimbo completo); negativo se já
 * passou. `null` se a data estiver vazia ou for inválida.
 */
export function daysUntil(
  isoDate: string | null | undefined,
  now: Date = new Date(),
): number | null {
  const match = typeof isoDate === 'string' ? ISO_DAY.exec(isoDate) : null;
  if (!match) return null;
  const [y, mo, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const target = Date.UTC(y, mo - 1, d);
  if (Number.isNaN(target) || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target - today) / DAY_MS);
}

/** O marco em que passam a pagar os produtores (RAP), a data final do relógio. */
export const pickEprMilestone = (timeline: OverviewMilestone[]): OverviewMilestone | undefined =>
  timeline.find((t) => t.who_pays === 'producers');

/** Freguesias por potencial decrescente e a quota das `n` maiores. */
export function rankParishes(parishes: OverviewParish[], n = 5) {
  const potential = (p: OverviewParish) => (Number.isFinite(p.potential_t) ? p.potential_t : 0);
  const sorted = [...parishes].sort((a, b) => potential(b) - potential(a));
  const total = sorted.reduce((s, p) => s + potential(p), 0);
  const top = sorted.slice(0, n).reduce((s, p) => s + potential(p), 0);
  return { sorted, topSharePct: total > 0 ? (top / total) * 100 : 0, topCount: n };
}

/** Prazo do regime de responsabilidade alargada do produtor (Diretiva (UE) 2025/1892), se a API não o trouxer. */
export const EPR_FALLBACK_DATE = '2028-04-17';

export interface EprDeadline {
  date: string;
  days: number;
  sourceLabel: string;
  verified: boolean;
}

/** O marco em que os produtores passam a pagar, com os dias contados na hora (não os do servidor, que podem ficar velhos na cache). */
export function eprDeadline(timeline: OverviewMilestone[], now: Date = new Date()): EprDeadline {
  const epr = pickEprMilestone(timeline ?? []);
  // Uma data vazia ou inválida da API não derruba a faixa: recai no prazo conhecido.
  const usable = daysUntil(epr?.date, now) !== null;
  const date = usable && epr ? epr.date : EPR_FALLBACK_DATE;
  return {
    date,
    days: Math.max(0, daysUntil(date, now) ?? 0),
    sourceLabel: epr?.source_label || 'Diretiva (UE) 2025/1892',
    verified: epr?.verified ?? true,
  };
}

export type TrustKey =
  | 'collected'
  | 'destinations'
  | 'circuits'
  | 'population'
  | 'boundaries'
  | 'municipal_containers'
  | 'potential'
  | 'parish_demand'
  | 'costs'
  | 'capture_by_parish'
  | 'textile_containers';
export type TrustStatus = 'measured' | 'estimate' | 'missing';

export interface TrustItem {
  key: TrustKey;
  status: TrustStatus;
}

/** O que é medido, o que é estimativa e o que ainda falta; as localizações de contentores de têxteis vêm das freguesias. */
export function trustItems(overview: Pick<Overview, 'parishes'>): TrustItem[] {
  const textileContainers = overview.parishes.reduce((s, p) => s + p.containers_count, 0);
  return [
    { key: 'collected', status: 'measured' },
    { key: 'destinations', status: 'measured' },
    { key: 'circuits', status: 'measured' },
    { key: 'population', status: 'measured' },
    { key: 'boundaries', status: 'measured' },
    { key: 'municipal_containers', status: 'measured' },
    { key: 'potential', status: 'estimate' },
    { key: 'parish_demand', status: 'estimate' },
    { key: 'costs', status: 'estimate' },
    { key: 'capture_by_parish', status: 'missing' },
    { key: 'textile_containers', status: textileContainers > 0 ? 'measured' : 'missing' },
  ];
}

export function trustCounts(items: TrustItem[]): Record<TrustStatus, number> {
  const out: Record<TrustStatus, number> = { measured: 0, estimate: 0, missing: 0 };
  for (const i of items) out[i.status] += 1;
  return out;
}

export interface QuestionInputs {
  /** Nomes das freguesias com mais têxtil por desviar, por ordem. */
  topParishes: string[];
  /** Meta redonda a um quarto do caminho entre o recolhido e o potencial (t/ano). */
  targetT: number;
  /** Orçamento escolhido no controlo (€/ano), se houver. */
  budgetEur: number | null;
}

/** Dados das perguntas sugeridas ao Copiloto: tudo vem do resumo, nada é inventado. */
export function questionInputs(overview: Overview, budgetEur: number | null): QuestionInputs {
  const { gap, parishes } = overview;
  const topParishes = rankParishes(parishes)
    .sorted.slice(0, 3)
    .map((p) => p.name);
  const targetT = Math.round((gap.collected_t + gap.missing_t * 0.25) / 10) * 10;
  return { topParishes, targetT, budgetEur };
}
