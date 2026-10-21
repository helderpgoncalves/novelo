import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { type CSSProperties, useCallback, useEffect, useRef } from 'react';
import type { MeOut } from '@/client';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';
import { openCopilot } from '@/features/copilot/store';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import '@/features/landing/landing-assets.generated.css';
import {
  clampStory,
  STORY_STEPS,
  STORY_TOTAL,
  type StoryStepId,
  storyKeyAction,
} from './story-model';
import { STEP_COMPONENTS, type StoryActions } from './story-steps';
import {
  clearTourProgress,
  markTourSeen,
  setTourIndex,
  setTourOpen,
  useTourState,
  writeTourProgress,
} from './tour-store';
import { useOnboarding } from './use-onboarding';
import { useStoryData } from './use-story-data';

const NAMES: Record<StoryStepId, () => string> = {
  problem: () => m.story_name_problem(),
  where: () => m.story_name_where(),
  answer: () => m.story_name_answer(),
  cost: () => m.story_name_cost(),
  copilot: () => m.story_name_copilot(),
  pilot: () => m.story_name_pilot(),
};

/** O menu e os diálogos devolvem o foco ao fechar; só depois o Copiloto o toma. */
const HANDOFF_DELAY_MS = 180;
const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Apresentação de primeira visita: seis passos que contam o impacto com os números da API (o problema, onde se perde,
 * a resposta sem contentores, quanto custa, o Copiloto e o piloto). Ecrã completo a partir de 640 px, folha inferior
 * em telemóvel. Saltável a qualquer momento (botão, Esc), retomável pelo menu da conta, ←/→ e Home/End para navegar.
 * O foco fica preso no diálogo (Radix) e passa para o botão principal a cada passo; com movimento reduzido tudo aparece
 * já no estado final. Ao saltar ou ao terminar marca-se como vista na API (por conta).
 */
export default function OnboardingStory({ user }: { user: MeOut }) {
  const { open, index } = useTourState();
  const { update } = useOnboarding(user);
  const navigate = useNavigate();
  const data = useStoryData();
  const current = clampStory(index);
  const id = STORY_STEPS[current] ?? 'problem';
  const first = current === 0;
  const last = current === STORY_TOTAL - 1;
  const Step = STEP_COMPONENTS[id];
  const primaryRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const direction = useRef(1);

  const finish = useCallback(() => {
    markTourSeen(user.id);
    clearTourProgress(user.id);
    update({ tour: 'seen' });
    setTourOpen(false);
  }, [user.id, update]);

  const skip = useCallback(() => {
    markTourSeen(user.id);
    if (current > 0 && current < STORY_TOTAL - 1) writeTourProgress(user.id, current);
    else clearTourProgress(user.id);
    update({ tour: 'seen' });
    setTourOpen(false);
  }, [user.id, current, update]);

  const goTo = useCallback(
    (next: number) => {
      const clamped = clampStory(next);
      direction.current = clamped >= current ? 1 : -1;
      setTourIndex(clamped);
      if (clamped > 0 && clamped < STORY_TOTAL - 1) writeTourProgress(user.id, clamped);
    },
    [current, user.id],
  );

  const actions: StoryActions = {
    askCopilot: (question) => {
      skip();
      window.setTimeout(() => openCopilot({ question, send: false }), HANDOFF_DELAY_MS);
    },
    go: (to) => {
      finish();
      if (to === 'plan') void navigate({ to: '/', hash: 'plano' });
      else void navigate({ to: to === 'pilot' ? '/pilot' : '/simulator' });
    },
  };

  // A cada passo: volta ao topo e o foco vai para o botão principal (o leitor de ecrã anuncia o passo na região viva).
  // biome-ignore lint/correctness/useExhaustiveDependencies: corre quando muda o passo
  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: 0 });
    primaryRef.current?.focus({ preventScroll: true });
  }, [open, id]);

  // ←/→, Home/End e Esc em qualquer ponto do diálogo; ⌘K (Copiloto) fica para depois da apresentação.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const action = storyKeyAction(e.key, current, {
        alt: e.altKey,
        ctrl: e.ctrlKey,
        meta: e.metaKey,
      });
      if (!action) return;
      e.preventDefault();
      e.stopPropagation();
      if (action.type === 'close') skip();
      else goTo(action.index);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, current, goTo, skip]);

  const name = NAMES[id]();
  const stepLabel = m.story_step_of({ current: current + 1, total: STORY_TOTAL });

  const progress = (
    <div
      role="progressbar"
      aria-label={m.story_progress()}
      aria-valuemin={1}
      aria-valuemax={STORY_TOTAL}
      aria-valuenow={current + 1}
      aria-valuetext={stepLabel}
      className="flex gap-1.5"
    >
      {STORY_STEPS.map((s, i) => (
        <span key={s} className="h-1 flex-1 overflow-hidden rounded-full bg-border">
          <span
            className={cn(
              'block h-full origin-left rounded-full bg-primary motion-safe:transition-transform motion-safe:duration-500',
              i <= current ? 'scale-x-100' : 'scale-x-0',
            )}
          />
        </span>
      ))}
    </div>
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => !next && skip()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-[#0b1411]/60 data-[state=open]:motion-safe:fade-in-0 data-[state=open]:motion-safe:animate-in sm:bg-transparent" />
        <DialogPrimitive.Content
          data-testid="onboarding-story"
          aria-describedby="story-lead"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            primaryRef.current?.focus({ preventScroll: true });
          }}
          // Esc trata-se no atalho global (para ser igual em qualquer foco); aqui só se evita o fecho em duplicado.
          onEscapeKeyDown={(e) => e.preventDefault()}
          className={cn(
            'ob-root fixed z-[70] flex flex-col bg-background text-foreground outline-none',
            // telemóvel: folha inferior
            'inset-x-0 bottom-0 max-h-[94dvh] rounded-t-[1.75rem] border-border border-t shadow-2xl',
            'data-[state=open]:motion-safe:slide-in-from-bottom data-[state=open]:motion-safe:animate-in data-[state=open]:motion-safe:duration-300',
            // a partir de 640 px: ecrã completo
            'sm:inset-0 sm:max-h-none sm:rounded-none sm:border-0 sm:shadow-none',
            'sm:data-[state=open]:motion-safe:slide-in-from-bottom-0 sm:data-[state=open]:motion-safe:fade-in-0',
          )}
        >
          {/* Pega da folha (só telemóvel). */}
          <span
            aria-hidden="true"
            className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-border sm:hidden"
          />

          <header className="flex shrink-0 items-center gap-3 px-4 pt-2 pb-3 sm:h-16 sm:border-border sm:border-b sm:px-6 sm:py-0 lg:px-8">
            <BrandLogo className="hidden h-6 sm:block" />
            <span aria-hidden="true" className="hidden h-5 w-px bg-border sm:block" />
            <p className="ob-mono min-w-0 truncate text-[11.5px] text-muted-foreground uppercase">
              <span className="text-primary tabular-nums">
                {m.story_counter({ current: pad(current + 1), total: pad(STORY_TOTAL) })}
              </span>
              <span aria-hidden="true"> · </span>
              {name}
            </p>
            <Button
              variant="ghost"
              size="lg"
              className="ml-auto h-11 gap-1.5 px-3 text-muted-foreground hover:text-foreground"
              onClick={skip}
              aria-label={m.story_skip_aria()}
            >
              {m.story_skip()}
              <X aria-hidden="true" />
            </Button>
          </header>

          <div className="flex min-h-0 flex-1">
            {/* Coluna dos passos (ecrã largo): navegação direta, com a fábrica têxtil em meio-tom ao fundo. */}
            <nav
              aria-label={m.story_nav_label()}
              className="photo-bg photo-fabrica ob-rail-photo relative hidden w-72 shrink-0 flex-col border-border border-r lg:flex xl:w-80"
            >
              <ol className="space-y-1 p-5 xl:p-6">
                {STORY_STEPS.map((s, i) => (
                  <li key={s}>
                    <button
                      type="button"
                      onClick={() => goTo(i)}
                      aria-current={i === current ? 'step' : undefined}
                      className={cn(
                        'group relative flex min-h-11 w-full items-center gap-3 rounded-lg py-2 pr-3 pl-4 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                        i === current
                          ? 'bg-card text-foreground shadow-sm ring-1 ring-border'
                          : 'text-muted-foreground hover:bg-card/70 hover:text-foreground',
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'absolute inset-y-2 left-0 w-0.5 rounded-full',
                          i === current
                            ? 'bg-primary'
                            : i < current
                              ? 'bg-primary/35'
                              : 'bg-transparent',
                        )}
                      />
                      <span
                        className={cn(
                          'ob-mono text-[11.5px] tabular-nums',
                          i <= current && 'text-primary',
                        )}
                      >
                        {pad(i + 1)}
                      </span>
                      <span className="font-medium text-sm">{NAMES[s]()}</span>
                    </button>
                  </li>
                ))}
              </ol>
            </nav>

            <div
              ref={scrollRef}
              className="relative min-w-0 flex-1 overflow-y-auto overscroll-contain"
            >
              <div
                key={id}
                data-step-enter=""
                style={{ '--ob-dir': `${direction.current * 18}px` } as CSSProperties}
                className="mx-auto w-full max-w-6xl px-5 pt-2 pb-8 sm:px-8 sm:pt-10 sm:pb-12 lg:px-12 lg:pt-14"
              >
                <Step data={data} actions={actions} guest={user.role === 'guest'} />
              </div>
            </div>
          </div>

          <footer className="shrink-0 space-y-3 border-border border-t bg-background/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-6 lg:px-8">
            {progress}
            <div className="flex items-center gap-2">
              <p
                className="ob-mono hidden text-[11px] text-muted-foreground uppercase md:block"
                aria-hidden="true"
              >
                {m.story_keys()}
              </p>
              <div className="ml-auto flex w-full items-center gap-2 sm:w-auto">
                {!first && (
                  <Button
                    variant="outline"
                    size="lg"
                    className="h-12 min-w-12 px-3 sm:px-4"
                    onClick={() => goTo(current - 1)}
                    aria-label={m.story_back()}
                  >
                    <ArrowLeft aria-hidden="true" />
                    <span className="hidden sm:inline">{m.story_back()}</span>
                  </Button>
                )}
                <Button
                  ref={primaryRef}
                  size="lg"
                  className="h-12 flex-1 gap-2 px-6 font-semibold sm:flex-none"
                  onClick={() => (last ? finish() : goTo(current + 1))}
                >
                  {last ? m.story_finish() : m.story_next()}
                  {!last && <ArrowRight aria-hidden="true" />}
                </Button>
              </div>
            </div>
          </footer>
          <p className="sr-only" role="status" aria-live="polite">
            {m.story_live({ current: current + 1, total: STORY_TOTAL, title: name })}
          </p>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
