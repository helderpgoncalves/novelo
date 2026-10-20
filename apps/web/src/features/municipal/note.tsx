import { Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

/** Nota de contexto: estes contentores não são de têxteis. Discreta, mas sempre presente nos ecrãs municipais. */
export function MunicipalNote({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  return (
    <aside
      aria-label={m.mun_note_label()}
      className={cn(
        'flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 px-3.5 py-2.5 text-muted-foreground text-xs leading-relaxed',
        className,
      )}
    >
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <p>
        <span className="font-medium text-foreground">{m.mun_note_strong()}</span>{' '}
        {children ?? m.mun_note_text()}
      </p>
    </aside>
  );
}

/** Selo "estimativa", igual ao das tabelas de KPIs. */
export function EstimateBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full bg-areia/25 px-1.5 py-px font-semibold text-[9px] text-foreground/80 uppercase tracking-wider',
        className,
      )}
    >
      {m.common_estimate()}
    </span>
  );
}
