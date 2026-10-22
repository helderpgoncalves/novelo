import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Building2, FlaskConical, MapPin, ShoppingBag, Truck } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ScenarioOut } from '@/client';
import {
  getB2bChannelOptions,
  getScenarioOptions,
  listReferenceScenariosOptions,
  listScenariosOptions,
} from '@/client/@tanstack/react-query.gen';
import { EstimateTag } from '@/components/panel';
import { RangeBar } from '@/components/range-bar';
import { CardSkeleton } from '@/components/skeletons';
import { EmptyState, ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSensitivity } from '@/features/scenarios/uncertainty-panel';
import { formatEur, formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { intlTag } from '@/lib/i18n';
import { m } from '@/paraglide/messages';
import { PILOT_PARAMS, pilotQueryOptions } from './pilot-query';
import { type PlanChannels, planChannels } from './plan-model';
import { EYEBROW } from './tags';

/** O cenário de referência da história: por freguesia, 60 000 €/ano, com plano de recolha. */
const REFERENCE_KEY = 'parish:60000';
const REFERENCE_BUDGET = 60_000;

/**
 * Escolhe o cenário de referência. A API publica-o em `/planning/scenarios/reference`; enquanto o arranque não o
 * calcula (lista vazia), usa-se o cenário guardado mais recente por freguesia com o mesmo orçamento.
 */
function useReferenceScenarioId() {
  const refs = useQuery({ ...listReferenceScenariosOptions(), staleTime: 5 * 60_000 });
  const ref =
    refs.data?.find((s) => s.reference_key === REFERENCE_KEY) ??
    refs.data?.find((s) => s.onboarding);
  const needFallback = refs.isSuccess && !ref;
  const all = useQuery({ ...listScenariosOptions(), enabled: needFallback || refs.isError });
  const fallback = all.data
    ?.filter(
      (s) =>
        s.siting === 'parish' && s.status === 'computed' && s.budget_eur_year === REFERENCE_BUDGET,
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const id = ref?.id ?? fallback?.id ?? null;
  const pending = refs.isPending || ((needFallback || refs.isError) && all.isPending);
  const error = refs.isError && all.isError ? all.error : null;
  const retry = () => {
    void refs.refetch();
    void all.refetch();
  };
  return { id, pending, error, retry };
}

const eurPerTonne = (v: number) => `${formatNumber(v, 0)} €/t`;

/**
 * O plano num relance: o cenário de referência sem contentores, com uma viatura nova de têxtil (saco fechado à porta,
 * locais existentes), o que custa com incerteza e o próximo passo (o piloto). Todos os números vêm da API.
 */
export function PlanStory() {
  const ref = useReferenceScenarioId();
  const scenario = useQuery({
    ...getScenarioOptions({ path: { scenario_id: ref.id ?? '' } }),
    enabled: ref.id !== null,
    staleTime: 10 * 60_000,
  });

  if (ref.pending || (ref.id !== null && scenario.isPending)) {
    return <CardSkeleton className="min-h-96" />;
  }
  if (ref.error || scenario.isError) {
    return (
      <ErrorState
        error={ref.error ?? scenario.error}
        onRetry={() => (ref.error ? ref.retry() : void scenario.refetch())}
      />
    );
  }
  if (!scenario.data) {
    return (
      <EmptyState
        title={m.home_plan_empty_title()}
        description={m.home_plan_empty_text()}
        action={
          <Button asChild>
            <Link to="/simulator">{m.home_cta_simulate()}</Link>
          </Button>
        }
      />
    );
  }
  return <PlanBody scenario={scenario.data} />;
}

function PlanBody({ scenario }: { scenario: ScenarioOut }) {
  const channels = planChannels(scenario);
  const { kpis } = scenario.result;
  const share = kpis.potential_t > 0 ? (kpis.tonnes_year / kpis.potential_t) * 100 : null;

  return (
    <div className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
      <div className="grid lg:grid-cols-12">
        <div className="space-y-5 p-5 sm:p-6 lg:col-span-7">
          <div className="space-y-1.5">
            <p className={EYEBROW}>{m.home_plan_channels_eyebrow()}</p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {m.home_plan_channels_lead({
                budget: formatEur(scenario.budget_eur_year ?? REFERENCE_BUDGET),
              })}
            </p>
          </div>
          <Channels channels={channels} />
        </div>
        <div className="space-y-5 border-border border-t bg-muted/30 p-5 sm:p-6 lg:col-span-5 lg:border-t-0 lg:border-l">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className={EYEBROW}>{m.home_plan_result_eyebrow()}</p>
              <p className="mt-1 font-serif text-4xl text-primary tabular-nums leading-none sm:text-5xl">
                {formatTonnes(kpis.tonnes_year, 0)}
                <span className="ml-1.5 font-sans text-base text-muted-foreground">
                  {m.home_plan_per_year()}
                </span>
              </p>
              {share !== null && (
                <p className="mt-2 text-muted-foreground text-sm">
                  {m.home_plan_share({
                    pct: formatPercent(share, 0),
                    potential: formatTonnes(kpis.potential_t, 0),
                  })}
                </p>
              )}
            </div>
            <EstimateTag label={m.common_estimate()} />
          </div>
          <Uncertainty scenario={scenario} />
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-muted-foreground text-xs">{m.home_plan_capex()}</dt>
              <dd className="font-medium tabular-nums">{formatEur(kpis.capex_eur)}</dd>
            </div>
            {kpis.net_annual_cost_eur != null && (
              <div>
                <dt className="text-muted-foreground text-xs">{m.home_plan_net()}</dt>
                <dd className="font-medium tabular-nums">
                  {m.home_plan_net_value({
                    eur: formatEur(kpis.net_annual_cost_eur),
                    eurt: kpis.net_eur_per_tonne != null ? eurPerTonne(kpis.net_eur_per_tonne) : '',
                  })}
                </dd>
              </div>
            )}
          </dl>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="h-10 gap-2">
              <Link to="/scenarios/$scenarioId" params={{ scenarioId: scenario.id }}>
                {m.home_plan_open()}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-10">
              <Link to="/simulator">{m.home_plan_adjust()}</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Channels({ channels }: { channels: PlanChannels }) {
  const b2b = useQuery({ ...getB2bChannelOptions(), staleTime: 10 * 60_000 });
  const { doorBag, existing, vehicle } = channels;
  return (
    <ul className="space-y-3">
      {vehicle.vehicles > 0 && (
        <Channel
          icon={<Truck className="size-4" aria-hidden="true" />}
          highlight
          title={m.home_plan_vehicle_title()}
          value={
            vehicle.vehicles > 1
              ? m.home_plan_vehicle_value_many({
                  n: vehicle.vehicles,
                  days: formatNumber(vehicle.daysPerWeek, 1),
                })
              : m.home_plan_vehicle_value_one({ days: formatNumber(vehicle.daysPerWeek, 1) })
          }
          text={m.home_plan_vehicle_text({ capex: formatEur(vehicle.capexEur) })}
        />
      )}
      {doorBag.parishes > 0 && (
        <Channel
          icon={<ShoppingBag className="size-4" aria-hidden="true" />}
          title={m.home_plan_pap_title()}
          value={m.home_plan_pap_value({
            n: doorBag.parishes,
            tonnes: formatTonnes(doorBag.tonnes, 0),
          })}
          text={m.home_plan_pap_text({
            weeks: formatNumber(doorBag.everyWeeks ?? 2),
            km: `${formatNumber(doorBag.km, 0)} km`,
          })}
        />
      )}
      {existing.points > 0 && (
        <Channel
          icon={<MapPin className="size-4" aria-hidden="true" />}
          title={m.home_plan_existing_title()}
          value={m.home_plan_existing_value({
            points: existing.points,
            tonnes: formatTonnes(existing.tonnes, 0),
          })}
          text={m.home_plan_existing_text()}
        />
      )}
      {b2b.data && b2b.data.sites > 0 && (
        <Channel
          icon={<Building2 className="size-4" aria-hidden="true" />}
          title={m.home_plan_b2b_title()}
          value={m.home_plan_b2b_value({ sites: b2b.data.sites })}
          text={m.home_plan_b2b_text()}
          action={
            <Link
              to="/municipal"
              search={{ tab: 'b2b' }}
              className="font-medium text-primary text-xs underline-offset-4 hover:underline"
            >
              {m.home_plan_b2b_link()}
            </Link>
          }
        />
      )}
    </ul>
  );
}

function Channel({
  icon,
  title,
  value,
  text,
  action,
  highlight = false,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  text: string;
  action?: ReactNode;
  highlight?: boolean;
}) {
  return (
    <li
      className={
        highlight
          ? 'flex gap-3 rounded-lg bg-primary/[0.07] p-3.5 ring-1 ring-primary/20'
          : 'flex gap-3 rounded-lg p-3.5 ring-1 ring-foreground/10'
      }
    >
      <span
        className={
          highlight
            ? 'grid size-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground'
            : 'grid size-8 shrink-0 place-items-center rounded-full bg-muted text-foreground'
        }
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="font-medium text-sm">{title}</p>
          <p className="font-medium text-sm tabular-nums">{value}</p>
        </div>
        <p className="text-muted-foreground text-xs leading-relaxed">{text}</p>
        {action}
      </div>
    </li>
  );
}

function Uncertainty({ scenario }: { scenario: ScenarioOut }) {
  const sens = useSensitivity(scenario.id, 0.3, null);
  if (sens.isPending) {
    return (
      <div className="space-y-2" aria-busy="true">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>
    );
  }
  if (sens.isError) {
    return (
      <div className="space-y-1">
        <p className="text-sm">
          {scenario.eur_per_tonne != null
            ? m.home_plan_cost_central({ eurt: eurPerTonne(scenario.eur_per_tonne) })
            : null}
        </p>
        <Button variant="link" className="h-auto p-0 text-xs" onClick={() => void sens.refetch()}>
          {m.home_plan_uncertainty_retry()}
        </Button>
      </div>
    );
  }
  const { eur_per_tonne: eurt, annual_cost_eur: cost, n_samples } = sens.data;
  return (
    <div className="space-y-3">
      <RangeBar
        label={m.home_plan_eurt_label()}
        p10={eurt.p10}
        p50={eurt.p50}
        p90={eurt.p90}
        format={eurPerTonne}
      />
      <p className="text-muted-foreground text-xs leading-relaxed">
        {m.home_plan_uncertainty_note({
          cost: formatEur(cost.p50),
          lo: formatEur(cost.p10),
          hi: formatEur(cost.p90),
          n: formatNumber(n_samples),
        })}
      </p>
    </div>
  );
}

/** O próximo passo: o piloto recomendado (freguesias, toneladas, €/t com intervalo e arranque). */
export function PilotNext() {
  const pilot = useQuery(pilotQueryOptions());

  return (
    <div className="flex flex-col gap-5 rounded-xl bg-primary p-5 text-primary-foreground sm:p-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 space-y-2">
        <p className="flex items-center gap-2 font-semibold text-[11px] uppercase tracking-[0.18em] opacity-80">
          <FlaskConical className="size-3.5" aria-hidden="true" />
          {m.home_pilot_eyebrow()}
        </p>
        <h3 className="text-balance font-serif text-2xl leading-tight">
          {m.home_pilot_title({ months: PILOT_PARAMS.months })}
        </h3>
        {pilot.isPending ? (
          <Skeleton className="h-4 w-80 max-w-full bg-primary-foreground/20" />
        ) : pilot.isError ? (
          <p className="text-sm opacity-85">{m.home_pilot_fallback()}</p>
        ) : (
          <p className="max-w-2xl text-pretty text-sm leading-relaxed opacity-90">
            {m.home_pilot_text({
              parishes: new Intl.ListFormat(intlTag(), { type: 'conjunction' }).format(
                pilot.data.zones.map((z) => z.parish_name),
              ),
              cost: formatEur(pilot.data.startup_cost_eur),
              tonnes: formatTonnes(pilot.data.kpis.find((k) => k.key === 'tonnes')?.value ?? 0, 1),
            })}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button asChild variant="secondary" className="h-10 gap-2">
          <Link to="/pilot">
            {m.home_pilot_open()}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          className="h-10 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
        >
          <Link to="/triage">{m.lots_start_triage()}</Link>
        </Button>
      </div>
    </div>
  );
}
