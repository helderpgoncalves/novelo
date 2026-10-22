import type { CollectionPlanEntry, ReferenceScenarioOut } from '@/client';

/**
 * Modelo da apresentação de primeira visita: os seis passos, a navegação por teclado, a contagem até ao prazo e a escolha
 * dos cenários de referência. Funções puras (testadas em `story-model.test.ts`); os componentes só desenham.
 */

export const STORY_STEPS = ['problem', 'where', 'answer', 'cost', 'copilot', 'pilot'] as const;
export type StoryStepId = (typeof STORY_STEPS)[number];
export const STORY_TOTAL = STORY_STEPS.length;

/** Mantém o índice dentro dos passos (o progresso guardado pode vir de uma versão antiga, com mais passos). */
export const clampStory = (index: number): number =>
  Math.min(Math.max(Number.isFinite(index) ? Math.trunc(index) : 0, 0), STORY_TOTAL - 1);

export type StoryKeyAction = { type: 'go'; index: number } | { type: 'close' } | null;

/**
 * Tecla → ação: ←/→ recuam e avançam (sem dar a volta), Home/End vão ao primeiro e ao último, Esc fecha.
 * Com modificadores (atalhos do sistema ou do navegador) não faz nada.
 */
export function storyKeyAction(
  key: string,
  index: number,
  modifiers: { alt?: boolean; ctrl?: boolean; meta?: boolean } = {},
): StoryKeyAction {
  if (modifiers.alt || modifiers.ctrl || modifiers.meta) return null;
  const current = clampStory(index);
  switch (key) {
    case 'Escape':
      return { type: 'close' };
    case 'ArrowRight':
      return current < STORY_TOTAL - 1 ? { type: 'go', index: current + 1 } : null;
    case 'ArrowLeft':
      return current > 0 ? { type: 'go', index: current - 1 } : null;
    case 'Home':
      return current > 0 ? { type: 'go', index: 0 } : null;
    case 'End':
      return current < STORY_TOTAL - 1 ? { type: 'go', index: STORY_TOTAL - 1 } : null;
    default:
      return null;
  }
}

/** Prazo do regime europeu de responsabilidade alargada do produtor têxtil (Diretiva (UE) 2025/1892): 17 abr 2028. */
export const RAP_DEADLINE = { year: 2028, month: 4, day: 17 } as const;
const DAY_MS = 86_400_000;

/** Dias de calendário que faltam até ao prazo, contados em datas locais (0 no próprio dia e depois). */
export function daysUntil(
  now: Date,
  deadline: { year: number; month: number; day: number } = RAP_DEADLINE,
): number {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const end = Date.UTC(deadline.year, deadline.month - 1, deadline.day);
  return Math.max(0, Math.round((end - today) / DAY_MS));
}

/** O plano da apresentação: o cenário por freguesia de 60 000 €/ano (`onboarding: true` na API). */
export const ONBOARDING_REFERENCE_KEY = 'parish:60000';

type RefLike = Pick<ReferenceScenarioOut, 'reference_key' | 'onboarding' | 'status'>;

/** Escolhe o cenário de referência da apresentação: a chave certa e, sem ela, o marcado `onboarding`. Só calculados. */
export function pickOnboardingReference<T extends RefLike>(
  refs: readonly T[] | undefined,
): T | null {
  const computed = (refs ?? []).filter((r) => r.status === 'computed');
  return (
    computed.find((r) => r.reference_key === ONBOARDING_REFERENCE_KEY) ??
    computed.find((r) => r.onboarding) ??
    null
  );
}

/** Cenário de referência por locais reais com um dado orçamento (`sites:<€/ano>`), para o exemplo do Copiloto. */
export function pickSitesReference<T extends RefLike>(
  refs: readonly T[] | undefined,
  budget: number,
): T | null {
  return (
    (refs ?? []).find((r) => r.reference_key === `sites:${budget}` && r.status === 'computed') ??
    null
  );
}

export interface PlanLine {
  parish: string;
  weekday: number;
  everyWeeks: number;
  vehicle: number;
  tonnes: number;
}

/**
 * As linhas reais «Freguesia · dia · a cada N semanas · viatura» do saco à porta na viatura dedicada, das que mais
 * têxtil desviam (empate: nome). Só entram as que têm dia e viatura: nada se completa à mão.
 */
export function planLines(
  plan: readonly CollectionPlanEntry[] | null | undefined,
  limit = 3,
): PlanLine[] {
  return (plan ?? [])
    .filter(
      (p): p is CollectionPlanEntry & { weekday: number; vehicle: number } =>
        p.channel === 'on_demand' && p.weekday != null && p.vehicle != null,
    )
    .sort(
      (a, b) => b.tonnes_year - a.tonnes_year || a.parish_name.localeCompare(b.parish_name, 'pt'),
    )
    .slice(0, limit)
    .map((p) => ({
      parish: p.parish_name,
      weekday: p.weekday,
      everyWeeks: p.every_weeks,
      vehicle: p.vehicle,
      tonnes: p.tonnes_year,
    }));
}

/**
 * Pontos de uma grelha de 100 que representam uma percentagem: os inteiros cheios e, se sobrar, um ponto a meio.
 * Ex.: 9,1% → 9 cheios e 1 a 10%.
 */
export function waffle(pct: number, cells = 100): { full: number; partial: number } {
  const value = Math.min(Math.max(Number.isFinite(pct) ? pct : 0, 0), 100) * (cells / 100);
  const full = Math.floor(value + 1e-9);
  const rest = value - full;
  return { full, partial: full < cells && rest > 1e-9 ? rest : 0 };
}
