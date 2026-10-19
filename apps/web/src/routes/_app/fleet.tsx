import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { getFleetOptions } from '@/client/@tanstack/react-query.gen';
import { Page, SectionTitle } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { OccupancyHeatmap } from '@/features/fleet/occupancy-heatmap';
import { TypologyTable } from '@/features/fleet/typology-table';
import { VehiclesTable } from '@/features/fleet/vehicles-table';
import { formatNumber } from '@/lib/format';
import { formatDate } from '@/lib/i18n';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/fleet')({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(getFleetOptions()),
  head: () => ({ meta: [{ title: m.title_fleet() }] }),
  component: Fleet,
});

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <SectionTitle>{title}</SectionTitle>
        {description && (
          <p className="max-w-2xl text-muted-foreground text-sm leading-relaxed">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function Fleet() {
  const { data } = useSuspenseQuery(getFleetOptions());
  const idle = data.vehicles.filter((v) => v.never_assigned).length;
  const multi = data.vehicles.filter((v) => v.multi_typology).length;
  const period =
    data.period_start && data.period_end
      ? m.fleet_period({ start: formatDate(data.period_start), end: formatDate(data.period_end) })
      : '';

  return (
    <Page>
      <PageHeader
        eyebrow={m.fleet_eyebrow({ period })}
        title={m.fleet_title()}
        description={m.fleet_description()}
      />
      <StatStrip>
        <StatCell
          label={m.fleet_stat_assignments()}
          value={formatNumber(data.total_assignments)}
          hint={m.fleet_stat_assignments_hint()}
        />
        <StatCell
          label={m.fleet_stat_crew()}
          value={formatNumber(data.total_crew_shifts_week)}
          hint={m.fleet_stat_crew_hint()}
        />
        <StatCell
          label={m.fleet_stat_vehicles()}
          value={formatNumber(data.vehicles.length)}
          hint={m.fleet_stat_vehicles_hint({ count: idle })}
          tone="primary"
        />
        <StatCell
          label={m.fleet_stat_multi()}
          value={formatNumber(multi)}
          hint={m.fleet_stat_multi_hint()}
        />
      </StatStrip>
      <Section title={m.fleet_heatmap_title()} description={m.fleet_heatmap_description()}>
        <OccupancyHeatmap typologies={data.typologies} />
      </Section>
      <Section title={m.fleet_summary_title()}>
        <TypologyTable typologies={data.typologies} />
      </Section>
      <Section title={m.fleet_vehicles_title()} description={m.fleet_vehicles_description()}>
        <VehiclesTable vehicles={data.vehicles} />
      </Section>
    </Page>
  );
}
