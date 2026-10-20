import { AlertTriangle, Inbox, SearchX } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { getErrorMessage } from '@/lib/errors';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

function Message({
  icon,
  title,
  hint,
  children,
  tone,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  children?: ReactNode;
  tone?: 'error';
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : undefined}
      className="flex flex-col items-center gap-2 px-6 py-12 text-center"
    >
      <div
        className={cn(
          'mb-1 flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground [&_svg]:size-5',
          tone === 'error' && 'bg-destructive/10 text-destructive',
        )}
        aria-hidden="true"
      >
        {icon}
      </div>
      <p className="font-medium text-sm">{title}</p>
      {hint && <p className="max-w-sm text-muted-foreground text-sm">{hint}</p>}
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}

export function TableEmpty({ action }: { action?: ReactNode }) {
  return (
    <Message icon={<Inbox />} title={m.dt_empty_title()} hint={m.dt_empty_hint()}>
      {action}
    </Message>
  );
}

export function TableNoMatch({ onClear }: { onClear: () => void }) {
  return (
    <Message icon={<SearchX />} title={m.table_no_results()} hint={m.table_no_results_hint()}>
      <Button variant="outline" className="h-10" onClick={onClear}>
        {m.table_clear_all()}
      </Button>
    </Message>
  );
}

export function TableError({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <Message
      tone="error"
      icon={<AlertTriangle />}
      title={m.dt_error_title()}
      hint={getErrorMessage(error)}
    >
      {onRetry && (
        <Button variant="outline" className="h-10" onClick={onRetry}>
          {m.common_retry()}
        </Button>
      )}
    </Message>
  );
}

/** Linhas de carregamento com a mesma altura das reais, para o conteúdo não saltar. */
export function SkeletonRows({
  columns,
  rows,
  tall,
}: {
  columns: number;
  rows: number;
  tall: boolean;
}) {
  return (
    <tbody aria-hidden="true">
      {Array.from({ length: rows }, (_, r) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: linhas estáticas de carregamento
        <tr key={r} className="border-b last:border-0">
          {Array.from({ length: columns }, (_, c) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: células estáticas de carregamento
            <td key={c} className={cn('px-3', tall ? 'py-3.5' : 'py-2.5', c === 0 && 'pl-4')}>
              <Skeleton className={cn('h-4', c === 0 ? 'w-24' : c % 2 ? 'w-16' : 'w-28')} />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

export function SkeletonCards({ rows }: { rows: number }) {
  return (
    <ul className="divide-y divide-border md:hidden" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: cartões estáticos de carregamento
        <li key={i} className="space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </li>
      ))}
    </ul>
  );
}
