import type { ReactNode } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

export interface Column<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  align?: 'left' | 'right';
  /** Título do cartão em telemóvel (uma coluna por tabela). */
  primary?: boolean;
  /** Mostra o valor à direita do título do cartão (ex.: o estado). */
  badge?: boolean;
  /** Ocupa a largura toda do cartão (ex.: acções). */
  full?: boolean;
  /** Só aparece na tabela (desktop). */
  desktopOnly?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  getKey: (row: T) => string;
  empty?: ReactNode;
  className?: string;
  caption?: string;
}

/**
 * A mesma tabela em todo o produto: tabela com cabeçalho fixo em ecrãs largos e lista de cartões em telemóvel.
 * Cada coluna define como se mostra nos dois formatos, por isso nenhuma página tem scroll horizontal escondido.
 */
export function DataTable<T>({
  columns,
  rows,
  getKey,
  empty,
  className,
  caption,
}: DataTableProps<T>) {
  const primary = columns.find((c) => c.primary) ?? columns[0];
  const badge = columns.find((c) => c.badge);
  const details = columns.filter((c) => c !== primary && c !== badge && !c.desktopOnly);

  if (rows.length === 0 && empty) return <>{empty}</>;

  return (
    <div className={className}>
      <ul
        className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 md:hidden"
        aria-label={caption}
      >
        {rows.map((row) => (
          <li key={getKey(row)} className="space-y-2.5 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 font-medium [&_a]:-my-2.5 [&_a]:inline-block [&_a]:py-2.5">
                {primary?.cell(row)}
              </div>
              {badge && <div className="shrink-0">{badge.cell(row)}</div>}
            </div>
            {details.length > 0 && (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {details.map((c) => (
                  <div key={c.id} className={cn('min-w-0', c.full && 'col-span-2')}>
                    <dt className="text-[11px] text-muted-foreground uppercase tracking-wider">
                      {c.header}
                    </dt>
                    <dd className="mt-0.5 break-words tabular-nums">{c.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-xl bg-card ring-1 ring-foreground/10 md:block">
        <Table>
          {caption && <caption className="sr-only">{caption}</caption>}
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((c, i) => (
                <TableHead
                  key={c.id}
                  className={cn(
                    'h-10',
                    i === 0 && 'px-4',
                    i === columns.length - 1 && 'pr-4',
                    c.align === 'right' && 'text-right',
                    c.className,
                  )}
                >
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={getKey(row)} className="align-top">
                {columns.map((c, i) => (
                  <TableCell
                    key={c.id}
                    className={cn(
                      i === 0 && 'px-4 font-medium',
                      i === columns.length - 1 && 'pr-4',
                      c.align === 'right' && 'text-right tabular-nums',
                      c.className,
                    )}
                  >
                    {c.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
