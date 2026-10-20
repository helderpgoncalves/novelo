import { useQueryClient } from '@tanstack/react-query';
import { Link, useMatches, useRouterState } from '@tanstack/react-router';
import { Check, ListChecks, X } from 'lucide-react';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { MeOut } from '@/client';
import { getMeQueryKey } from '@/client/@tanstack/react-query.gen';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { openCopilot, useCopilotUi } from '@/features/copilot/store';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import { CHECKLIST_ITEMS, type ChecklistId } from './steps';
import { hasSeenTour, useTourOpen } from './tour-store';
import { useOnboarding } from './use-onboarding';

/** «Primeiros passos»: três gestos que mostram o valor do Novelo. Marca-se sozinho e desaparece quando completo. */
export const checklistProgress = (done: readonly string[]) => {
  const finished = CHECKLIST_ITEMS.filter((i) => done.includes(i));
  return {
    done: finished.length,
    total: CHECKLIST_ITEMS.length,
    complete: finished.length === CHECKLIST_ITEMS.length,
  };
};

const COPY: Record<ChecklistId, { label: () => string; hint: () => string }> = {
  scenario: { label: () => m.checklist_scenario(), hint: () => m.checklist_scenario_hint() },
  copilot: { label: () => m.checklist_copilot(), hint: () => m.checklist_copilot_hint() },
  map: { label: () => m.checklist_map(), hint: () => m.checklist_map_hint() },
};

const ROUTES: Partial<Record<ChecklistId, '/simulator' | '/map'>> = {
  scenario: '/simulator',
  map: '/map',
};

function Ring({ done, total }: { done: number; total: number }) {
  const r = 9;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 24 24" className="size-6 -rotate-90" aria-hidden="true">
      <circle cx="12" cy="12" r={r} fill="none" strokeWidth="3" className="stroke-border" />
      <circle
        cx="12"
        cy="12"
        r={r}
        fill="none"
        strokeWidth="3"
        strokeLinecap="round"
        className="stroke-primary motion-safe:transition-[stroke-dashoffset] motion-safe:duration-500"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - done / Math.max(total, 1))}
      />
    </svg>
  );
}

export function StarterChecklist({ user }: { user: MeOut }) {
  const { me, onboarding: state, update } = useOnboarding(user);
  const queryClient = useQueryClient();
  const tourOpen = useTourOpen();
  const { sheetOpen } = useCopilotUi();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const fullBleed = useMatches({ select: (ms) => ms.some((x) => x.staticData?.fullBleed) });
  const [open, setOpen] = useState(false);
  const progress = checklistProgress(state.checklist_done);

  // Ver o mapa marca-se ao entrar nele, mesmo que o checklist esteja escondido nesse ecrã.
  const markedMap = useRef(false);
  useEffect(() => {
    if (markedMap.current || state.checklist_done.includes('map')) return;
    if (pathname === '/map' || pathname.startsWith('/map/')) {
      markedMap.current = true;
      update({ mark: 'map' });
    }
  }, [pathname, state.checklist_done, update]);

  // Cenário e Copiloto deduzem-se dos dados do servidor: volta a ler ao navegar e ao fechar o Copiloto.
  const active = !progress.complete && !state.checklist_dismissed;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `pathname` e `sheetOpen` são os gatilhos
  useEffect(() => {
    if (active && !sheetOpen) void queryClient.invalidateQueries({ queryKey: getMeQueryKey() });
  }, [pathname, sheetOpen, active, queryClient]);

  const seen = Boolean(state.tour_seen_at) || hasSeenTour(me.id);
  if (!active || !seen || tourOpen || me.approval_status !== 'approved') return null;
  if (fullBleed || sheetOpen) return null;

  const items: ReactNode[] = CHECKLIST_ITEMS.map((id) => {
    const done = state.checklist_done.includes(id);
    const copy = COPY[id];
    const to = ROUTES[id];
    const cta = done ? null : to ? (
      <Button asChild variant="outline" size="sm" className="h-11 shrink-0 px-4 sm:h-9">
        <Link to={to} onClick={() => setOpen(false)}>
          {m.checklist_go()}
        </Link>
      </Button>
    ) : (
      <Button
        variant="outline"
        size="sm"
        className="h-11 shrink-0 px-4 sm:h-9"
        onClick={() => {
          setOpen(false);
          openCopilot();
        }}
      >
        {m.checklist_go()}
      </Button>
    );
    return (
      <li key={id} className="flex items-center gap-3 py-2">
        <span
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-full border',
            done ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
          )}
        >
          {done && <Check className="size-3.5" aria-hidden="true" />}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={cn(
              'block font-medium text-sm',
              done && 'text-muted-foreground line-through',
            )}
          >
            {copy.label()}
          </span>
          <span className="block text-muted-foreground text-xs">{copy.hint()}</span>
          {done && <span className="sr-only">{m.checklist_done()}</span>}
        </span>
        {cta}
      </li>
    );
  });

  return (
    <div
      data-testid="starter-checklist"
      className="pointer-events-none fixed z-40 right-[max(0.75rem,env(safe-area-inset-right))] bottom-[calc(var(--tabbar-h,0px)+0.75rem)] lg:right-6 lg:bottom-6"
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="pointer-events-auto h-11 gap-2 rounded-full bg-card/95 px-3.5 shadow-md backdrop-blur"
            aria-label={m.checklist_open({ done: progress.done, total: progress.total })}
          >
            <Ring done={progress.done} total={progress.total} />
            <span className="font-medium text-sm">{m.checklist_title()}</span>
            <span className="text-muted-foreground text-xs tabular-nums">
              {m.checklist_progress({ done: progress.done, total: progress.total })}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          side="top"
          sideOffset={10}
          className="w-80 rounded-2xl bg-card p-4 shadow-xl"
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <h2 className="font-serif text-lg">{m.checklist_title()}</h2>
            <Button
              variant="ghost"
              size="icon"
              className="-mr-2 size-11 sm:size-9"
              onClick={() => setOpen(false)}
              aria-label={m.checklist_close()}
            >
              <X aria-hidden="true" />
            </Button>
          </div>
          <ul className="divide-y divide-border/70">{items}</ul>
          <div className="mt-2 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              className="h-11 px-3 text-muted-foreground sm:h-9"
              onClick={() => {
                setOpen(false);
                update({ checklist_dismissed: true });
              }}
            >
              <ListChecks aria-hidden="true" />
              {m.checklist_dismiss()}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
