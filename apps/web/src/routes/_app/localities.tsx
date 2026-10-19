import { useSuspenseQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { listLocalitiesOptions } from '@/client/@tanstack/react-query.gen';
import { PageHeader } from '@/components/page-header';
import { StatCell, StatStrip } from '@/components/stat-strip';
import { LocalitiesTable } from '@/features/localities/localities-table';
import { formatNumber } from '@/lib/format';
import { m } from '@/paraglide/messages';

export const Route = createFileRoute('/_app/localities')({
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(listLocalitiesOptions()),
  head: () => ({ meta: [{ title: m.title_localities() }] }),
  component: Localities,
});

function Localities() {
  const { data } = useSuspenseQuery(listLocalitiesOptions());
  const frequent = data.filter((l) => l.days_per_week >= 3).length;
  const sparse = data.filter((l) => l.days_per_week > 0 && l.days_per_week < 3).length;
  const none = data.filter((l) => l.days_per_week === 0).length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={m.localities_eyebrow()}
        title={m.localities_title()}
        description={m.localities_description()}
      />
      <StatStrip>
        <StatCell
          label={m.localities_stat_total()}
          value={formatNumber(data.length)}
          hint={m.localities_stat_total_hint()}
        />
        <StatCell
          label={m.localities_stat_frequent()}
          value={formatNumber(frequent)}
          hint={m.localities_stat_frequent_hint()}
          tone="primary"
        />
        <StatCell
          label={m.localities_stat_sparse()}
          value={formatNumber(sparse)}
          hint={m.localities_stat_sparse_hint()}
        />
        <StatCell
          label={m.localities_stat_none()}
          value={formatNumber(none)}
          hint={m.localities_stat_none_hint()}
        />
      </StatStrip>
      <LocalitiesTable localities={data} />
    </div>
  );
}
