import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { SlidersHorizontal } from 'lucide-react';
import { type ReactNode, useMemo, useRef } from 'react';
import { getOverviewOptions, getScenarioOptions } from '@/client/@tanstack/react-query.gen';
import { AsyncBoundary } from '@/components/async-boundary';
import { Page, Panel, Section } from '@/components/page';
import { CardSkeleton, ChartSkeleton, MapSkeleton } from '@/components/skeletons';
import { Button } from '@/components/ui/button';
import { useInViewOnce } from '@/lib/motion';
import { m } from '@/paraglide/messages';
import { type BudgetEstimate, budgetCurve, budgetRange, estimateAt, initialBudget } from './budget';
import { BudgetControl } from './budget-control';
import { CopilotAsk } from './copilot-ask';
import { questionInputs, trustItems } from './derive';
import { EvidenceTabs } from './evidence-tabs';
import { Fio } from './fio';
import { NextSteps } from './next-steps';
import { num, pct } from './safe';
import { SituationStrip } from './situation-strip';
import type { HomeTab, LayerId } from './tabs';
import { EYEBROW } from './tags';
import { Territory } from './territory';
import { TrustBar } from './trust-bar';

export interface HomeSearch {
  tab: HomeTab;
  layer: LayerId;
  parish: string | null;
  budget: number | null;
}

interface HomePageProps {
  role: 'admin' | 'operator' | 'guest';
  search: HomeSearch;
  onSearch: (
    patch: Partial<{ tab: HomeTab; layer: LayerId; parish: string | null; budget: number }>,
  ) => void;
}

const ANCHORS = [
  ['mapa', () => m.home_nav_map()],
  ['passos', () => m.home_nav_steps()],
  ['fio', () => m.home_nav_fio()],
  ['confianca', () => m.home_nav_trust()],
  ['provas', () => m.home_nav_evidence()],
] as const;

/** Só monta o conteúdo (e os seus pedidos) quando o bloco está perto do ecrã: o primeiro desenho não paga o que está por baixo da dobra. */
function WhenNear({ children, fallback }: { children: ReactNode; fallback: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const near = useInViewOnce(ref, '0px 0px 500px 0px');
  return <div ref={ref}>{near ? children : fallback}</div>;
}

/**
 * Sala de decisão: onde estamos (faixa), onde está o potencial (mapa), o que dá o orçamento (controlo), o que fazer a
 * seguir e a evidência. Só o resumo (`getOverview`) bloqueia o primeiro desenho; tudo o resto carrega por blocos, cada um
 * com o seu esqueleto e o seu erro.
 */
export function HomePage({ role, search, onSearch }: HomePageProps) {
  const { data: overview } = useSuspenseQuery(getOverviewOptions());
  const { gap, scenario_frontier: frontier } = overview;

  const curve = useMemo(() => budgetCurve(frontier), [frontier]);
  const range = useMemo(() => budgetRange(curve), [curve]);
  const initial = range ? initialBudget(range, search.budget ?? undefined) : 0;

  // O mapa só marca as freguesias cobertas depois de o orçamento ser escolhido (alça largada ou URL partilhada).
  const chosen = useMemo(
    () => (search.budget !== null && range ? estimateAt(curve, initial) : null),
    [curve, range, search.budget, initial],
  );
  const scenario = useQuery({
    ...getScenarioOptions({ path: { scenario_id: chosen?.nearest.id ?? '' } }),
    enabled: chosen !== null,
    staleTime: 10 * 60_000,
  });
  const covered = useMemo(
    () =>
      chosen && scenario.data
        ? new Set(
            scenario.data.result.allocations
              .filter((a) => a.mode !== null && a.tonnes > 0)
              .map((a) => a.parish_code),
          )
        : null,
    [chosen, scenario.data],
  );
  const coveredNote =
    chosen && covered
      ? m.home_covered_note({ count: covered.size, label: chosen.nearest.label })
      : null;

  const questions = useMemo(
    () => questionInputs(overview, chosen ? initial : null),
    [overview, chosen, initial],
  );
  const trust = useMemo(() => trustItems(overview), [overview]);
  const locationsMissing = trust.some(
    (t) => t.key === 'textile_containers' && t.status === 'missing',
  );

  const commit = (budget: number, _estimate: BudgetEstimate | null) => onSearch({ budget });

  return (
    <Page className="space-y-6 sm:space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 space-y-1.5">
          <p className={EYEBROW}>{m.home_eyebrow({ year: gap.year })}</p>
          <h1 className="max-w-3xl text-balance font-medium text-[1.7rem] leading-[1.12] tracking-tight sm:text-4xl">
            {m.home_headline({
              pct: pct(gap.capture_pct, 0),
              missing: num(gap.missing_t, 0),
            })}
          </h1>
        </div>
        <Button asChild size="lg" className="hidden h-11 gap-2 sm:inline-flex">
          <Link to="/simulator">
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            {m.home_cta_simulate()}
          </Link>
        </Button>
      </header>

      <nav aria-label={m.home_nav_label()} className="-mt-3 hidden gap-1 sm:flex">
        {ANCHORS.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className="inline-flex min-h-10 items-center rounded-full px-3 text-muted-foreground text-sm outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/60"
          >
            {label()}
          </a>
        ))}
      </nav>

      <AsyncBoundary fallback={<ChartSkeleton className="h-28" />}>
        <SituationStrip overview={overview} />
      </AsyncBoundary>

      <section id="mapa" aria-labelledby="home-map-title" className="scroll-mt-20 space-y-3">
        <h2 id="home-map-title" className="sr-only">
          {m.home_nav_map()}
        </h2>
        <AsyncBoundary fallback={<MapSkeleton />}>
          <Territory
            overview={overview}
            layer={search.layer}
            onLayerChange={(layer) => onSearch({ layer })}
            parish={search.parish}
            onParishChange={(parish) => onSearch({ parish })}
            covered={covered}
            coveredNote={coveredNote}
            budget={
              <BudgetControl
                curve={curve}
                initial={initial}
                collectedT={gap.collected_t}
                potentialT={gap.potential_t}
                onCommit={commit}
              />
            }
          />
        </AsyncBoundary>
      </section>

      <section id="passos" className="scroll-mt-20 grid grid-cols-1 gap-5 lg:grid-cols-12">
        <Section
          title={m.home_steps_title()}
          description={m.home_steps_description()}
          className="lg:col-span-7"
        >
          <Panel className="py-1 sm:py-2">
            <WhenNear fallback={<CardSkeleton className="min-h-72 border-0 ring-0" />}>
              <AsyncBoundary fallback={<CardSkeleton className="min-h-72 border-0 ring-0" />}>
                <NextSteps role={role} textileLocationsMissing={locationsMissing} />
              </AsyncBoundary>
            </WhenNear>
          </Panel>
        </Section>
        <Section
          title={m.home_ask_title()}
          description={m.home_ask_description()}
          className="lg:col-span-5"
        >
          <AsyncBoundary fallback={<CardSkeleton />}>
            <CopilotAsk inputs={questions} />
          </AsyncBoundary>
        </Section>
      </section>

      <div id="fio" className="scroll-mt-20">
        <Section
          title={m.home_fio_title()}
          description={m.home_fio_description({ pct: num(Math.round(gap.capture_pct)) })}
        >
          <AsyncBoundary fallback={<ChartSkeleton className="h-72" />}>
            <Fio gap={gap} />
          </AsyncBoundary>
        </Section>
      </div>

      <div id="confianca" className="scroll-mt-20">
        <Section title={m.home_trust_title()} description={m.home_trust_description()}>
          <Panel>
            <AsyncBoundary fallback={<CardSkeleton />}>
              <TrustBar items={trust} />
            </AsyncBoundary>
          </Panel>
        </Section>
      </div>

      <div id="provas" className="scroll-mt-20">
        <Section
          title={m.home_s7_title()}
          description={m.home_s7_description()}
          className="border-border border-t pt-8"
        >
          <WhenNear fallback={<ChartSkeleton className="h-96" />}>
            <AsyncBoundary fallback={<ChartSkeleton className="h-96" />}>
              <EvidenceTabs
                overview={overview}
                tab={search.tab}
                onTabChange={(tab) => onSearch({ tab })}
              />
            </AsyncBoundary>
          </WhenNear>
        </Section>
      </div>
    </Page>
  );
}
