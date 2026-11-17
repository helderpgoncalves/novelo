/**
 * PROTOTIPO (wayfinder #48) — fluxo do cidadão do primeiro contacto ao crédito.
 * Throwaway: nada daqui vai à main. Estado em memória, dados de exemplo.
 * Números com fonte real vêm das decisões do mapa #30:
 * - crédito por saco ativado e recolhido, nunca por kg (#35);
 * - 100 pontos/saco e +50 de bónus de conformidade — estimativa, configurável (#39);
 * - 105,64 €/t de custo evitado em aterro (Vitrus, 22 out 2026);
 * - 1 000 pontos ≈ 5 € no donativo a IPSS — estimativa (#39).
 */

export const POINTS_PER_BAG = 100; // estimativa (#39)
export const BONUS_CONFORMIDADE = 50; // estimativa (#39)
export const LANDFILL_EUR_PER_TONNE = 105.64; // Vitrus: 40 €/t TGR + 65,64 €/t Resinorte
export const DONATIVE_ANCHOR_POINTS = 1000; // ≈ 5 € (estimativa, #39)

/** Declaração de conteúdo na ativação: 2 níveis de qualidade (modelo Retex, #31/#39). */
export type Declaration = 'nivel-a' | 'nivel-b';

export interface Bag {
  code: string;
  alias: string | null;
  /** Declaração opcional: obrigatória só para o bónus de conformidade. */
  declaration: Declaration | null;
  status: 'ativo' | 'recolhido' | 'pesado' | 'triado';
  /** Peso medido na viatura (exemplo). */
  weightKg: number | null;
}

export interface CitizenState {
  stage: 'visitante' | 'email-enviado' | 'com-conta';
  email: string;
  bags: Bag[];
}

export const initialCitizen: CitizenState = { stage: 'visitante', email: '', bags: [] };

let bagCounter = 2481;

export function nextBagCode(): string {
  bagCounter += 1;
  return `NVL-${bagCounter - 1}`;
}

/** Pesos de exemplo para a simulação da pesagem na viatura. */
export function sampleWeight(): number {
  return Number((2.4 + Math.random() * 2.2).toFixed(1));
}

export function pointsFlat(bags: Bag[]): number {
  return bags.filter((b) => b.status === 'pesado' || b.status === 'triado').length * POINTS_PER_BAG;
}

export function pointsBonus(bags: Bag[]): number {
  return (
    bags.filter((b) => b.status === 'triado' && b.declaration !== null).length * BONUS_CONFORMIDADE
  );
}

export function kgTotal(bags: Bag[]): number {
  return bags.reduce((acc, b) => acc + (b.weightKg ?? 0), 0);
}

export function eurAvoided(kg: number): number {
  return (kg / 1000) * LANDFILL_EUR_PER_TONNE;
}

/** € evitado com cêntimos: por saco são valores pequenos (0,3 €), o formatEur arredonda a 0 €. */
export function eurAvoidedLabel(kg: number): string {
  return `${new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 2, useGrouping: 'always' }).format(eurAvoided(kg))} €`;
}

/** Agenda pública: tabela operacional freguesia → dia (dado introduzido, não otimizador — #38). */
export interface ParishAgenda {
  parish: string;
  /** 1 = segunda … 7 = domingo (WeekdayDots). */
  day: number;
  dayLabel: string;
  sites: string[];
}

export const PARISH_AGENDA: ParishAgenda[] = [
  { parish: 'Azurém', day: 2, dayLabel: '3.ª feira', sites: ['Escola de Azurém', 'Praça central'] },
  { parish: 'Creixomil', day: 3, dayLabel: '4.ª feira', sites: ['Junta de freguesia'] },
  {
    parish: 'Polvoreira',
    day: 5,
    dayLabel: '6.ª feira',
    sites: ['Estaleiro operacional', 'Escola de Polvoreira'],
  },
  { parish: 'São Torcato', day: 1, dayLabel: '2.ª feira', sites: ['Centro cívico'] },
];

/** Fallback de agenda (freguesias/dias/locais são dados de exemplo). */
export const DEFAULT_AGENDA: ParishAgenda = PARISH_AGENDA[0] ?? {
  parish: 'Azurém',
  day: 2,
  dayLabel: '3.ª feira',
  sites: [],
};
