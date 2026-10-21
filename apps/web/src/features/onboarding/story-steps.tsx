import {
  ArrowRight,
  Building2,
  Check,
  FlaskConical,
  Layers,
  MapPin,
  MessageSquareText,
  ShieldAlert,
  ShieldCheck,
  Truck,
  User,
} from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import type { CSSProperties, ReactNode } from 'react';
import type { ScenarioOut } from '@/client';
import { RangeBar } from '@/components/range-bar';
import { ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PILOT_PARAMS } from '@/features/home/pilot-query';
import { planChannels } from '@/features/home/plan-model';
import { CountUp } from '@/features/landing/count-up';
import { formatEur, formatNumber, formatPercent, formatTonnes } from '@/lib/format';
import { weekdayShort } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { StoryMap, useSitesData } from './story-map';
import { daysUntil, pickSitesReference, planLines, waffle } from './story-model';
import { type StoryData, useStorySensitivity } from './use-story-data';

export interface StoryActions {
  askCopilot: (question: string) => void;
  go: (to: 'plan' | 'simulator' | 'pilot') => void;
}

export interface StepProps {
  data: StoryData;
  actions: StoryActions;
  /** Conta de convidado (QR do evento): explora e simula, sem administração. */
  guest: boolean;
}

const rise = (i: number) => ({ 'data-rise': '', style: { '--i': i } as CSSProperties });
const eurPerTonne = (v: number) => `${formatNumber(v, 0)} €/t`;

// ---- peças comuns ------------------------------------------------------------------------------------------

function Estimate({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'ob-mono inline-flex items-center rounded-full border border-areia/70 bg-areia/15 px-2 py-0.5 text-[10.5px] text-foreground/80 uppercase',
        className,
      )}
    >
      {m.story_estimate()}
    </span>
  );
}

/** Etiqueta, título (o título do diálogo) e linha de apoio (a descrição do diálogo) de cada passo. */
function Intro({ eyebrow, title, lead }: { eyebrow: string; title: ReactNode; lead: ReactNode }) {
  return (
    <div className="space-y-4 sm:space-y-5">
      <p className="ob-kicker" {...rise(0)}>
        {eyebrow}
      </p>
      <DialogPrimitive.Title asChild>
        <h2
          id="story-title"
          tabIndex={-1}
          className="text-balance font-medium text-[clamp(1.85rem,1.4rem+1.9vw,3.1rem)] leading-[1.05] tracking-[-0.02em] outline-none"
          {...rise(1)}
        >
          {title}
        </h2>
      </DialogPrimitive.Title>
      <DialogPrimitive.Description asChild>
        <p
          id="story-lead"
          className="max-w-xl text-pretty text-[1.0625rem] text-muted-foreground leading-relaxed"
          {...rise(2)}
        >
          {lead}
        </p>
      </DialogPrimitive.Description>
    </div>
  );
}

/** Duas colunas em ecrã largo (texto à esquerda, visual à direita); empilhadas em telemóvel. */
/**
 * Duas colunas em ecrã largo (texto à esquerda, visual à direita). Em telemóvel o visual vem logo a seguir à introdução
 * e o resto do texto (`after`) depois dele: o mapa, o custo ou o piloto aparecem sem rolar a página inteira.
 */
function Layout({
  text,
  visual,
  after,
}: {
  text: ReactNode;
  visual: ReactNode;
  after?: ReactNode;
}) {
  return (
    <div className="grid gap-8 lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-12 lg:gap-y-7 xl:gap-x-16">
      <div className="space-y-7 lg:col-span-5 lg:row-start-1">{text}</div>
      <div className="lg:col-span-7 lg:col-start-6 lg:row-span-2 lg:row-start-1">{visual}</div>
      {after && <div className="space-y-7 lg:col-span-5 lg:row-start-2">{after}</div>}
    </div>
  );
}

const CARD = 'rounded-2xl border border-border bg-card';

function Loading({ className, label }: { className?: string; label?: string }) {
  return (
    <div
      role="status"
      aria-label={label ?? m.common_loading()}
      className={cn(CARD, 'space-y-4 p-5 sm:p-7', className)}
    >
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-12 w-3/4" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

function Channel({
  icon,
  title,
  value,
  text,
  highlight = false,
  index,
  children,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  text: string;
  highlight?: boolean;
  index: number;
  children?: ReactNode;
}) {
  return (
    <li
      {...rise(index)}
      className={cn(
        'flex gap-3.5 rounded-xl p-4 sm:p-5',
        highlight ? 'bg-primary/[0.07] ring-1 ring-primary/25' : 'ring-1 ring-foreground/10',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full',
          highlight ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
        )}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <h3 className="font-medium font-sans text-[0.9375rem]">{title}</h3>
          <p className="ob-mono text-[13px] tabular-nums">{value}</p>
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">{text}</p>
        {children}
      </div>
    </li>
  );
}

// ---- 1. O problema -----------------------------------------------------------------------------------------

function Waffle({ pct }: { pct: number }) {
  const { full, partial } = waffle(pct);
  return (
    <figure className={cn(CARD, 'ob-waffle p-5 sm:p-7')} {...rise(3)}>
      <div
        role="img"
        aria-label={m.story_problem_waffle({ pct: formatPercent(pct, 1) })}
        className="mx-auto grid max-w-[26rem] grid-cols-10 gap-[clamp(4px,1.1vw,9px)]"
      >
        {Array.from({ length: 100 }, (_, i) => {
          const kept = i < full;
          const half = i === full && partial > 0;
          return (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: grelha fixa de 100 pontos.
              key={i}
              data-cell=""
              style={{ '--i': i } as CSSProperties}
              className={cn(
                'aspect-square rounded-full',
                kept || half ? 'bg-primary' : 'bg-foreground/15',
                half &&
                  'bg-[linear-gradient(90deg,var(--primary)_50%,color-mix(in_oklab,var(--foreground)_15%,transparent)_50%)]',
              )}
            />
          );
        })}
      </div>
      <figcaption className="mt-5 flex flex-wrap items-center justify-between gap-x-5 gap-y-2">
        <span className="ob-mono text-[11.5px] text-muted-foreground uppercase">
          {m.story_problem_waffle_caption()}
        </span>
        <span className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 rounded-full bg-primary" />
            {m.story_problem_legend_collected()}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="size-2.5 rounded-full bg-foreground/15" />
            {m.story_problem_legend_lost()}
          </span>
        </span>
      </figcaption>
    </figure>
  );
}

function Fact({
  value,
  label,
  extra,
  index,
}: {
  value: ReactNode;
  label: string;
  extra?: ReactNode;
  index: number;
}) {
  return (
    <li
      {...rise(index)}
      className="grid grid-cols-[8.75rem_1fr] items-baseline gap-x-4 gap-y-1 border-border border-t py-3.5 first:border-t-0"
    >
      <span className="font-medium font-serif text-[1.65rem] tabular-nums leading-none">
        {value}
      </span>
      <span className="text-muted-foreground text-sm leading-snug">
        {label}
        {extra}
      </span>
    </li>
  );
}

export function ProblemStep({ data }: StepProps) {
  const gap = data.overview.data?.gap;
  const days = daysUntil(new Date());
  const deadline = (
    <Fact
      index={6}
      value={<time dateTime="2028-04-17">{m.story_problem_deadline_date()}</time>}
      label={m.story_problem_deadline()}
      extra={
        <span className="ob-mono mt-1 block text-[12px] text-primary uppercase">
          {days > 0
            ? m.story_problem_days({ days: formatNumber(days) })
            : m.story_problem_days_over()}
        </span>
      }
    />
  );

  if (data.overview.isPending) {
    return (
      <Layout
        text={
          <div className="space-y-5" role="status" aria-label={m.common_loading()}>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        }
        visual={<Loading className="min-h-80" />}
      />
    );
  }
  if (!gap) {
    // Sem os números da API não se escreve nenhum: diz-se o que falhou, com o prazo (que é uma data da diretiva).
    return (
      <Layout
        text={
          <>
            <Intro
              eyebrow={m.story_problem_eyebrow()}
              title={m.story_problem_lead()}
              lead={m.story_problem_fallback()}
            />
            <ul>{deadline}</ul>
          </>
        }
        visual={<ErrorState error={data.overview.error} onRetry={() => data.overview.refetch()} />}
      />
    );
  }

  return (
    <Layout
      text={
        <Intro
          eyebrow={m.story_problem_eyebrow()}
          title={
            <>
              <span className="block text-[0.5em] text-muted-foreground tracking-normal">
                {m.story_problem_title_pre()}
              </span>
              <span className="block text-[1.9em] text-primary leading-[0.95] tracking-[-0.03em]">
                <CountUp value={gap.missing_t} format={(v) => formatTonnes(v, 0)} duration={1400} />
              </span>
              <span className="mt-2 block text-[0.62em] leading-tight">
                {m.story_problem_title_post()}
              </span>
            </>
          }
          lead={m.story_problem_lead()}
        />
      }
      after={
        <div className="space-y-3">
          <ul>
            <Fact
              index={3}
              value={formatTonnes(gap.collected_t, 1)}
              label={m.story_problem_collected()}
            />
            <Fact
              index={4}
              value={formatPercent(gap.capture_pct, 1)}
              label={m.story_problem_capture()}
              extra={<Estimate className="ml-2 align-middle" />}
            />
            {deadline}
          </ul>
        </div>
      }
      visual={
        <div className="space-y-4">
          <Waffle pct={gap.capture_pct} />
          <p
            className="flex flex-wrap items-center gap-2 text-muted-foreground text-xs leading-relaxed"
            {...rise(5)}
          >
            <Estimate />
            <span>
              {m.story_source()}: {gap.potential_source_label}
            </span>
          </p>
        </div>
      }
    />
  );
}

// ---- 2. Onde se perde --------------------------------------------------------------------------------------

export function WhereStep(_: StepProps) {
  const { sites, ranked, parishes } = useSitesData();
  const top = ranked.slice(0, 3);
  const max = top[0]?.t ?? 1;
  return (
    <Layout
      text={
        <Intro
          eyebrow={m.story_where_eyebrow()}
          title={m.story_where_title()}
          lead={m.story_where_lead({
            sites: formatNumber(sites.length),
            parishes: formatNumber(parishes),
          })}
        />
      }
      after={
        <div className="space-y-3" {...rise(3)}>
          <h3 className="ob-kicker flex items-center gap-2">
            {m.story_where_top()}
            <Estimate />
          </h3>
          <ol className="space-y-3">
            {top.map((p, i) => (
              <li
                key={p.index}
                className="grid grid-cols-[1.75rem_1fr_auto] items-center gap-x-3 gap-y-1.5"
              >
                <span
                  aria-hidden="true"
                  className="ob-mono grid size-6 place-items-center rounded-full bg-foreground text-[12px] text-background"
                >
                  {i + 1}
                </span>
                <span className="font-medium text-[0.9375rem] leading-snug">{p.name}</span>
                <span className="ob-mono text-[13px] tabular-nums">
                  {m.story_where_per_year({ t: formatTonnes(p.t) })}
                </span>
                <span
                  aria-hidden="true"
                  className="col-start-2 col-end-4 h-1.5 overflow-hidden rounded-full bg-border/70"
                >
                  <span
                    className="ob-bar block h-full rounded-full bg-primary"
                    style={{ width: `${(p.t / max) * 100}%`, '--i': i } as CSSProperties}
                  />
                </span>
              </li>
            ))}
          </ol>
        </div>
      }
      visual={
        <figure className={cn(CARD, 'overflow-hidden')} {...rise(2)}>
          <div className="px-3 py-4 sm:px-6 sm:py-6">
            <StoryMap highlight={top.map((p) => p.index)} />
          </div>
          <figcaption className="border-border border-t px-5 py-3.5 text-muted-foreground text-xs leading-relaxed sm:px-7">
            {m.story_where_caption()}
          </figcaption>
        </figure>
      }
    />
  );
}

// ---- 3. A resposta: sem contentores -------------------------------------------------------------------------

function Quote() {
  return (
    <blockquote className="relative border-areia border-l-2 pl-5" {...rise(3)}>
      <p className="text-pretty font-serif text-[1.35rem] italic leading-snug sm:text-[1.5rem]">
        «{m.story_answer_quote()}»
      </p>
      <footer className="ob-mono mt-2 text-[11.5px] text-muted-foreground uppercase">
        {m.story_answer_quote_by()}
      </footer>
    </blockquote>
  );
}

function Computing({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="status" className={cn(CARD, 'space-y-4 p-5 sm:p-7')}>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="relative flex size-3">
          <span className="absolute inline-flex size-full rounded-full bg-primary/50 motion-safe:animate-ping" />
          <span className="relative inline-flex size-3 rounded-full bg-primary" />
        </span>
        <p className="font-medium">{m.story_answer_computing_title()}</p>
      </div>
      <p className="text-muted-foreground text-sm leading-relaxed">
        {m.story_answer_computing_text()}
      </p>
      <div className="space-y-2" aria-hidden="true">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
      <Button variant="outline" className="h-11" onClick={onRetry}>
        {m.story_answer_computing_retry()}
      </Button>
    </div>
  );
}

function PlanChannels({ scenario, b2bSites }: { scenario: ScenarioOut; b2bSites: number | null }) {
  const { doorToDoor, existing } = planChannels(scenario);
  const lines = planLines(scenario.result.collection_plan, 3);
  return (
    <ul className="space-y-3">
      <Channel
        index={3}
        highlight
        icon={<Truck className="size-4" />}
        title={m.story_answer_pap_title()}
        value={m.story_answer_pap_value({
          n: formatNumber(doorToDoor.parishes),
          tonnes: formatTonnes(doorToDoor.tonnes, 0),
          km: formatNumber(doorToDoor.newKm, 0),
        })}
        text={m.story_answer_pap_text()}
      >
        {lines.length > 0 && (
          <ul aria-label={m.story_answer_lines_label()} className="mt-3 space-y-1.5">
            {lines.map((l) => (
              <li
                key={`${l.parish}-${l.circuit}`}
                aria-label={m.story_answer_line_aria({
                  parish: l.parish,
                  circuit: l.circuit,
                  day: weekdayShort(l.weekday),
                  vehicle: l.vehicle,
                  tonnes: formatTonnes(l.tonnes, 1),
                })}
                className="ob-mono flex flex-wrap items-baseline gap-x-2 rounded-lg bg-background/70 px-3 py-2 text-[12.5px] ring-1 ring-foreground/10"
              >
                <span className="font-medium font-sans text-[13px] text-foreground tracking-normal">
                  {l.parish}
                </span>
                <span aria-hidden="true" className="text-muted-foreground">
                  ·
                </span>
                <span>{l.circuit}</span>
                <span aria-hidden="true" className="text-muted-foreground">
                  ·
                </span>
                <span>{weekdayShort(l.weekday)}</span>
                <span aria-hidden="true" className="text-muted-foreground">
                  ·
                </span>
                <span>{l.vehicle}</span>
                <span className="ml-auto text-muted-foreground tabular-nums">
                  {m.story_where_per_year({ t: formatTonnes(l.tonnes, 1) })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Channel>
      {existing.points > 0 && (
        <Channel
          index={4}
          icon={<MapPin className="size-4" />}
          title={m.story_answer_schools_title()}
          value={m.story_answer_schools_value({
            points: formatNumber(existing.points),
            tonnes: formatTonnes(existing.tonnes, 0),
          })}
          text={m.story_answer_schools_text()}
        />
      )}
      {b2bSites !== null && b2bSites > 0 && (
        <Channel
          index={5}
          icon={<Building2 className="size-4" />}
          title={m.story_answer_b2b_title()}
          value={m.story_answer_b2b_value({ sites: formatNumber(b2bSites) })}
          text={m.story_answer_b2b_text()}
        />
      )}
    </ul>
  );
}

export function AnswerStep({ data }: StepProps) {
  const { refs, reference, scenario, b2b } = data;
  const budget = scenario.data?.budget_eur_year ?? reference?.budget_eur_year ?? null;
  let visual: ReactNode;
  if (refs.isPending || (reference && scenario.isPending)) {
    visual = <Loading className="min-h-96" />;
  } else if (refs.isError || scenario.isError) {
    visual = (
      <ErrorState
        error={refs.error ?? scenario.error}
        onRetry={() => (refs.isError ? refs.refetch() : scenario.refetch())}
      />
    );
  } else if (!reference || !scenario.data) {
    visual = <Computing onRetry={() => void refs.refetch()} />;
  } else {
    visual = (
      <div className="space-y-3">
        <PlanChannels scenario={scenario.data} b2bSites={b2b.data?.sites ?? null} />
        <p className="flex items-center gap-2 text-muted-foreground text-xs" {...rise(6)}>
          <Estimate />
          {scenario.data.label}
        </p>
      </div>
    );
  }
  return (
    <Layout
      text={
        <>
          <Intro
            eyebrow={m.story_answer_eyebrow()}
            title={m.story_answer_title()}
            lead={
              budget !== null
                ? m.story_answer_lead({ budget: formatEur(budget) })
                : m.home_plan_description()
            }
          />
          <Quote />
        </>
      }
      visual={<div aria-live="polite">{visual}</div>}
    />
  );
}

// ---- 4. Quanto custa ----------------------------------------------------------------------------------------

function CostCard({ scenario }: { scenario: ScenarioOut }) {
  const sens = useStorySensitivity(scenario.id);
  const { kpis } = scenario.result;
  const share = kpis.potential_t > 0 ? (kpis.tonnes_year / kpis.potential_t) * 100 : null;
  return (
    <div className={cn(CARD, 'ob-halftone relative overflow-hidden')} {...rise(2)}>
      <div className="relative space-y-6 p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="ob-kicker">{m.story_cost_tonnes()}</p>
            <p className="mt-2 font-medium font-serif text-[clamp(2.75rem,2rem+3vw,4.25rem)] text-primary tabular-nums leading-none tracking-[-0.02em]">
              <CountUp value={kpis.tonnes_year} format={(v) => formatTonnes(v, 0)} />
              <span className="ml-2 font-sans text-base text-muted-foreground tracking-normal">
                {m.story_problem_per_year()}
              </span>
            </p>
            {share !== null && (
              <p className="mt-2 text-muted-foreground text-sm">
                {m.story_cost_share({
                  pct: formatPercent(share, 0),
                  potential: formatTonnes(kpis.potential_t, 0),
                })}
              </p>
            )}
          </div>
          <Estimate className="shrink-0" />
        </div>
        <div className="border-border border-t pt-5">
          {sens.isPending ? (
            <div className="space-y-2" role="status" aria-label={m.common_loading()}>
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ) : sens.isError ? (
            <div className="space-y-2">
              {scenario.eur_per_tonne != null && (
                <p className="flex items-baseline justify-between gap-3">
                  <span className="font-medium text-sm">{m.story_cost_eurt()}</span>
                  <span className="font-serif text-xl tabular-nums">
                    {eurPerTonne(scenario.eur_per_tonne)}
                  </span>
                </p>
              )}
              <p className="text-muted-foreground text-sm">{m.story_cost_sens_error()}</p>
              <Button variant="outline" className="h-10" onClick={() => void sens.refetch()}>
                {m.common_retry()}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <RangeBar
                label={m.story_cost_eurt()}
                p10={sens.data.eur_per_tonne.p10}
                p50={sens.data.eur_per_tonne.p50}
                p90={sens.data.eur_per_tonne.p90}
                format={eurPerTonne}
              />
              <p className="ob-mono text-[11.5px] text-muted-foreground uppercase">
                {m.story_cost_interval({ n: formatNumber(sens.data.n_samples) })}
              </p>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {m.story_cost_annual({
                  cost: formatEur(sens.data.annual_cost_eur.p50),
                  lo: formatEur(sens.data.annual_cost_eur.p10),
                  hi: formatEur(sens.data.annual_cost_eur.p90),
                })}
              </p>
            </div>
          )}
        </div>
        <dl className="grid grid-cols-3 gap-3 border-border border-t pt-5">
          {(
            [
              scenario.budget_eur_year != null
                ? [m.story_cost_budget(), formatEur(scenario.budget_eur_year)]
                : null,
              [m.story_cost_capex(), formatEur(kpis.capex_eur)],
              [m.story_cost_points(), formatNumber(kpis.points)],
            ].filter(Boolean) as [string, string][]
          ).map(([label, value]) => (
            <div key={label} className="min-w-0">
              <dt className="text-muted-foreground text-xs leading-snug">{label}</dt>
              <dd className="mt-1 font-medium font-serif text-lg tabular-nums leading-none sm:text-xl">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function MissingFromVitrus({ data }: { data: StoryData }) {
  const v = data.params.data?.values;
  if (!v) return null;
  const rows: { label: string; value: string | null }[] = [
    { label: m.story_cost_param_km(), value: `${formatNumber(v.cost_per_km_eur, 2)} €/km` },
    {
      label: m.story_cost_param_pickup(),
      value: v.pap_cost_per_pickup_eur != null ? formatEur(v.pap_cost_per_pickup_eur) : null,
    },
    {
      label: m.story_cost_param_capacity(),
      value: v.pap_free_capacity_kg != null ? `${formatNumber(v.pap_free_capacity_kg)} kg` : null,
    },
    {
      label: m.story_cost_param_treatment(),
      value: v.rsu_treatment_eur_per_t != null ? eurPerTonne(v.rsu_treatment_eur_per_t) : null,
    },
  ];
  return (
    <div className="space-y-3" {...rise(4)}>
      <h3 className="ob-kicker">{m.story_cost_missing_title()}</h3>
      <ul className="divide-y divide-border rounded-xl ring-1 ring-foreground/10">
        {rows.map((r) => (
          <li
            key={r.label}
            className="flex items-baseline justify-between gap-3 px-4 py-2.5 text-sm"
          >
            <span>{r.label}</span>
            <span className="ob-mono shrink-0 text-right text-[12.5px] tabular-nums">
              {r.value ?? m.story_cost_pending()}
              <span className="ml-1.5 text-muted-foreground">
                {r.value ? `· ${m.story_cost_assumption()}` : ''}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground text-xs leading-relaxed">{m.story_cost_missing_text()}</p>
    </div>
  );
}

export function CostStep({ data }: StepProps) {
  const { refs, reference, scenario } = data;
  let visual: ReactNode;
  if (refs.isPending || (reference && scenario.isPending))
    visual = <Loading className="min-h-80" />;
  else if (refs.isError || scenario.isError)
    visual = (
      <ErrorState
        error={refs.error ?? scenario.error}
        onRetry={() => (refs.isError ? refs.refetch() : scenario.refetch())}
      />
    );
  else if (!scenario.data) visual = <Computing onRetry={() => void refs.refetch()} />;
  else visual = <CostCard scenario={scenario.data} />;
  return (
    <Layout
      text={
        <Intro
          eyebrow={m.story_cost_eyebrow()}
          title={m.story_cost_title()}
          lead={m.story_cost_lead()}
        />
      }
      after={<MissingFromVitrus data={data} />}
      visual={<div aria-live="polite">{visual}</div>}
    />
  );
}

// ---- 5. O Copiloto ------------------------------------------------------------------------------------------

function Num({ children }: { children: string }) {
  return (
    <span className="inline-flex items-baseline gap-1 whitespace-nowrap rounded-md bg-primary/10 px-1.5 py-px font-medium text-foreground tabular-nums ring-1 ring-primary/25">
      {children}
      <Check className="size-3 self-center text-primary" aria-label={m.story_copilot_number_ok()} />
    </span>
  );
}

function ChatExample({ data }: { data: StoryData }) {
  const at40 = pickSitesReference(data.refs.data, 40_000);
  const at60 = pickSitesReference(data.refs.data, 60_000);
  const numbers =
    at40?.eur_per_tonne != null && at60?.eur_per_tonne != null
      ? {
          budget: formatEur(at40.budget_eur_year ?? 40_000),
          tonnes: formatTonnes(at40.tonnes_year ?? 0, 0),
          eurt: eurPerTonne(at40.eur_per_tonne),
          budget60: formatEur(at60.budget_eur_year ?? 60_000),
          tonnes60: formatTonnes(at60.tonnes_year ?? 0, 0),
          eurt60: eurPerTonne(at60.eur_per_tonne),
        }
      : null;
  // A frase traduzida com os números marcados: cada {valor} vira um número verificado.
  const mark = (k: string) => `\u0000${k}\u0000`;
  const parts = numbers
    ? m
        .story_copilot_answer({
          budget: mark('budget'),
          tonnes: mark('tonnes'),
          eurt: mark('eurt'),
          budget60: mark('budget60'),
          tonnes60: mark('tonnes60'),
          eurt60: mark('eurt60'),
        })
        .split('\u0000')
    : [];
  return (
    <div className={cn(CARD, 'overflow-hidden')} {...rise(2)}>
      <div className="flex items-center gap-2 border-border border-b px-5 py-3">
        <MessageSquareText className="size-4 text-primary" aria-hidden="true" />
        <span className="ob-mono text-[11.5px] text-muted-foreground uppercase">
          {m.story_copilot_example()}
        </span>
      </div>
      <div className="space-y-4 p-5 sm:p-6">
        <div className="flex justify-end gap-2.5" {...rise(3)}>
          <p className="max-w-[85%] rounded-2xl rounded-tr-md bg-primary px-4 py-2.5 text-[0.9375rem] text-primary-foreground">
            {m.story_copilot_question()}
          </p>
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-full bg-muted"
          >
            <User className="size-4" />
          </span>
        </div>
        <div className="flex gap-2.5" {...rise(4)}>
          <span
            aria-hidden="true"
            className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"
          >
            <Layers className="size-4" />
          </span>
          <div className="min-w-0 flex-1 space-y-3 rounded-2xl rounded-tl-md bg-muted/60 px-4 py-3">
            {numbers ? (
              <p className="text-[0.9375rem] leading-[1.9]">
                {parts.map((part, i) => {
                  const value = numbers[part as keyof typeof numbers];
                  // biome-ignore lint/suspicious/noArrayIndexKey: partes fixas de uma frase.
                  return value ? <Num key={i}>{value}</Num> : <span key={i}>{part}</span>;
                })}
              </p>
            ) : data.refs.isPending ? (
              <div className="space-y-2" role="status" aria-label={m.common_loading()}>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{m.story_copilot_no_numbers()}</p>
            )}
          </div>
        </div>
        {numbers && (
          <p
            className="ob-mono flex items-center gap-2 rounded-lg bg-primary/[0.07] px-3 py-2 text-[12px] text-primary"
            {...rise(5)}
          >
            <ShieldCheck className="size-4 shrink-0" aria-hidden="true" />
            {m.story_copilot_verified({ n: numbers ? Object.keys(numbers).length : 0 })}
          </p>
        )}
      </div>
      <div className="border-border border-t bg-muted/30 px-5 py-4 sm:px-6">
        <h3 className="ob-kicker">{m.story_copilot_how()}</h3>
        <ol className="mt-3 grid gap-2 sm:grid-cols-3">
          {[m.story_copilot_how_1(), m.story_copilot_how_2(), m.story_copilot_how_3()].map(
            (text, i) => (
              <li key={text} className="flex gap-2.5 text-sm leading-snug" {...rise(6 + i)}>
                <span className="ob-mono text-[11.5px] text-primary tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {text}
              </li>
            ),
          )}
        </ol>
      </div>
    </div>
  );
}

const isMac = () => typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent);

export function CopilotStep({ data, actions }: StepProps) {
  const aiOff = data.ready.data?.llm_enabled === false;
  return (
    <Layout
      text={
        <>
          <Intro
            eyebrow={m.story_copilot_eyebrow()}
            title={m.story_copilot_title()}
            lead={m.story_copilot_lead()}
          />
          <div className="space-y-3" {...rise(3)}>
            {aiOff ? (
              <p role="note" className="rounded-xl bg-muted/70 p-4 text-sm leading-relaxed">
                {m.story_copilot_no_ai()}
              </p>
            ) : (
              <>
                <Button
                  size="lg"
                  className="h-12 gap-2 px-5 font-semibold"
                  onClick={() => actions.askCopilot(m.story_copilot_question())}
                >
                  <MessageSquareText aria-hidden="true" />
                  {m.story_copilot_cta()}
                </Button>
                <p className="text-muted-foreground text-xs">
                  {m.story_copilot_shortcut({ shortcut: isMac() ? '⌘K' : 'Ctrl K' })}
                </p>
              </>
            )}
          </div>
        </>
      }
      visual={<ChatExample data={data} />}
    />
  );
}

// ---- 6. O próximo passo: o piloto -----------------------------------------------------------------------------

const KPI_LABEL: Record<string, () => string> = {
  tonnes: () => m.story_pilot_kpi_tonnes({ months: PILOT_PARAMS.months }),
  eur_per_tonne: () => m.story_pilot_kpi_eurt(),
  reject_rate_pct: () => m.story_pilot_kpi_reject(),
};

const kpiFormat = (key: string, v: number) =>
  key === 'tonnes'
    ? formatTonnes(v, 1)
    : key === 'eur_per_tonne'
      ? eurPerTonne(v)
      : key === 'reject_rate_pct'
        ? formatPercent(v, 1)
        : formatNumber(v, 1);

/** População e densidade da freguesia, como a API as devolve (INE/CAOP); sem elas não se escreve nada. */
function ZoneFacts({ facts }: { facts: readonly { key: string; value: number }[] }) {
  const population = facts.find((f) => f.key === 'population')?.value;
  const density = facts.find((f) => f.key === 'density')?.value;
  if (population == null || density == null) return null;
  return (
    <span className="ob-mono mt-0.5 block text-[12px] opacity-80">
      {m.story_pilot_facts({
        population: formatNumber(population),
        density: formatNumber(density, 0),
      })}
    </span>
  );
}

export function PilotStep({ data, actions, guest }: StepProps) {
  const { pilot } = data;
  const parishes = pilot.data?.zones.map((z) => z.parish_name) ?? [];
  const ctas = (
    <div className="grid grid-cols-2 gap-2.5" {...rise(4)}>
      <Button
        size="lg"
        className="col-span-2 h-12 gap-2 px-5 font-semibold"
        onClick={() => actions.go('plan')}
      >
        {m.story_pilot_cta_plan()}
        <ArrowRight aria-hidden="true" />
      </Button>
      <Button
        size="lg"
        variant="outline"
        className="h-12 px-5"
        onClick={() => actions.go('simulator')}
      >
        {m.story_pilot_cta_simulate()}
      </Button>
      <Button size="lg" variant="outline" className="h-12 px-5" onClick={() => actions.go('pilot')}>
        {m.story_pilot_cta_pilot()}
      </Button>
    </div>
  );

  let visual: ReactNode;
  if (pilot.isPending) visual = <Loading className="min-h-80" />;
  else if (pilot.isError)
    visual = (
      <div className="space-y-3">
        <p className="text-muted-foreground text-sm">{m.story_pilot_error()}</p>
        <ErrorState error={pilot.error} onRetry={() => pilot.refetch()} />
      </div>
    );
  else
    visual = (
      <div className={cn(CARD, 'overflow-hidden')} {...rise(2)}>
        <div className="space-y-3 bg-primary p-5 text-primary-foreground sm:p-7">
          <p className="ob-mono flex items-center gap-2 text-[11.5px] uppercase opacity-85">
            <FlaskConical className="size-3.5" aria-hidden="true" />
            {m.story_pilot_parishes()}
          </p>
          <ul className="space-y-1.5">
            {pilot.data.zones.map((z, i) => (
              <li key={z.parish_code} className="flex items-baseline gap-3">
                <span className="ob-mono text-[12px] opacity-75">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="min-w-0">
                  <span className="block font-serif text-[1.4rem] leading-tight sm:text-[1.6rem]">
                    {z.parish_name}
                  </span>
                  <ZoneFacts facts={z.facts} />
                </span>
              </li>
            ))}
          </ul>
          <p className="ob-mono text-[12px] opacity-85">
            {m.story_pilot_startup({ cost: formatEur(pilot.data.startup_cost_eur) })}
          </p>
        </div>
        <div className="space-y-3 p-5 sm:p-7">
          <h3 className="ob-kicker flex items-center gap-2">
            {m.story_pilot_measures()}
            <Estimate />
          </h3>
          <ul className="divide-y divide-border">
            {pilot.data.kpis.map((k, i) => (
              <li
                key={k.key}
                {...rise(3 + i)}
                className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
              >
                <span className="text-sm">{KPI_LABEL[k.key]?.() ?? k.key}</span>
                <span className="text-right">
                  <span className="font-medium font-serif text-xl tabular-nums">
                    {kpiFormat(k.key, k.value)}
                  </span>
                  {k.p10 != null && k.p90 != null && (
                    <span className="ob-mono ml-2 text-[11.5px] text-muted-foreground tabular-nums">
                      {m.story_pilot_range({
                        lo: kpiFormat(k.key, k.p10),
                        hi: kpiFormat(k.key, k.p90),
                      })}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );

  return (
    <Layout
      text={
        <Intro
          eyebrow={m.story_pilot_eyebrow()}
          title={m.story_pilot_title({ months: PILOT_PARAMS.months })}
          lead={
            parishes.length > 0
              ? m.story_pilot_lead({
                  n: formatNumber(parishes.length),
                  months: PILOT_PARAMS.months,
                })
              : m.home_pilot_fallback()
          }
        />
      }
      after={
        <>
          {ctas}
          {guest && (
            <p
              role="note"
              className="flex gap-2.5 rounded-xl bg-muted/70 p-4 text-muted-foreground text-sm leading-relaxed"
            >
              <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {m.story_guest_note()}
            </p>
          )}
          <p className="text-muted-foreground text-xs">{m.story_pilot_outro()}</p>
        </>
      }
      visual={<div aria-live="polite">{visual}</div>}
    />
  );
}

export const STEP_COMPONENTS = {
  problem: ProblemStep,
  where: WhereStep,
  answer: AnswerStep,
  cost: CostStep,
  copilot: CopilotStep,
  pilot: PilotStep,
} as const;
