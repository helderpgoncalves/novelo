import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function StatStrip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <dl
      className={cn(
        'grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border ring-1 ring-border lg:grid-cols-4 [&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-1',
        className,
      )}
    >
      {children}
    </dl>
  );
}

interface StatCellProps {
  label: string;
  value: string;
  hint?: ReactNode;
  tag?: string;
  /** `muted`: valor ainda por validar (ex.: «Por validar»). */
  tone?: 'default' | 'primary' | 'muted';
}

export function StatCell({ label, value, hint, tag, tone = 'default' }: StatCellProps) {
  return (
    // Subgrelha de 3 linhas (rótulo, valor, nota): na mesma fila, os valores alinham mesmo quando um rótulo dá duas linhas.
    <div className="row-span-3 grid min-w-0 grid-rows-subgrid content-start gap-y-1 bg-card p-3.5 sm:p-4">
      <dt className="flex flex-wrap items-center gap-x-2 gap-y-1 self-start font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.14em] sm:tracking-[0.18em]">
        {label}
        {tag && (
          <span className="rounded-full bg-areia/25 px-1.5 py-px font-semibold text-[9px] text-foreground/80">
            {tag}
          </span>
        )}
      </dt>
      <dd
        className={cn(
          'font-medium font-serif text-[1.65rem] tabular-nums leading-none tracking-tight sm:text-4xl',
          tone === 'primary' && 'text-primary',
          tone === 'muted' && 'text-muted-foreground',
        )}
      >
        {value}
      </dd>
      {hint && <p className="text-muted-foreground text-xs leading-relaxed">{hint}</p>}
    </div>
  );
}
