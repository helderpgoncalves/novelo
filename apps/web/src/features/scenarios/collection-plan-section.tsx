import { Link } from '@tanstack/react-router';
import { Info, RefreshCw, Route as RouteIcon, Truck } from 'lucide-react';
import { useMemo } from 'react';
import type { CollectionPlanEntry } from '@/client';
import { type Column, DataTable } from '@/components/data-table';
import { EstimateTag } from '@/components/panel';
import { EmptyState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatKg, formatNumber, formatTonnes } from '@/lib/format';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import {
  type FitsState,
  fitsState,
  type PlanChannel,
  planWeekdayTitle,
  summarizePlan,
} from './collection-plan';

const channelLabel: Record<PlanChannel, () => string> = {
  door_to_door: () => m.plan_channel_pap(),
  detour: () => m.plan_channel_detour(),
};

const fitsLabel: Record<FitsState, () => string> = {
  yes: () => m.plan_fits_yes(),
  no: () => m.plan_fits_no(),
  unknown: () => m.plan_fits_unknown(),
  na: () => m.common_dash(),
};

const dash = <span className="text-muted-foreground">{m.common_dash()}</span>;

/** Na tabela a coluna já se chama «Canal»: o selo é curto; filtros, exportação e cartão usam o nome completo. */
const channelShort: Record<PlanChannel, () => string> = {
  door_to_door: () => m.plan_channel_pap_short(),
  detour: () => m.plan_channel_detour(),
};

function ChannelBadge({ channel }: { channel: PlanChannel }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'h-auto py-0.5 font-medium leading-snug',
        channel === 'door_to_door'
          ? 'border-primary/40 bg-primary/10 text-primary'
          : 'border-areia/70 bg-areia/15 text-foreground/85',
      )}
    >
      {/* Telemóvel (cartão): o nome completo; tabela (md+): o curto, com o completo para leitores de ecrã. */}
      <span className="md:hidden">{channelLabel[channel]()}</span>
      <span className="hidden md:inline" aria-hidden="true">
        {channelShort[channel]()}
      </span>
      <span className="sr-only hidden md:inline">{channelLabel[channel]()}</span>
    </Badge>
  );
}

interface CollectionPlanSectionProps {
  plan: CollectionPlanEntry[] | null | undefined;
  /** Cenário de origem, para recalcular os cenários antigos (sem plano) no simulador. */
  scenarioId: string;
  /** Título da secção (h3 no resultado do simulador; o detalhe usa o `Section` da página). */
  heading?: boolean;
}

/**
 * Plano de recolha a pedido por freguesia: no circuito porta a porta que já passa (saco fechado num dia fixo, 0 km
 * novos) ou a pedido com desvio. Tudo vem do resultado do otimizador; as toneladas são estimativas.
 */
export function CollectionPlanSection({
  plan,
  scenarioId,
  heading = true,
}: CollectionPlanSectionProps) {
  return (
    <section className="space-y-3" aria-labelledby={heading ? 'plan-title' : undefined}>
      {heading && (
        <div className="space-y-1">
          <h3 id="plan-title" className="flex flex-wrap items-center gap-2 text-xl">
            {m.plan_title()} <EstimateTag label={m.common_estimate()} />
          </h3>
          <p className="max-w-3xl text-muted-foreground text-sm">{m.plan_description()}</p>
        </div>
      )}
      {plan == null ? (
        <EmptyState
          title={m.plan_legacy_title()}
          description={m.plan_legacy_text()}
          action={
            <Button asChild variant="outline" className="h-10 gap-2">
              <Link to="/simulator" search={{ from: scenarioId }}>
                <RefreshCw aria-hidden="true" />
                {m.plan_legacy_action()}
              </Link>
            </Button>
          }
        />
      ) : plan.length === 0 ? (
        <EmptyState title={m.plan_empty_title()} description={m.plan_empty_text()} />
      ) : (
        <PlanBody plan={plan} />
      )}
    </section>
  );
}

function PlanBody({ plan }: { plan: CollectionPlanEntry[] }) {
  const summary = useMemo(() => summarizePlan(plan), [plan]);
  const { doorToDoor, detour } = summary;

  const columns: Column<CollectionPlanEntry>[] = [
    {
      id: 'parish',
      className: 'min-w-40 whitespace-normal',
      header: m.plan_col_parish(),
      primary: true,
      pinned: 'left',
      value: (e) => e.parish_name,
      cell: (e) => <span className="font-medium">{e.parish_name}</span>,
    },
    {
      id: 'channel',
      header: m.plan_col_channel(),
      value: (e) => e.channel,
      exportValue: (e) => channelLabel[e.channel](),
      filter: { format: (v) => channelLabel[v as PlanChannel]() },
      searchable: false,
      cell: (e) => <ChannelBadge channel={e.channel} />,
      full: true,
    },
    {
      id: 'circuit',
      header: m.plan_col_circuit(),
      value: (e) => e.circuit,
      filter: true,
      cell: (e) => (e.circuit ? <span className="font-medium">{e.circuit}</span> : dash),
    },
    {
      id: 'weekday',
      header: m.plan_col_day(),
      type: 'number',
      value: (e) => e.weekday,
      exportValue: (e) => planWeekdayTitle(e.weekday),
      filter: { format: (v) => planWeekdayTitle(Number(v)) ?? v },
      searchable: false,
      cell: (e) => planWeekdayTitle(e.weekday) ?? dash,
    },
    {
      id: 'vehicle',
      header: m.plan_col_vehicle(),
      value: (e) => e.vehicle,
      filter: true,
      cell: (e) => (e.vehicle ? <span className="tabular-nums">{e.vehicle}</span> : dash),
    },
    {
      id: 'tonnes',
      header: m.plan_col_tonnes(),
      type: 'number',
      align: 'right',
      searchable: false,
      badge: true,
      aggregate: 'sum',
      format: (n) => formatTonnes(n, 1),
      value: (e) => e.tonnes_year,
      cell: (e) => <span className="tabular-nums">{formatTonnes(e.tonnes_year, 1)}</span>,
    },
    {
      id: 'kg_round',
      header: m.plan_col_kg_round(),
      type: 'number',
      align: 'right',
      searchable: false,
      filter: 'range',
      format: (n) => formatKg(n, 0),
      value: (e) => e.kg_per_round,
      cell: (e) =>
        e.kg_per_round == null ? (
          dash
        ) : (
          <span
            className="tabular-nums"
            title={
              e.round_kg != null && e.circuit
                ? m.plan_round_hint({
                    circuit: e.circuit,
                    day: planWeekdayTitle(e.weekday) ?? '',
                    kg: formatKg(e.round_kg, 0),
                  })
                : undefined
            }
          >
            {formatKg(e.kg_per_round, 0)}
          </span>
        ),
    },
    {
      id: 'fits',
      header: m.plan_col_fits(),
      // «Não se aplica» (a pedido com desvio) fica vazio: o cartão em telemóvel esconde o campo.
      value: (e) => (fitsState(e) === 'na' ? null : fitsState(e)),
      exportValue: (e) => fitsLabel[fitsState(e)](),
      filter: { format: (v) => fitsLabel[v as FitsState]() },
      searchable: false,
      cell: (e) => {
        const state = fitsState(e);
        if (state === 'na') return dash;
        return (
          <span
            className={cn(
              'font-medium',
              state === 'yes' && 'text-primary',
              state === 'no' && 'text-destructive',
              state === 'unknown' && 'text-muted-foreground',
            )}
            title={state === 'unknown' ? m.plan_fits_unknown_hint() : undefined}
          >
            {fitsLabel[state]()}
          </span>
        );
      },
    },
    {
      id: 'new_km',
      header: m.plan_col_new_km(),
      type: 'number',
      align: 'right',
      searchable: false,
      aggregate: 'sum',
      format: (n) => `${formatNumber(n)} km`,
      value: (e) => e.new_km_year,
      cell: (e) => <span className="tabular-nums">{formatNumber(e.new_km_year)} km</span>,
      defaultHidden: true,
    },
    {
      id: 'pickups',
      header: m.plan_col_pickups(),
      type: 'number',
      align: 'right',
      searchable: false,
      aggregate: 'sum',
      format: (n) => formatNumber(n),
      value: (e) => e.pickups_year,
      cell: (e) => <span className="tabular-nums">{formatNumber(e.pickups_year)}</span>,
      defaultHidden: true,
    },
    {
      id: 'circuits',
      header: m.plan_col_circuits(),
      value: (e) => (e.circuits ?? []).join(', '),
      filter: 'text',
      cell: (e) => ((e.circuits ?? []).length ? (e.circuits ?? []).join(', ') : dash),
      defaultHidden: true,
    },
    {
      id: 'crew',
      header: m.plan_col_crew(),
      type: 'number',
      align: 'right',
      searchable: false,
      value: (e) => e.crew,
      cell: (e) => (e.crew == null ? dash : formatNumber(e.crew)),
      defaultHidden: true,
    },
  ];

  return (
    <div className="space-y-3">
      <ul className="grid gap-2 sm:grid-cols-2">
        {doorToDoor.parishes > 0 && (
          <li className="flex gap-3 rounded-xl bg-primary/8 p-3.5 ring-1 ring-primary/25">
            <Truck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <p className="font-medium text-sm leading-snug" data-testid="plan-summary-pap">
              {m.plan_summary_pap({
                n: formatNumber(doorToDoor.parishes),
                tonnes: formatTonnes(doorToDoor.tonnes, 1),
                km: formatNumber(doorToDoor.newKm),
              })}
            </p>
          </li>
        )}
        {detour.parishes > 0 && (
          <li className="flex gap-3 rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
            <RouteIcon
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <p className="font-medium text-sm leading-snug" data-testid="plan-summary-detour">
              {m.plan_summary_detour({
                n: formatNumber(detour.parishes),
                tonnes: formatTonnes(detour.tonnes, 1),
                km: formatNumber(detour.newKm),
              })}
            </p>
          </li>
        )}
      </ul>
      {summary.maxRoundKg != null && (
        <p className="flex gap-2 text-muted-foreground text-xs leading-relaxed">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            {summary.roundsOver > 0
              ? m.plan_capacity_over({ n: formatNumber(summary.roundsOver) })
              : summary.roundsUnknown > 0
                ? m.plan_capacity_unknown({ kg: formatKg(summary.maxRoundKg, 0) })
                : m.plan_capacity_ok({ kg: formatKg(summary.maxRoundKg, 0) })}{' '}
            {m.plan_note()}
          </span>
        </p>
      )}
      <DataTable
        id="collection-plan"
        exportName="cenario-plano-de-recolha"
        caption={m.plan_title()}
        columns={columns}
        rows={plan}
        getRowId={(e) => e.parish_code}
        searchLabel={m.plan_search()}
        pageSize={10}
        initialSort={{ id: 'tonnes', desc: true }}
        selectable={false}
        empty={<EmptyState title={m.plan_empty_title()} description={m.plan_empty_text()} />}
      />
    </div>
  );
}
