import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import type { RunStatus } from './run-status';

export type StepId = 'goal' | 'assumptions' | 'options' | 'result';
type Tone = 'ok' | 'default' | 'error' | 'pending' | 'running' | 'stale';

interface ProgressStepsProps {
  goalInvalid: boolean;
  assumptionsChanged: boolean;
  optionsChanged: boolean;
  status: RunStatus;
  onSelect: (id: StepId) => void;
}

const BAR: Record<Tone, string> = {
  ok: 'bg-primary',
  default: 'bg-primary/35',
  error: 'bg-destructive',
  pending: 'bg-border',
  running: 'bg-primary/60 motion-safe:animate-pulse',
  stale: 'bg-areia',
};

/** Quatro segmentos finos: onde estás e o que já está pronto. Tocar salta para a secção. */
export function ProgressSteps({
  goalInvalid,
  assumptionsChanged,
  optionsChanged,
  status,
  onSelect,
}: ProgressStepsProps) {
  const resultTone: Tone =
    status === 'running'
      ? 'running'
      : status === 'done'
        ? 'ok'
        : status === 'stale'
          ? 'stale'
          : status === 'infeasible'
            ? 'error'
            : 'pending';
  const steps: { id: StepId; label: string; tone: Tone; disabled?: boolean }[] = [
    {
      id: 'goal',
      label: m.simx_prog_objective(),
      tone: goalInvalid ? 'error' : 'ok',
    },
    {
      id: 'assumptions',
      label: m.simx_prog_assumptions(),
      tone: assumptionsChanged ? 'ok' : 'default',
    },
    { id: 'options', label: m.simx_prog_options(), tone: optionsChanged ? 'ok' : 'default' },
    {
      id: 'result',
      label: m.simx_prog_result(),
      tone: resultTone,
      disabled: status === 'draft' || status === 'invalid' || status === 'running',
    },
  ];

  return (
    <nav aria-label={m.simx_progress_aria()}>
      <ol className="grid grid-cols-4 gap-1.5">
        {steps.map((s) => (
          <li key={s.id} className="min-w-0">
            <button
              type="button"
              disabled={s.disabled}
              onClick={() => onSelect(s.id)}
              className="group flex min-h-10 w-full flex-col justify-center gap-1.5 rounded-md text-left focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:cursor-default"
            >
              <span aria-hidden="true" className={cn('h-1 w-full rounded-full', BAR[s.tone])} />
              <span
                className={cn(
                  'truncate font-medium text-xs leading-none',
                  s.tone === 'error'
                    ? 'text-destructive'
                    : s.disabled
                      ? 'text-muted-foreground'
                      : 'text-foreground group-hover:text-primary',
                )}
              >
                {s.label}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
