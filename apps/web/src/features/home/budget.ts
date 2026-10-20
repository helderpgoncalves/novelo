import type { FrontierPoint } from '@/client';

export interface CurvePoint {
  id: string;
  label: string;
  costEur: number;
  tonnes: number;
}

/**
 * Curva orçamento × recolha a partir dos cenários guardados e viáveis: ordenados por custo anual, só ficam os que
 * recolhem mais do que todos os mais baratos (os restantes são dominados). É o que o otimizador já calculou:
 * nada aqui corre o solver.
 */
export function budgetCurve(points: FrontierPoint[]): CurvePoint[] {
  const usable = points
    .filter((p) => p.status === 'feasible' && p.annual_cost_eur > 0 && p.tonnes_year > 0)
    .sort((a, b) => a.annual_cost_eur - b.annual_cost_eur || b.tonnes_year - a.tonnes_year);
  const out: CurvePoint[] = [];
  let best = 0;
  for (const p of usable) {
    if (p.tonnes_year <= best) continue;
    best = p.tonnes_year;
    out.push({ id: p.id, label: p.label, costEur: p.annual_cost_eur, tonnes: p.tonnes_year });
  }
  return out;
}

export interface BudgetEstimate {
  /** Toneladas/ano estimadas por interpolação linear entre dois cenários guardados. */
  tonnes: number;
  /** Custo anual por tonelada ao orçamento dado (estimativa). */
  eurPerTonne: number;
  /** Cenários guardados que enquadram o orçamento (iguais quando coincide com um deles). */
  lower: CurvePoint;
  upper: CurvePoint;
  /** Cenário guardado mais perto do orçamento (o que o mapa usa para dizer que freguesias cobre). */
  nearest: CurvePoint;
}

/** Estimativa para um orçamento dentro da curva; fora do intervalo dos cenários guardados não há estimativa. */
export function estimateAt(curve: CurvePoint[], budget: number): BudgetEstimate | null {
  const first = curve[0];
  const last = curve[curve.length - 1];
  if (!first || !last || budget < first.costEur - 1e-6 || budget > last.costEur + 1e-6) return null;
  let lower = first;
  let upper = last;
  for (let i = 0; i < curve.length; i++) {
    const p = curve[i];
    if (!p) continue;
    if (p.costEur <= budget) lower = p;
    if (p.costEur >= budget) {
      upper = p;
      break;
    }
  }
  const span = upper.costEur - lower.costEur;
  const t = span <= 0 ? 0 : (budget - lower.costEur) / span;
  const tonnes = lower.tonnes + t * (upper.tonnes - lower.tonnes);
  const nearest = budget - lower.costEur <= upper.costEur - budget ? lower : upper;
  return { tonnes, eurPerTonne: budget / tonnes, lower, upper, nearest };
}

/** Limites e passo do controlo: arredondados para o passo, para a alça cair em valores redondos. */
export function budgetRange(curve: CurvePoint[], step = 500) {
  const first = curve[0];
  const last = curve[curve.length - 1];
  if (!first || !last) return null;
  const min = Math.ceil(first.costEur / step) * step;
  const max = Math.max(min, Math.floor(last.costEur / step) * step);
  return { min, max, step };
}

/** Valor inicial: o pedido na URL (limitado ao intervalo) ou o ponto médio do intervalo. */
export function initialBudget(range: { min: number; max: number; step: number }, wanted?: number) {
  const raw = wanted ?? (range.min + range.max) / 2;
  const clamped = Math.min(range.max, Math.max(range.min, raw));
  return Math.round(clamped / range.step) * range.step;
}
