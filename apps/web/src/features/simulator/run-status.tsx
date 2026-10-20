import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';

/** Estado do cenário face ao formulário: o que o utilizador precisa de saber antes de decidir. */
export type RunStatus = 'draft' | 'running' | 'done' | 'stale' | 'infeasible' | 'invalid';

const LABEL: Record<RunStatus, () => string> = {
  draft: () => m.simx_status_draft(),
  running: () => m.simx_status_running(),
  done: () => m.simx_status_done(),
  stale: () => m.simx_status_stale(),
  infeasible: () => m.simx_status_infeasible(),
  invalid: () => m.simx_status_invalid(),
};

const TONE: Record<RunStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  running: 'bg-primary/10 text-primary',
  done: 'bg-primary/10 text-primary',
  stale: 'bg-areia/30 text-foreground',
  infeasible: 'bg-destructive/10 text-destructive',
  invalid: 'bg-destructive/10 text-destructive',
};

export function StatusChip({ status, className }: { status: RunStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-semibold text-[11px] leading-5',
        TONE[status],
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-1.5 rounded-full bg-current',
          status === 'running' && 'motion-safe:animate-pulse',
        )}
      />
      {LABEL[status]()}
    </span>
  );
}

/** Segundos decorridos desde que `active` passou a verdadeiro (relógio real, não simulado). */
export function useElapsedSeconds(active: boolean): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) {
      setSeconds(0);
      return;
    }
    const start = Date.now();
    const id = window.setInterval(() => setSeconds(Math.floor((Date.now() - start) / 1000)), 500);
    return () => window.clearInterval(id);
  }, [active]);
  return seconds;
}
