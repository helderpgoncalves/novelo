import { formatEur, formatNumber } from '@/lib/format';
import type { CatalogItemPublic, RedemptionOut } from '@/client';

// Helpers puros do catálogo do doador (#65): testados em `catalogo.test.ts`.
// Strings em pt-PT de propósito — a área do cidadão é só portuguesa no MVP (decisão da spec #54).

/** As três prateleiras do catálogo (donativo IPSS, prémio de parceiro, acumulado ambiental). */
export const catalogItemKindLabel = (kind: CatalogItemPublic['kind']): string => {
  switch (kind) {
    case 'ipss_donation':
      return 'Donativo IPSS';
    case 'partner_prize':
      return 'Prémio de parceiro';
    case 'environmental':
      return 'Acumulado ambiental';
  }
};

/**
 * A âncora € é APRESENTAÇÃO do valor do DONATIVO (1 000 pontos ≈ 5 €) — nunca o valor dos pontos
 * (regra zero, ADR «economia dos pontos»). Só existe em donativos IPSS.
 */
export const donationValueNote = (item: CatalogItemPublic): string | null =>
  item.kind === 'ipss_donation' && item.donation_value_cents != null
    ? `donativo de ${formatEur(item.donation_value_cents / 100)}`
    : null;

/** Motivo pelo qual o resgate está bloqueado (ou nulo, se se pode resgatar). Esgotado ganha ao saldo. */
export const redeemBlocked = (item: CatalogItemPublic, balance: number): string | null => {
  if (item.stock === 0) return 'Esgotado';
  if (balance < item.points_cost) return `Faltam ${formatNumber(item.points_cost - balance)} pontos`;
  return null;
};

/** Estado do código de resgate, na língua do doador. */
export const redemptionStateLabel = (redemption: Pick<RedemptionOut, 'state'>): string =>
  redemption.state === 'validated' ? 'validado' : 'pendente';
