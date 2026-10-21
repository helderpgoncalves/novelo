import { Link } from '@tanstack/react-router';
import { ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { m } from '@/paraglide/messages';

const STEPS = [
  [() => m.pilot_empty_step1_title(), () => m.pilot_empty_step1_text()],
  [() => m.pilot_empty_step2_title(), () => m.pilot_empty_step2_text()],
  [() => m.pilot_empty_step3_title(), () => m.pilot_empty_step3_text()],
] as const;

/**
 * Estado vazio da operação do piloto: estes ecrãs só se enchem com triagens reais, por isso explica-se de onde vêm os
 * dados e leva-se ao primeiro passo, sem inventar números.
 */
export function PilotEmpty({ title, text }: { title: string; text: string }) {
  return (
    <section
      aria-labelledby="pilot-empty-title"
      className="rounded-xl border border-dashed bg-card/50 px-5 py-8 sm:px-10 sm:py-10"
    >
      <div className="mx-auto max-w-xl space-y-2 text-center">
        <p className="font-semibold text-[11px] text-primary uppercase tracking-[0.18em]">
          {m.pilot_empty_eyebrow()}
        </p>
        <h2 id="pilot-empty-title" className="text-balance font-serif text-2xl leading-tight">
          {title}
        </h2>
        <p className="text-pretty text-muted-foreground text-sm leading-relaxed">{text}</p>
      </div>
      <ol className="mx-auto mt-7 grid max-w-3xl gap-3 sm:grid-cols-3">
        {STEPS.map(([stepTitle, stepText], i) => (
          <li
            key={stepTitle()}
            className="rounded-lg bg-background/70 p-4 ring-1 ring-foreground/5"
          >
            <p className="flex items-center gap-2 font-medium text-sm">
              <span
                aria-hidden="true"
                className="grid size-6 shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary text-xs tabular-nums"
              >
                {i + 1}
              </span>
              {stepTitle()}
            </p>
            <p className="mt-1.5 text-muted-foreground text-xs leading-relaxed">{stepText()}</p>
          </li>
        ))}
      </ol>
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <Button asChild className="h-10 gap-2 font-semibold">
          <Link to="/triage">
            <ScanLine aria-hidden="true" /> {m.lots_start_triage()}
          </Link>
        </Button>
        <Button asChild variant="ghost" className="h-10">
          <Link to="/pilot">{m.pilot_empty_see_pilot()}</Link>
        </Button>
      </div>
    </section>
  );
}
