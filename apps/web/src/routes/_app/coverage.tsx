import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { z } from 'zod';
import { getCoverageOptions, listZonesOptions } from '@/client/@tanstack/react-query.gen';
import { FilterChips } from '@/components/filter-chips';
import { Page, Section } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AwaitingPanel } from '@/features/coverage/awaiting-panel';
import { CoverageMap } from '@/features/coverage/coverage-map';
import { CoverageTable } from '@/features/coverage/coverage-table';
import { ReferenceCard } from '@/features/coverage/reference-card';
import { buildRows } from '@/features/coverage/rows';
import { formatNumber, formatPercent } from '@/lib/format';
import { m } from '@/paraglide/messages';

const RADII = [200, 300, 500] as const;
type Radius = (typeof RADII)[number];

export const Route = createFileRoute('/_app/coverage')({
  staticData: { skeleton: 'map' },
  validateSearch: z.object({
    radius: z.union([z.literal(200), z.literal(300), z.literal(500)]).catch(300),
  }),
  loaderDeps: ({ search }) => ({ radius: search.radius }),
  loader: ({ context: { queryClient }, deps }) =>
    Promise.all([
      queryClient.ensureQueryData(getCoverageOptions({ query: { radius_m: deps.radius } })),
      queryClient.ensureQueryData(listZonesOptions()),
    ]),
  head: () => ({ meta: [{ title: m.title_coverage() }] }),
  component: Coverage,
});

function Coverage() {
  const { radius } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { data: summary } = useSuspenseQuery(getCoverageOptions({ query: { radius_m: radius } }));
  const { data: zones } = useSuspenseQuery(listZonesOptions());

  const ready = summary.state === 'ok';
  const rows = buildRows(zones, summary);
  const setRadius = (value: Radius | null) =>
    navigate({ search: { radius: value ?? 300 }, replace: true });

  return (
    <Page>
      <PageHeader
        eyebrow={m.cov_eyebrow()}
        title={m.cov_title()}
        description={m.cov_description()}
        actions={
          <FilterChips<`${Radius}`>
            legend={m.cov_radius()}
            value={`${radius}`}
            onChange={(v) => setRadius(v ? (Number(v) as Radius) : null)}
            options={RADII.map((r) => ({
              value: `${r}` as const,
              label: m.cov_radius_option({ value: r }),
            }))}
          />
        }
      />

      {ready ? (
        <StatStrip>
          <StatCell
            label={m.cov_stat_covered()}
            value={
              summary.covered_pct != null ? formatPercent(summary.covered_pct, 0) : m.common_dash()
            }
            tag={m.common_estimate()}
            tone="primary"
            hint={m.cov_stat_covered_hint({
              count: formatNumber(summary.covered_population ?? 0),
              radius: summary.radius_m,
            })}
          />
          <StatCell
            label={m.cov_stat_containers()}
            value={formatNumber(summary.containers)}
            hint={m.cov_stat_containers_hint({ total: formatNumber(summary.containers_total) })}
          />
          <StatCell
            label={m.cov_stat_per_1000()}
            value={
              summary.containers_per_1000 != null
                ? formatNumber(summary.containers_per_1000, 2)
                : m.common_dash()
            }
            hint={m.cov_stat_per_1000_hint()}
          />
          <StatCell
            label={m.cov_stat_gap()}
            value={summary.gap_points != null ? formatNumber(summary.gap_points) : m.common_dash()}
            tag={m.common_estimate()}
            hint={m.cov_stat_gap_hint({ points: formatNumber(summary.reference.points) })}
          />
        </StatStrip>
      ) : (
        <StatStrip>
          <StatCell
            label={m.cov_stat_population()}
            value={formatNumber(summary.population)}
            hint={m.cov_stat_population_hint()}
          />
          <StatCell
            label={m.cov_stat_parishes()}
            value={formatNumber(zones.length)}
            hint={m.cov_stat_parishes_hint()}
          />
          <StatCell
            label={m.cov_stat_reference()}
            value={formatNumber(summary.reference.points)}
            tag={m.common_estimate()}
            hint={m.cov_stat_reference_hint({
              people: formatNumber(summary.reference.people_per_point),
            })}
          />
          <StatCell
            label={m.cov_stat_containers()}
            value={formatNumber(summary.containers_total)}
            hint={m.cov_stat_waiting_hint()}
          />
        </StatStrip>
      )}

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12 lg:gap-6">
        <div className="min-w-0 space-y-5 sm:space-y-7 lg:col-span-7">
          {!ready && <AwaitingPanel />}
          <Section
            title={m.cov_table_title()}
            description={
              ready
                ? m.cov_table_description_ok({ radius: summary.radius_m })
                : m.cov_table_description_waiting()
            }
          >
            <CoverageTable rows={rows} ready={ready} />
          </Section>
        </div>
        <div className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:col-span-5">
          <ReferenceCard reference={summary.reference} />
          <CoverageMap
            zones={zones}
            rows={rows}
            metric={ready ? 'covered_pct' : 'population'}
            className="h-[22rem] overflow-hidden rounded-xl ring-1 ring-foreground/10 sm:h-[30rem] lg:h-[34rem]"
          />
        </div>
      </div>

      <Collapsible className="rounded-xl bg-card ring-1 ring-foreground/10">
        <CollapsibleTrigger className="flex min-h-12 w-full items-center justify-between px-5 text-left font-medium text-sm">
          {m.cov_method_title()}
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 px-5 pb-5 text-muted-foreground text-sm leading-relaxed">
          <p className="font-medium text-foreground">{m.cov_method_estimate()}</p>
          <p>{summary.method}</p>
          <p>{m.cov_method_radius()}</p>
        </CollapsibleContent>
      </Collapsible>
    </Page>
  );
}
