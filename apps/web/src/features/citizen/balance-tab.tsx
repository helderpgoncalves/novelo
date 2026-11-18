import type { UseQueryResult } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ChevronRight, Gift } from 'lucide-react';
import type { GetDonorPointsBalanceError, PointEntryOut, PointsBalanceOut } from '@/client';
import { listDonorPointsOptions } from '@/client/@tanstack/react-query.gen';
import { EmptyState, ErrorState } from '@/components/states';
import { formatNumber } from '@/lib/format';
import { formatDate } from '@/lib/i18n';
import { cn } from '@/lib/utils';

// Strings em pt-PT de propósito: a área do cidadão é só portuguesa no MVP (decisão da spec #54).

/** Etiqueta pt-PT de cada lançamento do livro-razão. `redemption` é reservado ao #65 — traduzido por
 * defesa, nunca deve aparecer antes de lá chegar. */
const POINT_KIND_LABEL: Record<PointEntryOut['kind'], string> = {
  gain_flat: 'Saco recolhido',
  gain_bonus: 'Bónus de conformidade',
  annulment: 'Anulação',
  redemption: 'Resgate',
};

export function BalanceTab({
  balanceQuery,
}: {
  balanceQuery: UseQueryResult<PointsBalanceOut, GetDonorPointsBalanceError>;
}) {
  const { data: balance, error: balanceError, refetch: refetchBalance } = balanceQuery;
  // O histórico de pontos: dez recentes chegam ao ecrã (a lista completa é o livro-razão paginado).
  const {
    data: pontos,
    isLoading: pontosLoading,
    error: pontosError,
    refetch: refetchPontos,
  } = useQuery({
    ...listDonorPointsOptions({ query: { limit: 10, offset: 0 } }),
    refetchOnWindowFocus: false,
  });

  if (balanceError) {
    return <ErrorState error={balanceError} onRetry={() => void refetchBalance()} />;
  }
  const capShare =
    balance && balance.monthly_cap > 0
      ? Math.min(100, Math.round((balance.credited_this_month / balance.monthly_cap) * 100))
      : null;

  return (
    <>
      <div className="ring-foreground/10 space-y-2 rounded-2xl bg-card p-6 text-center ring-1">
        <p className="text-muted-foreground text-xs">
          Saldo{' '}
          <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[10px]">estimativa</span>
        </p>
        <p className="font-serif text-5xl" aria-live="polite">
          {balance ? formatNumber(balance.balance) : '…'}
        </p>
        <p className="text-muted-foreground text-sm">
          pontos · só leitura — nunca são dinheiro nem conversíveis
        </p>
        {balance && (
          <dl className="text-muted-foreground grid grid-cols-2 gap-2 pt-2 text-xs">
            <div className="rounded-xl bg-muted/60 p-2">
              <dt className="sr-only">De ganhos flat</dt>
              <dd>
                <span className="font-medium text-foreground">{formatNumber(balance.flat)}</span>{' '}
                por sacos
              </dd>
            </div>
            <div className="rounded-xl bg-muted/60 p-2">
              <dt className="sr-only">De bónus de conformidade</dt>
              <dd>
                <span className="font-medium text-foreground">{formatNumber(balance.bonus)}</span>{' '}
                de bónus
              </dd>
            </div>
          </dl>
        )}
        {balance && balance.expiring_soon > 0 && (
          <p className="rounded-xl bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
            {formatNumber(balance.expiring_soon)} pontos expiram nos próximos 30 dias (os mais
            antigos primeiro).
          </p>
        )}
        {balance && balance.expired > 0 && (
          <p className="text-muted-foreground text-xs">
            {formatNumber(balance.expired)} pontos já expiraram (12 meses por ganho).
          </p>
        )}
      </div>

      {/* Teto mensal (configurável, estimativa): o que transborda é recusado — nunca adiado. */}
      {balance && (
        <div className="ring-foreground/10 space-y-2 rounded-2xl bg-card p-5 text-sm ring-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-medium">Teto deste mês</p>
            <p className="text-muted-foreground text-xs">
              {formatNumber(balance.credited_this_month)}
              {balance.monthly_cap > 0 ? ` de ${formatNumber(balance.monthly_cap)}` : ''}{' '}
              <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[10px]">estimativa</span>
            </p>
          </div>
          {capShare != null && (
            <div
              role="progressbar"
              aria-valuenow={capShare}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Ganhos do mês em relação ao teto mensal"
              className="bg-muted h-2 rounded-full"
            >
              <div className="bg-primary h-2 rounded-full" style={{ width: `${capShare}%` }} />
            </div>
          )}
          {balance.monthly_cap === 0 && (
            <p className="text-muted-foreground text-xs">Este mês não tem teto de ganhos.</p>
          )}
        </div>
      )}

      <div className="ring-foreground/10 space-y-2 rounded-2xl bg-card p-5 text-sm ring-1">
        <p className="font-medium">Como se ganha</p>
        <ul className="text-muted-foreground space-y-1.5">
          {balance && (
            <>
              <li>
                +{formatNumber(balance.gain_flat_points)} por saco ativado, recolhido e pesado
                (nunca por kg — estimativa)
              </li>
              <li>
                +{formatNumber(balance.bonus_conformity_points)} de bónus quando a triagem confirma
                a tua declaração (estimativa)
              </li>
            </>
          )}
          <li>
            1 000 pontos ≈ 5 € <span className="text-foreground">de donativo</span> a IPSS — a
            âncora € é o valor do donativo, nunca o valor dos pontos (estimativa)
          </li>
        </ul>
        <Link
          to="/cidadao"
          search={{ tab: 'catalogo' }}
          className="text-primary inline-flex min-h-11 items-center gap-1.5 text-sm font-medium"
        >
          <Gift className="size-4" aria-hidden />
          Ver o catálogo e resgatar
          <ChevronRight className="size-4" aria-hidden />
        </Link>
      </div>

      {/* Histórico de pontos: o livro-razão do próprio, o mais recente primeiro. */}
      <section className="space-y-2">
        <h2 className="font-serif text-xl">Movimentos</h2>
        {pontosError ? (
          <ErrorState error={pontosError} onRetry={() => void refetchPontos()} />
        ) : pontosLoading ? (
          <div className="ring-foreground/10 rounded-2xl bg-card p-8 ring-1" role="status">
            <p className="text-muted-foreground text-center text-sm">A carregar movimentos…</p>
          </div>
        ) : !pontos || pontos.items.length === 0 ? (
          <EmptyState
            title="Ainda sem movimentos"
            description="Quando a viatura pesar um saco teu, o ganho aparece aqui — e o bónus quando a triagem confirma a declaração."
          />
        ) : (
          <ul className="space-y-2">
            {pontos.items.map((row) => (
              <PointEntryRow key={row.id} row={row} />
            ))}
          </ul>
        )}
        {pontos && pontos.total > pontos.items.length && (
          <p className="text-muted-foreground px-2 text-xs">
            A mostrar {pontos.items.length} de {formatNumber(pontos.total)} movimentos.
          </p>
        )}
      </section>

      <p className="text-muted-foreground px-2 text-xs">
        Os pontos expiram 12 meses por ganho, os mais antigos primeiro. Apagar a conta perde o saldo
        — lotes e passaportes ficam (nunca tiveram doador).
      </p>
    </>
  );
}

function PointEntryRow({ row }: { row: PointEntryOut }) {
  const gain = row.amount > 0;
  return (
    <li className="ring-foreground/10 rounded-xl bg-card p-4 ring-1">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium">{POINT_KIND_LABEL[row.kind]}</p>
        <p
          className={cn(
            'font-mono text-sm',
            gain ? 'text-primary font-medium' : 'text-destructive',
          )}
        >
          {gain ? '+' : ''}
          {formatNumber(row.amount)}
        </p>
      </div>
      <p className="text-muted-foreground mt-1 text-xs">
        {formatDate(row.created_at)}
        {row.bag_code ? ` · saco ${row.bag_code}` : ''}
        {row.lot_code ? (
          <>
            {' · '}
            <Link
              to="/passport/$code"
              params={{ code: row.lot_code }}
              className="text-primary underline-offset-2 hover:underline"
            >
              lote {row.lot_code}
            </Link>
          </>
        ) : null}
        {row.expires_at ? ` · expira ${formatDate(row.expires_at)}` : ''}
      </p>
      {row.reason && (
        <p className="text-muted-foreground mt-1 text-xs italic">Motivo: {row.reason}</p>
      )}
    </li>
  );
}
