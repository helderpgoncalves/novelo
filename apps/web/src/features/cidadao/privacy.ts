import type {
  DeletionPreviewOut,
  NoveloFeaturesPrivacySchemasTimelineItem as TimelineItem,
} from '@/client';
import { formatNumber } from '@/lib/format';
import { formatDate } from '@/lib/i18n';

// Strings em pt-PT de propósito: a área do cidadão é só portuguesa no MVP (decisão da spec #54).

/** O que se perde ao apagar a conta: o saldo primeiro (com o número), depois os contadores.

As TRÊS proteções do ADR «RGPD da conta de doador» vivem neste ecrã: o pré-aviso (esta lista + a
linha do tempo FIFO), a possibilidade de resgatar antes (link no ecrã) e o aviso de que os pontos
não são dinheiro nem conversíveis — sempre presente na última linha. */
export function losses(preview: DeletionPreviewOut): string[] {
  const rows: string[] = [];
  if (preview.saldo.balance > 0) {
    rows.push(
      `Perdes ${formatNumber(preview.saldo.balance)} pontos de saldo — os pontos não são dinheiro nem conversíveis.`,
    );
  }
  if (preview.bags > 0) {
    const active = preview.active_bags === preview.bags ? '' : ` (${preview.active_bags} ativos)`;
    rows.push(
      `Os ${preview.bags} saco${preview.bags === 1 ? '' : 's'} ficam no sistema sem nome nem conta${active} — os QRs impressos deixam de creditar.`,
    );
  }
  if (preview.requests > 0) {
    rows.push(
      `Perdes o histórico de ${preview.requests} pedido${preview.requests === 1 ? '' : 's'} de recolha (a morada é apagada já).`,
    );
  }
  if (preview.points_entries > 0) {
    rows.push(
      `Perdes o livro de pontos (${preview.points_entries} movimento${preview.points_entries === 1 ? '' : 's'}) — os totais anónimos ficam para as estatísticas.`,
    );
  }
  rows.push(
    'A tua conta, o email e a entrada sem password desaparecem — não há forma de recuperar.',
  );
  return rows;
}

/** A linha do tempo FIFO pronta a desenhar: data formatada pt-PT + pontos que caem nela. */
export function timelineRows(items: TimelineItem[]): Array<{ when: string; amount: number }> {
  return items.map((item) => ({ when: formatDate(item.expires_at), amount: item.amount }));
}
