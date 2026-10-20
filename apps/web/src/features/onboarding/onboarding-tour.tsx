import { useNavigate } from '@tanstack/react-router';
import { ArrowLeft, ArrowRight, ShieldAlert } from 'lucide-react';
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import type { MeOut } from '@/client';
import { Button } from '@/components/ui/button';
import { useReducedMotion } from '@/features/copilot/use-reduced-motion';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cn } from '@/lib/utils';
import { m } from '@/paraglide/messages';
import {
  computePlacement,
  type Placement,
  type Side,
  type Size,
  sheetBottomOffset,
} from './placement';
import { clampStep, stepsFor } from './steps';
import {
  canResumeTour,
  clearTourProgress,
  consumeTourPending,
  markTourSeen,
  openTour,
  readTourProgress,
  setTourIndex,
  setTourOpen,
  shouldAutoOpenTour,
  useTourState,
  writeTourProgress,
} from './tour-store';
import { TourWelcome } from './tour-welcome';
import { useOnboarding } from './use-onboarding';
import { useTargetRect } from './use-target-rect';

const isMac = () => typeof navigator !== 'undefined' && /mac/i.test(navigator.userAgent);
const SHORTCUT = () => (isMac() ? '⌘K' : 'Ctrl K');
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const SCRIM = 'rgba(11, 20, 17, 0.66)';
const AREIA = '#c4a06a';

const arrowSide: Record<Side, string> = {
  // `side` é o lado do alvo em que o cartão está; a seta fica na aresta oposta do cartão.
  right: '-left-1.5 border-b border-l',
  left: '-right-1.5 border-t border-r',
  bottom: '-top-1.5 border-t border-l',
  top: '-bottom-1.5 border-r border-b',
};

function Arrow({ side, offset }: { side: Side; offset: number }) {
  const vertical = side === 'left' || side === 'right';
  return (
    <span
      aria-hidden="true"
      className={cn('absolute size-3 rotate-45 border-border bg-card', arrowSide[side])}
      style={vertical ? { top: offset - 6 } : { left: offset - 6 }}
    />
  );
}

/** Tamanho do viewport (visível), atualizado em redimensionamento e rotação. */
const readViewport = (): Size => ({ width: window.innerWidth, height: window.innerHeight });
function useViewport(): Size {
  const [size, setSize] = useState<Size>(readViewport);
  useEffect(() => {
    const update = () => setSize(readViewport());
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);
  return size;
}

/**
 * Introdução guiada ao Novelo: boas-vindas com os números reais de Guimarães e, depois, um percurso com os
 * elementos verdadeiros em destaque (máscara suave + cartão ancorado; folha inferior em telemóvel).
 * Visita curta para o convidado, completa para operador e administrador. O estado vive no servidor (por conta)
 * com o `localStorage` como cache; o passo sobrevive à navegação e pode ser saltado e retomado.
 */
export function OnboardingTour({ user }: { user: MeOut }) {
  const { open, index } = useTourState();
  const { me, update } = useOnboarding(user);
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const mobile = useMediaQuery('(max-width: 639px)');
  const viewport = useViewport();

  const steps = useMemo(() => stepsFor(user.role), [user.role]);
  const total = steps.length;
  const current = clampStep(index, total);
  const step = steps[current] ?? steps[0];
  const first = current === 0;
  const last = current === total - 1;
  const short = user.role === 'guest';

  // ---- abertura automática (uma vez por montagem), com retoma do ponto onde ficou --------------------------
  const pendingRef = useRef<boolean | null>(null);
  const autoRef = useRef(false);
  useEffect(() => {
    if (pendingRef.current === null) pendingRef.current = consumeTourPending();
    if (autoRef.current) return;
    if (!shouldAutoOpenTour(me, pendingRef.current)) return;
    const id = window.setTimeout(() => {
      autoRef.current = true;
      const resume = canResumeTour(me.id, total) ? readTourProgress(me.id) : 0;
      openTour(resume);
    }, 700);
    return () => window.clearTimeout(id);
  }, [me, total]);

  // ---- fechar ---------------------------------------------------------------------------------------------
  const finish = useCallback(() => {
    markTourSeen(user.id);
    clearTourProgress(user.id);
    update({ tour: 'seen' });
    setTourOpen(false);
  }, [user.id, update]);

  const skip = useCallback(() => {
    markTourSeen(user.id);
    if (current > 0 && !last) writeTourProgress(user.id, current);
    update({ tour: 'seen' });
    setTourOpen(false);
  }, [user.id, current, last, update]);

  const goTo = useCallback(
    (next: number) => {
      const clamped = clampStep(next, total);
      setTourIndex(clamped);
      if (clamped > 0 && clamped < total - 1) writeTourProgress(user.id, clamped);
    },
    [total, user.id],
  );

  // ---- alvo, posição e medidas ----------------------------------------------------------------------------
  const target = useTargetRect(step?.targets ?? [], open && step?.kind === 'spot');
  const box = target?.box ?? null;
  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const [card, setCard] = useState<Size | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: mede de novo quando muda o passo ou o modo
  useLayoutEffect(() => {
    const el = dialogRef.current;
    if (!open || !el) return;
    const measure = () => setCard({ width: el.offsetWidth, height: el.offsetHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open, step?.id, mobile]);

  // ---- foco: guardado à abertura, preso enquanto aberta, devolvido ao fechar -------------------------------
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    returnFocus.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      const el = returnFocus.current;
      returnFocus.current = null;
      if (el?.isConnected) el.focus({ preventScroll: true });
    };
  }, [open]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: o foco acompanha o passo
  useEffect(() => {
    if (open) primaryRef.current?.focus({ preventScroll: true });
  }, [open, step?.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const swallow = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') return swallow(); // o Copiloto fica para depois
      if (e.altKey || e.metaKey || e.ctrlKey) return;
      if (e.key === 'Escape') {
        swallow();
        skip();
      } else if (e.key === 'ArrowRight') {
        swallow();
        if (!last) goTo(current + 1);
      } else if (e.key === 'ArrowLeft') {
        swallow();
        if (!first) goTo(current - 1);
      } else if (e.key === 'Tab') {
        const nodes = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
        const [head, tail] = [nodes[0], nodes[nodes.length - 1]];
        if (!head || !tail) return;
        const active = document.activeElement;
        const inside = dialogRef.current?.contains(active);
        if (!inside || (e.shiftKey && active === head) || (!e.shiftKey && active === tail)) {
          swallow();
          (e.shiftKey ? tail : head).focus();
        }
      }
    };
    const onFocusIn = (e: FocusEvent) => {
      if (e.target instanceof Node && !dialogRef.current?.contains(e.target))
        primaryRef.current?.focus({ preventScroll: true });
    };
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [open, skip, goTo, current, first, last]);

  if (!open || !step) return null;

  // ---- geometria ------------------------------------------------------------------------------------------
  const spot = step.kind === 'spot' && box !== null;
  const centred = !spot;
  let cardStyle: CSSProperties;
  let placement: Placement | null = null;
  let sheetOffset = 0;
  let arrowLeft: number | null = null;

  if (mobile) {
    sheetOffset = spot ? sheetBottomOffset(box, viewport) : 0;
    if (spot && sheetOffset > 0 && box) {
      arrowLeft = Math.min(Math.max(box.x + box.width / 2 - 12, 28), viewport.width - 28 - 12);
    }
    cardStyle = {
      left: 'max(0.75rem, env(safe-area-inset-left))',
      right: 'max(0.75rem, env(safe-area-inset-right))',
      bottom: `calc(${sheetOffset > 0 ? `${sheetOffset}px` : 'env(safe-area-inset-bottom)'} + 0.75rem)`,
      maxHeight: `calc(100dvh - ${sheetOffset}px - env(safe-area-inset-top) - 1.5rem)`,
    };
  } else {
    const width = centred ? 448 : 360;
    const size: Size = card ?? { width, height: 320 };
    if (spot && box) placement = computePlacement(box, size, viewport);
    const x = placement ? placement.x : (viewport.width - size.width) / 2;
    const y = placement ? placement.y : (viewport.height - size.height) / 2;
    cardStyle = { width, left: x, top: y, maxHeight: viewport.height - 24 };
  }

  const hole =
    box && spot ? box : { x: viewport.width / 2, y: viewport.height / 2, width: 0, height: 0 };
  const motion = reduced ? 'none' : '280ms cubic-bezier(0.2, 0.8, 0.2, 1)';
  const stepLabel = m.tour_step({ current: current + 1, total });
  const title = step.title();
  const text = step.text({ shortcut: SHORTCUT() });
  const showMore = spot && step.moreHint && target?.el.matches('button');

  const back = (
    <Button
      variant="outline"
      size="lg"
      className="h-11 min-w-11 px-3 sm:px-4"
      onClick={() => goTo(current - 1)}
      aria-label={m.tour_back()}
    >
      <ArrowLeft aria-hidden="true" />
      <span className="hidden sm:inline">{m.tour_back()}</span>
    </Button>
  );

  return createPortal(
    <div
      data-testid="onboarding-tour"
      className="fixed inset-0 z-[70] touch-none overscroll-contain"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Máscara suave com buraco no alvo: a sombra enorme escurece tudo menos a caixa. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute rounded-xl"
        style={{
          left: hole.x,
          top: hole.y,
          width: hole.width,
          height: hole.height,
          boxShadow: spot
            ? `0 0 0 2px ${AREIA}, 0 0 28px 6px rgba(196, 160, 106, 0.28), 0 0 0 200vmax ${SCRIM}`
            : `0 0 0 200vmax ${SCRIM}`,
          transition: reduced
            ? 'none'
            : `left ${motion}, top ${motion}, width ${motion}, height ${motion}, box-shadow ${motion}`,
        }}
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-text"
        className={cn(
          'absolute flex touch-pan-y flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl',
          !mobile && !card && 'opacity-0',
        )}
        style={{
          ...cardStyle,
          transition:
            reduced || mobile ? 'none' : `left ${motion}, top ${motion}, opacity 200ms ease-out`,
        }}
      >
        {placement && <Arrow side={placement.side} offset={placement.arrow} />}
        {mobile && arrowLeft !== null && (
          <span
            aria-hidden="true"
            className="absolute -bottom-1.5 size-3 rotate-45 border-border border-r border-b bg-card"
            style={{ left: arrowLeft - (typeof cardStyle.left === 'number' ? cardStyle.left : 12) }}
          />
        )}

        <div className="overflow-y-auto overscroll-contain p-5 pb-4 sm:p-6 sm:pb-4">
          <div
            role="progressbar"
            aria-label={m.tour_progress()}
            aria-valuemin={1}
            aria-valuemax={total}
            aria-valuenow={current + 1}
            aria-valuetext={stepLabel}
            className="mb-4 flex gap-1"
          >
            {steps.map((s, i) => (
              <span
                key={s.id}
                className={cn(
                  'h-1 flex-1 rounded-full',
                  !reduced && 'transition-colors duration-300',
                  i <= current ? 'bg-primary' : 'bg-border',
                )}
              />
            ))}
          </div>

          <div
            key={step.id}
            className="motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:animate-in duration-300"
          >
            {step.kind === 'welcome' ? (
              <TourWelcome short={short} active={open} />
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <step.icon className="size-5" aria-hidden="true" />
                  </span>
                  <p className="font-semibold text-[11px] text-primary uppercase tracking-[0.18em]">
                    {stepLabel}
                  </p>
                </div>
                <h2
                  id="tour-title"
                  className="text-balance font-serif text-xl leading-snug sm:text-2xl"
                >
                  {title}
                </h2>
                <p id="tour-text" className="text-muted-foreground text-sm leading-relaxed">
                  {text}
                </p>
                {showMore && (
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {m.tour_more_hint()}
                  </p>
                )}
                {step.kind === 'finish' && (
                  <>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {m.tour_finish_checklist()}
                    </p>
                    {short && (
                      <p className="flex gap-2.5 rounded-lg bg-muted/60 p-3 text-muted-foreground text-sm leading-relaxed">
                        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        {m.tour_guest_note()}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
          <p className="sr-only" role="status" aria-live="polite">
            {m.tour_live({ current: current + 1, total, title })}
          </p>
        </div>

        <div
          className={cn(
            'border-border/70 border-t bg-card px-5 py-3 sm:px-6',
            mobile && sheetOffset === 0 && 'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
          )}
        >
          {last ? (
            <div className="flex flex-col gap-2">
              <Button
                ref={primaryRef}
                size="lg"
                className="h-11 w-full font-semibold"
                onClick={() => {
                  finish();
                  void navigate({ to: '/simulator' });
                }}
              >
                {m.tour_finish_cta()}
                <ArrowRight aria-hidden="true" />
              </Button>
              <div className="flex items-center justify-between gap-2">
                {back}
                <Button variant="ghost" size="lg" className="h-11" onClick={finish}>
                  {m.tour_explore()}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="lg" className="-ml-2 h-11 px-3" onClick={skip}>
                {m.tour_skip()}
              </Button>
              <div className="ml-auto flex items-center gap-2">
                {!first && back}
                <Button
                  ref={primaryRef}
                  size="lg"
                  className="h-11 px-5 font-semibold"
                  onClick={() => goTo(current + 1)}
                >
                  {first ? m.tour_start() : m.tour_next()}
                  <ArrowRight aria-hidden="true" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
