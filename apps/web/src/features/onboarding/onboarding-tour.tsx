import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  ArrowLeft,
  ArrowRight,
  Layers,
  MapPinned,
  MessagesSquare,
  ShieldAlert,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { OverviewGap, OverviewReference, UserOut } from '@/client';
import { getOverviewOptions } from '@/client/@tanstack/react-query.gen';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { formatKg, formatTonnes } from '@/lib/format';
import { m } from '@/paraglide/messages';
import {
  consumeTourPending,
  markTourSeen,
  setTourOpen,
  shouldAutoOpenTour,
  useTourOpen,
} from './tour-store';

const STEPS = 4;
const REFERENCE_KEY = 'france_2024';

/** Duas barras à mesma escala: o que Guimarães recolhe por habitante e o que recolhe a França. */
function Comparison({ gap, reference }: { gap: OverviewGap; reference: OverviewReference }) {
  const max = Math.max(gap.kg_per_inhab_year, reference.kg_per_inhab_year);
  const rows = [
    [m.tour_here(), gap.kg_per_inhab_year, 'bg-primary'],
    [reference.label, reference.kg_per_inhab_year, 'bg-areia'],
  ] as const;
  return (
    <ul className="space-y-3" aria-label={m.tour_chart_label()}>
      {rows.map(([label, value, color]) => (
        <li key={label} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">{label}</span>
            <span className="font-serif text-lg tabular-nums">{formatKg(value)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${color} motion-safe:transition-[width] motion-safe:duration-700`}
              style={{ width: `${Math.max(4, (value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
      <li className="text-muted-foreground text-xs">{m.tour_per_year()}</li>
    </ul>
  );
}

function ProblemStep() {
  const overview = useQuery({ ...getOverviewOptions(), enabled: true });
  const gap = overview.data?.gap;
  const reference = overview.data?.references.find((r) => r.key === REFERENCE_KEY);
  return (
    <div className="space-y-5">
      {overview.isPending ? (
        <div className="space-y-3" role="status" aria-label={m.common_loading()}>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : gap && reference ? (
        <>
          <Comparison gap={gap} reference={reference} />
          <p className="text-sm leading-relaxed">
            {m.tour_problem_gap({ missing: formatTonnes(gap.missing_t, 0) })}
          </p>
        </>
      ) : (
        <p className="text-sm leading-relaxed">{m.tour_problem_fallback()}</p>
      )}
    </div>
  );
}

function CanDoStep() {
  const items = [
    [Layers, m.tour_do_sim_title(), m.tour_do_sim_text()],
    [MapPinned, m.tour_do_map_title(), m.tour_do_map_text()],
    [MessagesSquare, m.tour_do_copilot_title(), m.tour_do_copilot_text()],
  ] as const;
  return (
    <ul className="space-y-4">
      {items.map(([Icon, title, text]) => (
        <li key={title} className="flex gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="font-semibold text-sm">{title}</p>
            <p className="text-muted-foreground text-sm leading-relaxed">{text}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Visita guiada de 4 passos: o problema (números reais da API), o que o Novelo faz, o que se pode fazer e um
 * primeiro passo. Folha inferior em telemóvel e diálogo em desktop (é o comportamento do `DialogContent`).
 */
export function OnboardingTour({ user }: { user: UserOut }) {
  const open = useTourOpen();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const guest = user.role === 'guest';

  // Primeira entrada de um convidado ou de uma conta nova: abre sozinha, já com a página assente.
  useEffect(() => {
    const pending = consumeTourPending();
    if (!shouldAutoOpenTour(user, pending)) return;
    const id = window.setTimeout(() => setTourOpen(true), 700);
    return () => window.clearTimeout(id);
  }, [user]);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const close = () => {
    markTourSeen(user.id);
    setTourOpen(false);
  };

  const content = [
    { title: m.tour_problem_title(), text: m.tour_problem_text(), body: <ProblemStep /> },
    { title: m.tour_what_title(), text: m.tour_what_text(), body: null },
    { title: m.tour_do_title(), text: m.tour_do_text(), body: <CanDoStep /> },
    {
      title: m.tour_first_title(),
      text: m.tour_first_text(),
      body: guest ? (
        <p className="flex gap-2.5 rounded-lg bg-muted/60 p-3 text-muted-foreground text-sm leading-relaxed">
          <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {m.tour_guest_note()}
        </p>
      ) : null,
    },
  ] as const;
  const current = content[step] ?? content[0];
  const last = step === STEPS - 1;

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? setTourOpen(true) : close())}>
      <DialogContent className="sm:max-w-md" aria-describedby="tour-text">
        <div
          key={step}
          className="motion-safe:fade-in-0 motion-safe:slide-in-from-right-3 motion-safe:animate-in space-y-5 duration-300"
        >
          <DialogHeader>
            <p className="font-semibold text-primary text-[11px] uppercase tracking-[0.18em]">
              {m.tour_step({ current: step + 1, total: STEPS })}
            </p>
            <DialogTitle className="text-balance text-2xl">{current.title}</DialogTitle>
            <DialogDescription id="tour-text" className="text-sm leading-relaxed">
              {current.text}
            </DialogDescription>
          </DialogHeader>
          {current.body}
        </div>
        <ol className="flex justify-center gap-1.5" aria-hidden="true">
          {content.map((c, i) => (
            <li
              key={c.title}
              className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-primary' : 'w-1.5 bg-border'}`}
            />
          ))}
        </ol>
        <DialogFooter className="gap-2 sm:items-center">
          {last ? (
            <>
              <Button variant="ghost" className="h-11" onClick={close}>
                {m.tour_explore()}
              </Button>
              <Button
                className="h-11 font-semibold"
                onClick={() => {
                  close();
                  void navigate({ to: '/simulator' });
                }}
              >
                {m.tour_first_cta()}
                <ArrowRight aria-hidden="true" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" className="h-11" onClick={close}>
                {m.tour_skip()}
              </Button>
              <Button
                variant="outline"
                className={`h-11 ${step === 0 ? 'invisible sm:hidden' : ''}`}
                tabIndex={step === 0 ? -1 : undefined}
                aria-hidden={step === 0 ? true : undefined}
                onClick={() => setStep(step - 1)}
              >
                <ArrowLeft aria-hidden="true" />
                {m.tour_back()}
              </Button>
              <Button className="h-11 font-semibold" onClick={() => setStep(step + 1)}>
                {m.tour_next()}
                <ArrowRight aria-hidden="true" />
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
