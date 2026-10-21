import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { getModelValidationOptions } from '@/client/@tanstack/react-query.gen';
import { Page, Section } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { Panel } from '@/components/panel';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { ErrorState, PageSkeleton } from '@/components/states';
import { ReadingsChart } from '@/features/validation/readings-chart';
import { SpatialSummary, WorstZones } from '@/features/validation/spatial-tables';
import { formatNumber, formatPercent } from '@/lib/format';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/validation')({
  staticData: { skeleton: 'table' },
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(getModelValidationOptions()),
  head: () => ({ meta: [{ title: m.title_validation() }] }),
  component: Validation,
});

const LIMITS = {
  no_time_series: [m.validation_limit_no_time_series, m.validation_limit_no_time_series_text],
  no_local_unit_costs: [
    m.validation_limit_no_local_unit_costs,
    m.validation_limit_no_local_unit_costs_text,
  ],
  no_textile_container_locations: [
    m.validation_limit_no_textile_container_locations,
    m.validation_limit_no_textile_container_locations_text,
  ],
} as const;

function Validation() {
  const { data, isPending, error, refetch } = useQuery(getModelValidationOptions());
  if (isPending) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const captures = data.readings.map((r) => r.implied_capture_pct);
  // A leitura principal (Vitrus + APA); as outras só triangulam.
  const base = data.readings.find((r) => r.is_model_base);
  const all = data.spatial.find((c) => c.kind === 'all');
  const underground = data.spatial.find((c) => c.kind === 'underground');
  const surface = data.spatial.find((c) => c.kind === 'surface');

  return (
    <Page>
      <PageHeader
        eyebrow={m.validation_eyebrow()}
        title={m.validation_title()}
        description={m.validation_description()}
      />
      <StatStrip>
        <StatCell
          label={m.validation_stat_collected()}
          value={`${formatNumber(data.baseline.collected_t, 1)} t`}
          hint={m.validation_stat_collected_hint({
            population: formatNumber(data.baseline.population),
          })}
        />
        <StatCell
          label={m.validation_stat_capture()}
          value={formatPercent(base?.implied_capture_pct ?? Math.min(...captures), 1)}
          hint={m.validation_stat_capture_hint({
            min: formatNumber(Math.min(...captures), 1),
            max: formatPercent(Math.max(...captures), 1),
          })}
          tag={m.common_estimate()}
          tone="primary"
        />
        {all && (
          <>
            <StatCell
              label={m.validation_stat_r2()}
              value={formatPercent(all.r2 * 100, 0)}
              hint={m.validation_stat_r2_hint()}
            />
            <StatCell
              label={m.validation_stat_error()}
              value={formatPercent(all.median_abs_pct_error, 0)}
              hint={m.validation_stat_error_hint({ others: formatNumber(all.n - 1) })}
            />
          </>
        )}
      </StatStrip>

      <ReadingsChart data={data} />

      {all && (
        <Section
          title={m.validation_spatial_title()}
          description={m.validation_spatial_description()}
        >
          <SpatialSummary checks={data.spatial} />
          {underground && surface && (
            <p className="text-muted-foreground text-sm leading-relaxed">
              {m.validation_spatial_read({
                underground: formatNumber(underground.r2, 2),
                surface: formatNumber(surface.r2, 2),
              })}
            </p>
          )}
          <h3 className="pt-2 font-semibold text-base">{m.validation_worst_title()}</h3>
          <WorstZones zones={all.worst} />
        </Section>
      )}

      <Section title={m.validation_limits_title()}>
        <div className="grid gap-3 md:grid-cols-3">
          {data.cannot_test.map((key) => {
            const text = LIMITS[key as keyof typeof LIMITS];
            if (!text) return null;
            return (
              <Panel key={key} title={text[0]()}>
                <p className="text-muted-foreground text-sm leading-relaxed">{text[1]()}</p>
              </Panel>
            );
          })}
        </div>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {m.validation_next()}{' '}
          <Link to="/pilot" className="font-medium text-primary underline-offset-4 hover:underline">
            {m.validation_next_link()}
          </Link>
        </p>
      </Section>
    </Page>
  );
}
