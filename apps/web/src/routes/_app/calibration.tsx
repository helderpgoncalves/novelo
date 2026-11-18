import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { getCalibrationOptions } from '@/client/@tanstack/react-query.gen';
import { Page, Section } from '@/components/page';
import { PageHeader } from '@/components/page-header';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { ErrorState, PageSkeleton } from '@/components/states';
import { CalibrationTable } from '@/features/calibration/calibration-table';
import { formatNumber } from '@/lib/format';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/calibration')({
  staticData: { skeleton: 'table' },
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(getCalibrationOptions()),
  head: () => ({ meta: [{ title: m.title_calibration() }] }),
  component: Calibration,
});

function Calibration() {
  const { data, isPending, error, refetch } = useQuery(getCalibrationOptions());

  if (isPending) return <PageSkeleton />;
  if (error || !data) return <ErrorState error={error} onRetry={() => void refetch()} />;

  const rows = data.rows;
  const units = new Set(rows.filter((r) => r.n > 0).map((r) => r.unit_code)).size;
  const samples = rows.filter((r) => r.n > 0).reduce((sum, r) => sum + r.n, 0);
  const dominant = rows.filter((r) => r.n >= r.pseudo_k).length;

  return (
    <Page>
      <PageHeader
        eyebrow={m.calibration_eyebrow()}
        title={m.calibration_title()}
        description={m.calibration_description()}
      />
      <StatStrip>
        <StatCell
          label={m.calibration_stat_units()}
          value={formatNumber(units)}
          hint={m.calibration_stat_units_hint()}
        />
        <StatCell
          label={m.calibration_stat_samples()}
          value={formatNumber(samples)}
          hint={m.calibration_stat_samples_hint()}
        />
        <StatCell
          label={m.calibration_stat_observed()}
          value={formatNumber(dominant)}
          hint={m.calibration_stat_observed_hint()}
          tone={dominant > 0 ? 'primary' : undefined}
        />
      </StatStrip>
      <Section title={m.calibration_title()}>
        <CalibrationTable id="calibracao" />
      </Section>
    </Page>
  );
}
