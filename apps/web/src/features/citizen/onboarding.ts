import type { BagActivationOut, CollectionHistoryOut } from '@/client';

// Strings em pt-PT de propósito: a área do cidadão é só portuguesa no MVP (decisão da spec #54).

/** Um marco do onboarding do doador: o que fazer e porquê (protótipo «Carteira», wayfinder #48). */
export interface Milestone {
  id: 'saco' | 'declaracao' | 'recolha';
  title: string;
  hint: string;
  done: boolean;
}

/** Os marcos deduzem-se do estado real: nunca é um checklist a pedalar contra os dados. */
export function milestones(bags: BagActivationOut[], history: CollectionHistoryOut[]): Milestone[] {
  const collected = history.some((h) => h.lot_code !== null);
  return [
    {
      id: 'saco',
      title: 'Ativa o teu primeiro saco',
      hint: 'Dá-lhe um apelido para saber qual é qual. Ninguém vê esse apelido além de ti.',
      done: bags.length > 0,
    },
    {
      id: 'declaracao',
      title: 'Declara o que vai dentro',
      hint: '«Vai no saco?» — roupa limpa para vestir de novo, ou têxtil gasto para reciclar. Quem declara e é confirmado na triagem ganha o bónus de conformidade.',
      done: bags.some((b) => b.declaration !== null),
    },
    {
      id: 'recolha',
      title: 'Entrega e segue o saco',
      hint: 'Mostra o QR à viatura ou pede a recolha: o histórico liga cada saco ao passaporte público.',
      done: collected,
    },
  ];
}

/** O onboarding colapsa após a 1.ª recolha (decisão do bilhete): a carteira vira só leitura do dia a dia. */
export function onboardingCollapsed(history: CollectionHistoryOut[]): boolean {
  return history.some((h) => h.lot_code !== null);
}

/** Os sacos ainda em casa (sem lote): os que o doador pode agir agora. */
export function bagsAtHome(
  bags: BagActivationOut[],
  history: CollectionHistoryOut[],
): BagActivationOut[] {
  const collected = new Set(history.filter((h) => h.lot_code !== null).map((h) => h.bag_code));
  return bags.filter((b) => !collected.has(b.code));
}
