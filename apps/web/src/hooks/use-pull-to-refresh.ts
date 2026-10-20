import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import {
  angleFromMatrix,
  appearance,
  clampWait,
  classifyGesture,
  degreesToAlign,
  isArmed,
  PULL_HOLD,
  rawFromDelta,
  resist,
} from '@/components/pull-to-refresh-math';
import { useMediaQuery } from '@/hooks/use-media-query';

export type PullPhase = '' | 'refreshing' | 'done';

const MIN_VISIBLE_MS = 600;
const MAX_WAIT_MS = 8000;
const LEAVE_MS = 300;
const ARC_DIRECTIONS = [1, -1, 1] as const;

const EDITABLE =
  'input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea, select, [contenteditable=""], [contenteditable="true"]';
/** Zonas onde o gesto nunca deve arrancar (campos, ou quem opta por sair com `data-no-ptr`). */
const BLOCKED_TARGET = `${EDITABLE}, [data-no-ptr]`;
/** Qualquer camada aberta por cima da página (diálogos, folhas, menus, o tour): o toque pertence-lhe. */
const OPEN_LAYER =
  '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"], [data-state="open"][data-radix-popper-content-wrapper]';

const scrolls = (overflow: string) => overflow === 'auto' || overflow === 'scroll';

/**
 * O toque começa dentro de algo que rola por si (tabela larga, carrossel, lista com scroll interno)?
 * Então o gesto é desse elemento e nunca o interpretamos como "puxar".
 */
function startsInsideScroller(target: Element, main: HTMLElement): boolean {
  for (let el: Element | null = target; el && el !== main; el = el.parentElement) {
    const wide = el.scrollWidth > el.clientWidth + 1;
    const tall = el.scrollHeight > el.clientHeight + 1;
    if (!wide && !tall) continue;
    const cs = getComputedStyle(el);
    if ((wide && scrolls(cs.overflowX)) || (tall && scrolls(cs.overflowY))) return true;
  }
  return false;
}

function isBlocked(target: EventTarget | null, main: HTMLElement): boolean {
  if (!(target instanceof Element)) return true;
  if (target.closest(BLOCKED_TARGET)) return true;
  if (document.activeElement?.matches(EDITABLE)) return true;
  if (document.querySelector(OPEN_LAYER)) return true;
  return startsInsideScroller(target, main);
}

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

interface Options {
  /** Contentor de scroll principal (`<main>`). */
  scrollRef: RefObject<HTMLElement | null>;
  /** Sem gesto nem botão (rotas em ecrã inteiro, como o mapa e o copiloto). */
  disabled?: boolean;
  /** Atualiza os dados; rejeita se falhar. */
  refresh: () => Promise<unknown>;
  onError: (error: unknown) => void;
}

/**
 * Puxar para atualizar. O gesto vive todo fora do React: `touchstart` passivo; só quando o toque arranca no
 * topo e é elegível se regista um `touchmove` não passivo, que larga assim que o gesto se revela rolagem
 * normal. Cada frame (rAF) escreve variáveis CSS no indicador (`clipRef`); o React só vê as 2-3 mudanças de fase
 * por atualização (texto para leitores de ecrã). A lógica numérica está em `pull-to-refresh-math.ts`.
 */
export function usePullToRefresh({ scrollRef, disabled = false, refresh, onError }: Options) {
  const clipRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<PullPhase>('');
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const latest = useRef({ refresh, onError });
  const runRef = useRef<() => void>(() => {});

  useEffect(() => {
    latest.current = { refresh, onError };
  });

  const touchCapable = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
  const gesture = !disabled && !reduced && touchCapable;

  useEffect(() => {
    const clip = clipRef.current;
    const main = scrollRef.current;
    if (disabled || !clip) {
      runRef.current = () => {};
      return;
    }

    let state: 'idle' | 'pulling' | 'refreshing' | 'done' | 'leaving' = 'idle';
    let tracking = false;
    let kind: ReturnType<typeof classifyGesture> = 'pending';
    let startX = 0;
    let startY = 0;
    let pull = 0;
    let armed = false;
    let raf = 0;
    let timer = 0;
    let announceTimer = 0;
    let alive = true;

    const setState = (next: typeof state) => {
      state = next;
      clip.dataset.state = next;
    };

    const paint = (value: number) => {
      const { scale, opacity } = appearance(value);
      const s = clip.style;
      s.setProperty('--ptr-y', value.toFixed(1));
      s.setProperty('--ptr-s', scale.toFixed(3));
      s.setProperty('--ptr-o', opacity.toFixed(3));
      s.setProperty('--pr', value.toFixed(1));
    };

    const setArmed = (next: boolean) => {
      if (next === armed) return;
      armed = next;
      clip.toggleAttribute('data-armed', next);
      if (next && !reduced && typeof navigator.vibrate === 'function') navigator.vibrate(8);
    };

    const frame = () => {
      raf = 0;
      if (state !== 'pulling') return;
      paint(pull);
      setArmed(isArmed(pull));
    };

    const placeAtMain = () => {
      const top = main?.getBoundingClientRect().top ?? 0;
      clip.style.setProperty('--ptr-top', `${Math.max(0, top).toFixed(0)}px`);
    };

    const hold = () => {
      const s = clip.style;
      s.setProperty('--ptr-y', String(PULL_HOLD));
      s.setProperty('--ptr-s', '1');
      s.setProperty('--ptr-o', '1');
    };

    const leave = () => {
      setArmed(false);
      setState('leaving');
      const s = clip.style;
      s.setProperty('--ptr-y', '0');
      s.setProperty('--ptr-s', '0.6');
      s.setProperty('--ptr-o', '0');
      timer = window.setTimeout(() => {
        setState('idle');
        clip.style.setProperty('--pr', '0');
        pull = 0;
      }, LEAVE_MS);
    };

    const alignArcs = () => {
      clip.querySelectorAll<SVGElement>('.ptr-arc').forEach((arc, i) => {
        const dir = ARC_DIRECTIONS[i] ?? 1;
        const angle = angleFromMatrix(getComputedStyle(arc).transform);
        arc.style.setProperty('--ok-from', `${angle.toFixed(1)}deg`);
        arc.style.setProperty('--ok-to', `${(angle + degreesToAlign(angle, dir)).toFixed(1)}deg`);
      });
    };

    const announce = (next: PullPhase) => {
      window.clearTimeout(announceTimer);
      setPhase(next);
      if (next === 'done') announceTimer = window.setTimeout(() => setPhase(''), 2000);
    };

    const startRefresh = async () => {
      if (state === 'refreshing' || state === 'done') return;
      window.clearTimeout(timer);
      if (state === 'idle' || state === 'leaving') {
        placeAtMain();
        paint(0);
      }
      setArmed(false);
      setState('refreshing');
      hold();
      announce('refreshing');
      const t0 = performance.now();
      let failure: { error: unknown } | null = null;
      try {
        const work = Promise.resolve(latest.current.refresh());
        work.catch(() => {}); // se o tempo-limite ganhar, o erro tardio não fica por tratar
        await Promise.race([work, sleep(MAX_WAIT_MS)]);
      } catch (error) {
        failure = { error };
      }
      const spent = performance.now() - t0;
      await sleep(clampWait(spent, MIN_VISIBLE_MS, MAX_WAIT_MS) - spent);
      if (!alive) return;
      if (failure) {
        announce('');
        latest.current.onError(failure.error);
        leave();
        return;
      }
      announce('done');
      if (reduced) {
        leave();
        return;
      }
      alignArcs();
      setState('done');
      timer = window.setTimeout(leave, 480);
    };

    runRef.current = () => {
      void startRefresh();
    };

    // --- Gesto -------------------------------------------------------------------------------------------------

    const stopTracking = () => {
      tracking = false;
      main?.removeEventListener('touchmove', onMove);
    };

    const abortPull = () => {
      stopTracking();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      if (kind === 'pull' && state === 'pulling') leave();
      kind = 'pending';
    };

    function onMove(e: TouchEvent) {
      const t = e.touches[0];
      if (!tracking || !main || !t || e.touches.length !== 1) {
        abortPull();
        return;
      }
      if (kind === 'pending') {
        kind = classifyGesture(t.clientX - startX, t.clientY - startY);
        if (kind === 'ignore') {
          stopTracking();
          return;
        }
        if (kind === 'pending') return;
        placeAtMain();
        setState('pulling');
      }
      if (main.scrollTop > 0) {
        abortPull();
        return;
      }
      const raw = rawFromDelta(t.clientY - startY);
      pull = resist(raw);
      // Só quando já é um "puxar" é que se trava a rolagem nativa (iOS antigo, rubber-band).
      if (raw > 0 && e.cancelable) e.preventDefault();
      if (!raf) raf = requestAnimationFrame(frame);
    }

    const onStart = (e: TouchEvent) => {
      if (!main || state !== 'idle' || e.touches.length !== 1) return;
      const t = e.touches[0];
      if (!t || main.scrollTop > 0 || isBlocked(e.target, main)) return;
      startX = t.clientX;
      startY = t.clientY;
      kind = 'pending';
      tracking = true;
      main.addEventListener('touchmove', onMove, { passive: false });
    };

    const onEnd = () => {
      if (!tracking) return;
      const wasPull = kind === 'pull' && state === 'pulling';
      stopTracking();
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      kind = 'pending';
      if (!wasPull) return;
      if (isArmed(pull)) void startRefresh();
      else leave();
    };

    if (gesture && main) {
      main.addEventListener('touchstart', onStart, { passive: true });
      main.addEventListener('touchend', onEnd, { passive: true });
      main.addEventListener('touchcancel', abortPull, { passive: true });
    }

    return () => {
      alive = false;
      window.clearTimeout(timer);
      window.clearTimeout(announceTimer);
      if (raf) cancelAnimationFrame(raf);
      main?.removeEventListener('touchstart', onStart);
      main?.removeEventListener('touchend', onEnd);
      main?.removeEventListener('touchcancel', abortPull);
      main?.removeEventListener('touchmove', onMove);
      runRef.current = () => {};
    };
  }, [disabled, gesture, reduced, scrollRef]);

  /** Atualiza sem gesto (botão, teclado, leitor de ecrã). */
  const trigger = useCallback(() => runRef.current(), []);

  return { clipRef, phase, trigger };
}
