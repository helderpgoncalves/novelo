import type { DataSourceOut } from '@/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate } from '@/lib/i18n';
import { m } from '@/paraglide/messages';

export function SourcesTable({ sources }: { sources: DataSourceOut[] }) {
  return (
    <div className="overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-10 px-4">{m.quality_source_file()}</TableHead>
            <TableHead className="h-10">{m.quality_source_provider()}</TableHead>
            <TableHead className="h-10">{m.quality_source_received()}</TableHead>
            <TableHead className="h-10">{m.quality_source_period()}</TableHead>
            <TableHead className="h-10 pr-4">{m.quality_source_fingerprint()}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sources.map((s) => (
            <TableRow key={s.key} className="align-top">
              <TableCell className="whitespace-normal px-4">
                <p className="font-medium">{s.file_name}</p>
                <p className="text-muted-foreground text-xs" lang="pt-PT">
                  {s.title}
                </p>
                {s.notes && (
                  <p className="mt-1 max-w-sm text-muted-foreground text-xs" lang="pt-PT">
                    {s.notes}
                  </p>
                )}
              </TableCell>
              <TableCell>{s.provider}</TableCell>
              <TableCell className="tabular-nums">
                {s.received_on ? formatDate(s.received_on) : m.common_dash()}
              </TableCell>
              <TableCell className="tabular-nums">
                {s.period_start && s.period_end
                  ? `${formatDate(s.period_start, 'short')} - ${formatDate(s.period_end, 'short')}`
                  : m.common_dash()}
              </TableCell>
              <TableCell
                className="pr-4 font-mono text-muted-foreground text-xs"
                title={s.file_sha256}
              >
                {s.file_sha256.slice(0, 12)}…
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
