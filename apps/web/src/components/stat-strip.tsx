import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function StatStrip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <dl
      className={cn(
        'grid gap-px overflow-hidden rounded-xl bg-border ring-1 ring-border sm:grid-cols-2 lg:grid-cols-4',
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
  tone?: 'default' | 'primary';
}

export function StatCell({ label, value, hint, tag, tone = 'default' }: StatCellProps) {
  return (
    <div className="flex flex-col gap-1.5 bg-card p-5">
      <dt className="flex items-center gap-2 font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.18em]">
        {label}
        {tag && (
          <span className="rounded-full bg-areia/25 px-1.5 py-px font-semibold text-[9px] text-foreground/80">
            {tag}
          </span>
        )}
      </dt>
      <dd
        className={cn(
          'font-medium font-serif text-4xl tabular-nums leading-none tracking-tight',
          tone === 'primary' && 'text-primary',
        )}
      >
        {value}
      </dd>
      {hint && <p className="text-muted-foreground text-xs leading-relaxed">{hint}</p>}
    </div>
  );
}
