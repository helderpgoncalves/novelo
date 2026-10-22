import { ChevronDown, CircleCheck, TriangleAlert } from 'lucide-react';
import type { PilotFact, PilotOut, PilotZoneOut } from '@/client';
import { type Column, DataTable } from '@/components/data-table';
import { Section } from '@/components/page';
import { EstimateTag, Panel } from '@/components/panel';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { formatEur, formatNumber, formatTonnes } from '@/lib/format';
import { cn } from '@/lib/utils';
import { tipauLabel } from '@/lib/vocab';
import { m } from '@/paraglide/messages';
import { factLabel, factValue, kpiLabel, kpiValue } from './pilot-labels';

const fact = (z: PilotZoneOut, key: string): PilotFact | undefined =>
  z.facts.find((f) => f.key === key);

function Disclosure({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Collapsible className="rounded-xl bg-card ring-1 ring-foreground/10">
      <CollapsibleTrigger className="group flex min-h-12 w-full items-center justify-between gap-3 px-5 py-3 text-left font-medium text-sm">
        {title}
        <ChevronDown
          className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
          aria-hidden="true"
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 px-5 pb-5">{children}</CollapsibleContent>
    </Collapsible>
  );
}

function ZoneCard({ zone, index }: { zone: PilotZoneOut; index: number }) {
  const population = fact(zone, 'population');
  const density = fact(zone, 'density');
  const days = fact(zone, 'service_days');
  const startup = fact(zone, 'startup_cost_eur');
  return (
    <li className="min-w-0 space-y-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10 sm:p-5">
      <div className="space-y-2">
        <p className="eyebrow">{m.pilot_zone_n({ n: index + 1 })}</p>
        <h3 className="text-balance font-serif text-xl leading-tight">{zone.parish_name}</h3>
        {zone.tipau && (
          <Badge variant="outline" className="border-primary/40 text-primary">
            {tipauLabel[zone.tipau]()}
          </Badge>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
        <div>
          <dt className="text-muted-foreground text-xs">{m.pilot_fact_population()}</dt>
          <dd className="font-medium tabular-nums">{population ? factValue(population) : '–'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">{m.pilot_fact_density()}</dt>
          <dd className="font-medium tabular-nums">{density ? factValue(density) : '–'}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs">{m.pilot_circuit()}</dt>
          <dd className="font-medium tabular-nums">
            {days && days.value > 0
              ? m.pilot_circuit_days({ n: formatNumber(days.value) })
              : m.pilot_circuit_none()}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-muted-foreground text-xs">
            {m.pilot_fact_startup_cost_eur()}
          </dt>
          <dd className="font-medium tabular-nums">{startup ? formatEur(startup.value) : '–'}</dd>
        </div>
      </dl>
      <Collapsible>
        <CollapsibleTrigger className="group flex min-h-10 items-center gap-1.5 font-medium text-sm">
          {m.pilot_zone_sources()}
          <ChevronDown
            className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
            aria-hidden="true"
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <ul className="space-y-2 border-t pt-3">
            {zone.facts.map((f) => (
              <li key={f.key} className="text-sm">
                <p className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{factLabel(f.key)}</span>
                  <span className="font-medium tabular-nums">{factValue(f)}</span>
                </p>
                <p className="text-muted-foreground text-xs">{f.source}</p>
              </li>
            ))}
          </ul>
        </CollapsibleContent>
      </Collapsible>
    </li>
  );
}

function ScorePanel({ score }: { score: PilotOut['score'] }) {
  const rows = [
    {
      key: 'tipau',
      label: m.pilot_score_tipau(),
      value: score.tipau_diversity,
      weight: score.weight_tipau,
    },
    {
      key: 'density',
      label: m.pilot_score_density(),
      value: score.density_contrast,
      weight: score.weight_density,
    },
    {
      key: 'coverage',
      label: m.pilot_score_coverage(),
      value: score.coverage,
      weight: score.weight_coverage,
    },
    { key: 'cost', label: m.pilot_score_cost(), value: score.cost, weight: score.weight_cost },
  ];
  return (
    <Panel
      title={m.pilot_score_title()}
      description={m.pilot_score_description()}
      aside={
        <p className="text-right">
          <span className="font-serif text-3xl tabular-nums">{formatNumber(score.score, 2)}</span>
          <span className="text-muted-foreground text-sm"> / 1</span>
        </p>
      }
    >
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.key} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{r.label}</span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {m.pilot_score_row({
                  value: formatNumber(r.value, 2),
                  weight: formatNumber(r.weight, 2),
                })}
              </span>
            </div>
            <div
              role="img"
              aria-label={`${r.label}: ${formatNumber(r.value, 2)}`}
              className="h-2.5 overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(Math.max(r.value, 0), 1) * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-xs leading-relaxed">{m.pilot_score_note()}</p>
    </Panel>
  );
}

function FloorPanel({ floor }: { floor: PilotOut['signal_floor'] }) {
  const columns: Column<PilotFact>[] = [
    { id: 'step', header: m.pilot_calc_step(), primary: true, cell: (f) => factLabel(f.key) },
    { id: 'value', header: m.pilot_calc_value(), align: 'right', cell: (f) => factValue(f) },
    {
      id: 'source',
      header: m.pilot_calc_source(),
      className: 'text-muted-foreground',
      cell: (f) => f.source,
    },
  ];
  return (
    <Panel
      title={m.pilot_floor_title()}
      description={m.pilot_floor_description()}
      aside={<EstimateTag label={m.common_estimate()} />}
    >
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-border ring-1 ring-border">
        {[
          { label: m.pilot_floor_min(), value: formatTonnes(floor.min_tonnes_pilot, 2) },
          { label: m.pilot_floor_pilot(), value: formatTonnes(floor.tonnes_pilot, 2) },
          {
            label: m.pilot_floor_discarded(),
            value: `${formatNumber(floor.combos_below_floor)} / ${formatNumber(floor.combos_total)}`,
          },
          {
            label: m.pilot_floor_origin(),
            value: floor.computed ? m.pilot_floor_computed() : m.pilot_floor_imposed(),
          },
        ].map((x) => (
          <div key={x.label} className="bg-card p-3 sm:p-4">
            <dt className="font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
              {x.label}
            </dt>
            <dd className="mt-1 font-serif text-xl tabular-nums leading-none">{x.value}</dd>
          </div>
        ))}
      </dl>
      {floor.floor_met ? (
        <p className="flex items-start gap-2 text-sm">
          <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          {m.pilot_floor_met()}
        </p>
      ) : (
        <Alert variant="destructive">
          <TriangleAlert className="size-4" />
          <AlertTitle>{m.pilot_floor_not_met_title()}</AlertTitle>
          <AlertDescription>{m.pilot_floor_not_met_text()}</AlertDescription>
        </Alert>
      )}
      <Collapsible className="rounded-lg border">
        <CollapsibleTrigger className="group flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2 text-left font-medium text-sm">
          {m.pilot_floor_calc()}
          <ChevronDown
            className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
            aria-hidden="true"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 px-4 pb-4">
          <p className="text-muted-foreground text-sm leading-relaxed">{floor.explanation}</p>
          <DataTable
            id="pilot-floor-calc"
            columns={columns}
            rows={floor.calculation}
            getRowId={(f) => f.key}
            controls="never"
            pageSize={20}
            caption={m.pilot_floor_calc()}
          />
        </CollapsibleContent>
      </Collapsible>
    </Panel>
  );
}

/** Resultado da recomendação do piloto: KPIs com intervalo, freguesias com factos e fontes, pontuação e piso. */
export function PilotResult({ data }: { data: PilotOut }) {
  const cells = data.kpis.map((k) => (
    <StatCell
      key={k.key}
      label={kpiLabel[k.key]()}
      value={kpiValue(k, k.value)}
      tone={k.key === 'tonnes' ? 'primary' : 'default'}
      tag={m.common_estimate()}
      hint={m.pilot_p10_p90({ low: kpiValue(k, k.p10), high: kpiValue(k, k.p90) })}
    />
  ));
  return (
    <div className="space-y-8 sm:space-y-10">
      <StatStrip>
        {cells}
        <StatCell
          label={m.pilot_kpi_startup()}
          value={formatEur(data.startup_cost_eur)}
          tag={m.common_estimate()}
          hint={m.pilot_startup_hint({ k: data.k, months: data.months })}
        />
      </StatStrip>

      <Section title={m.pilot_zones_title({ k: data.k })} description={m.pilot_zones_description()}>
        <ul
          className={cn(
            'grid grid-cols-1 gap-4 md:grid-cols-2',
            // 2 e 4 freguesias enchem as linhas em duas colunas; só 3 pedem três (sem buraco à direita).
            data.zones.length === 3 && 'xl:grid-cols-3',
          )}
        >
          {data.zones.map((z, i) => (
            <ZoneCard key={z.parish_code} zone={z} index={i} />
          ))}
        </ul>
      </Section>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ScorePanel score={data.score} />
        <FloorPanel floor={data.signal_floor} />
      </div>

      <Disclosure title={m.pilot_rationale_title()}>
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
          {data.rationale.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <ul className="space-y-1 border-t pt-3 text-muted-foreground text-xs">
          {data.kpis.map((k) => (
            <li key={k.key}>
              <span className="font-medium text-foreground">{kpiLabel[k.key]()}:</span> {k.basis}
            </li>
          ))}
        </ul>
      </Disclosure>
    </div>
  );
}
