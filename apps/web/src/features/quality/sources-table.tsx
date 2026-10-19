import type { DataSourceOut } from '@/client';
import { type Column, DataTable } from '@/components/data-table';
import { formatDate } from '@/lib/i18n';
import { m } from '@/paraglide/messages';

export function SourcesTable({ sources }: { sources: DataSourceOut[] }) {
  const columns: Column<DataSourceOut>[] = [
    {
      id: 'file',
      header: m.quality_source_file(),
      primary: true,
      label: m.quality_source_file(),
      value: (s) => `${s.file_name} ${s.title} ${s.notes ?? ''}`,
      className: 'whitespace-normal',
      cell: (s) => (
        <div className="min-w-0">
          <p className="break-words font-medium">{s.file_name}</p>
          <p className="font-normal text-muted-foreground text-xs" lang="pt-PT">
            {s.title}
          </p>
          {s.notes && (
            <p className="mt-1 max-w-sm font-normal text-muted-foreground text-xs" lang="pt-PT">
              {s.notes}
            </p>
          )}
        </div>
      ),
    },
    {
      id: 'provider',
      header: m.quality_source_provider(),
      value: (s) => s.provider,
      filter: true,
      cell: (s) => s.provider,
    },
    {
      id: 'received',
      header: m.quality_source_received(),
      value: (s) => s.received_on,
      cell: (s) => (s.received_on ? formatDate(s.received_on) : m.common_dash()),
    },
    {
      id: 'period',
      header: m.quality_source_period(),
      value: (s) => s.period_start,
      searchable: false,
      cell: (s) =>
        s.period_start && s.period_end
          ? `${formatDate(s.period_start, 'short')} - ${formatDate(s.period_end, 'short')}`
          : m.common_dash(),
    },
    {
      id: 'fingerprint',
      header: m.quality_source_fingerprint(),
      defaultHidden: true,
      sortable: false,
      value: (s) => s.file_sha256,
      className: 'font-mono text-muted-foreground text-xs',
      cell: (s) => <span title={s.file_sha256}>{s.file_sha256.slice(0, 12)}…</span>,
    },
  ];
  return (
    <DataTable
      id="sources"
      columns={columns}
      rows={sources}
      getKey={(s) => s.key}
      caption={m.quality_sources_title()}
    />
  );
}
