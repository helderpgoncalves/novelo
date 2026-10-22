import { Link } from '@tanstack/react-router';
import { Info, MapPin, RefreshCw, ShoppingBag, Truck } from 'lucide-react';
import { useMemo } from 'react';
import type { CollectionPlanEntry, Kpis } from '@/client';
import { type Column, DataTable } from '@/components/data-table';
import { EstimateTag } from '@/components/panel';
import { EmptyState } from '@/components/states';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatEur, formatKg, formatNumber, formatTonnes } from '@/lib/format';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { type PlanChannel, planWeekdayTitle, summarizePlan } from './collection-plan';

const channelLabel: Record<PlanChannel, () => string> = {
  on_demand: () => m.plan_channel_on_demand(),
  existing: () => m.plan_channel_existing(),
  street: () => m.plan_channel_street(),
};

/** Na tabela a coluna já se chama «Canal»: o selo é curto; filtros, exportação e cartão usam o nome completo. */
const channelShort: Record<PlanChannel, () => string> = {
  on_demand: () => m.plan_channel_on_demand_short(),
  existing: () => m.plan_channel_existing_short(),
  street: () => m.plan_channel_street_short(),
};

const dash = <span className="text-muted-foreground">{m.common_dash()}</span>;

const everyLabel = (weeks: number) =>
  weeks <= 1 ? m.plan_every_week() : m.plan_every_weeks({ n: formatNumber(weeks) });

function ChannelBadge({ channel }: { channel: PlanChannel }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'h-auto py-0.5 font-medium leading-snug',
        channel === 'on_demand'
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
  /** KPIs do cenário: viaturas dedicadas, dias por semana e investimento. */
  kpis?: Kpis;
  /** Cenário de origem, para recalcular os cenários antigos (sem plano) no simulador. */
  scenarioId: string;
  /** Título da secção (h3 no resultado do simulador; o detalhe usa o `Section` da página). */
  heading?: boolean;
}

/**
 * Plano da viatura nova de têxtil (caixa fechada, sem compactação): por freguesia e canal, o dia, a viatura, a
 * frequência, os kg por ronda e os km. O saco não vai no camião do lixo (Vitrus, 22 out 2026). Tudo vem do otimizador;
 * as toneladas são estimativas e os tempos e custos da viatura pressupostos.
 */
export function CollectionPlanSection({
  plan,
  kpis,
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
        <PlanBody plan={plan} kpis={kpis} />
      )}
    </section>
  );
}

function PlanBody({ plan, kpis }: { plan: CollectionPlanEntry[]; kpis?: Kpis }) {
  const summary = useMemo(() => summarizePlan(plan), [plan]);
  const { doorBag, sites } = summary;
  const vehicles = kpis?.vehicles ?? summary.vehicles;

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
      id: 'every',
      header: m.plan_col_every(),
      type: 'number',
      value: (e) => e.every_weeks,
      exportValue: (e) => everyLabel(e.every_weeks),
      filter: { format: (v) => everyLabel(Number(v)) },
      searchable: false,
      cell: (e) => everyLabel(e.every_weeks),
    },
    {
      id: 'vehicle',
      header: m.plan_col_vehicle(),
      type: 'number',
      value: (e) => e.vehicle,
      exportValue: (e) => (e.vehicle == null ? null : m.plan_vehicle_n({ n: e.vehicle })),
      filter: { format: (v) => m.plan_vehicle_n({ n: Number(v) }) },
      searchable: false,
      cell: (e) => (e.vehicle == null ? dash : m.plan_vehicle_n({ n: e.vehicle })),
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
      cell: (e) => <span className="tabular-nums">{formatKg(e.kg_per_round, 0)}</span>,
    },
    {
      id: 'km',
      header: m.plan_col_km(),
      type: 'number',
      align: 'right',
      searchable: false,
      aggregate: 'sum',
      format: (n) => `${formatNumber(n)} km`,
      value: (e) => e.km_year,
      cell: (e) => <span className="tabular-nums">{formatNumber(e.km_year)} km</span>,
    },
    {
      id: 'hours',
      header: m.plan_col_hours(),
      type: 'number',
      align: 'right',
      searchable: false,
      aggregate: 'sum',
      format: (n) => `${formatNumber(n)} h`,
      value: (e) => e.hours_year,
      cell: (e) => <span className="tabular-nums">{formatNumber(e.hours_year)} h</span>,
      defaultHidden: true,
    },
    {
      id: 'stops',
      header: m.plan_col_stops(),
      type: 'number',
      align: 'right',
      searchable: false,
      aggregate: 'sum',
      format: (n) => formatNumber(n),
      value: (e) => e.stops_year,
      cell: (e) => <span className="tabular-nums">{formatNumber(e.stops_year)}</span>,
      defaultHidden: true,
    },
    {
      id: 'rounds',
      header: m.plan_col_rounds(),
      type: 'number',
      align: 'right',
      searchable: false,
      value: (e) => e.rounds_year,
      cell: (e) => <span className="tabular-nums">{formatNumber(e.rounds_year)}</span>,
      defaultHidden: true,
    },
    {
      id: 'trips',
      header: m.plan_col_trips(),
      type: 'number',
      align: 'right',
      searchable: false,
      value: (e) => e.trips_per_round,
      cell: (e) => (e.trips_per_round == null ? dash : formatNumber(e.trips_per_round)),
      defaultHidden: true,
    },
  ];

  return (
    <div className="space-y-3">
      <ul className="grid gap-2 sm:grid-cols-2">
        {vehicles > 0 && (
          <li
            className="flex gap-3 rounded-xl bg-primary/8 p-3.5 ring-1 ring-primary/25 sm:col-span-2"
            data-testid="plan-vehicle"
          >
            <Truck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0 space-y-0.5 text-sm leading-snug">
              <p className="font-medium">{m.plan_vehicle_title()}</p>
              <p className="text-pretty">
                {vehicles > 1
                  ? m.plan_vehicle_many({
                      n: formatNumber(vehicles),
                      days: formatNumber(kpis?.vehicle_days_week ?? 0, 1),
                      hours: formatNumber(kpis?.vehicle_hours_year ?? 0),
                      capex: formatEur(kpis?.vehicle_capex_eur ?? 0),
                    })
                  : m.plan_vehicle_one({
                      days: formatNumber(kpis?.vehicle_days_week ?? 0, 1),
                      hours: formatNumber(kpis?.vehicle_hours_year ?? 0),
                      capex: formatEur(kpis?.vehicle_capex_eur ?? 0),
                    })}
              </p>
            </div>
          </li>
        )}
        {doorBag.parishes > 0 && (
          <li className="flex gap-3 rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
            <ShoppingBag className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <p className="font-medium text-sm leading-snug" data-testid="plan-summary-door">
              {(doorBag.parishes === 1 ? m.plan_summary_door_one : m.plan_summary_door)({
                n: formatNumber(doorBag.parishes),
                tonnes: formatTonnes(doorBag.tonnes, 1),
                every: everyLabel(summary.everyWeeks ?? 2),
                km: formatNumber(doorBag.km),
              })}
            </p>
          </li>
        )}
        {sites.parishes > 0 && (
          <li className="flex gap-3 rounded-xl bg-card p-3.5 ring-1 ring-foreground/10">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium text-sm leading-snug" data-testid="plan-summary-sites">
              {(sites.parishes === 1 ? m.plan_summary_sites_one : m.plan_summary_sites)({
                n: formatNumber(sites.parishes),
                tonnes: formatTonnes(sites.tonnes, 1),
                km: formatNumber(sites.km),
              })}
            </p>
          </li>
        )}
      </ul>
      <p className="flex gap-2 text-muted-foreground text-xs leading-relaxed">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>{m.plan_note()}</span>
      </p>
      <DataTable
        id="collection-plan"
        exportName="cenario-plano-de-recolha"
        caption={m.plan_title()}
        columns={columns}
        rows={plan}
        getRowId={(e) => `${e.parish_code}:${e.channel}`}
        searchLabel={m.plan_search()}
        pageSize={10}
        initialSort={{ id: 'tonnes', desc: true }}
        selectable={false}
        empty={<EmptyState title={m.plan_empty_title()} description={m.plan_empty_text()} />}
      />
    </div>
  );
}
