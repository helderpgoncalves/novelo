import { useEffect, useState } from 'react';
import type { Box, Size } from './placement';
import { candidates, isUsableTarget, spotlightBox, visibleFraction } from './target';

const readViewport = (): Size => ({ width: window.innerWidth, height: window.innerHeight });

/** O primeiro alvo utilizável (visível, plausível) entre os seletores; `null` se nenhum (o passo fica centrado). */
export function resolveTarget(
  selectors: readonly string[],
  root: ParentNode = document,
  viewport: Size = readViewport(),
): HTMLElement | null {
  return candidates(selectors, root).find((el) => isUsableTarget(el, viewport)) ?? null;
}

/** Retângulo (com folga) do alvo, cortado ao que se vê e sempre dentro do viewport. */
export const boxOf = (el: Element): Box => spotlightBox(el, readViewport());

const same = (a: Box | null, b: Box | null) =>
  a === b ||
  (a !== null &&
    b !== null &&
    Math.abs(a.x - b.x) < 0.5 &&
    Math.abs(a.y - b.y) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5);

export interface Target {
  box: Box;
  el: HTMLElement;
}

const SETTLE_FRAMES = 3;
const SETTLE_MAX_MS = 900;

/**
 * Segue o alvo enquanto `enabled`. Antes de o destacar traz-o ao centro de todos os ancestrais com scroll (a lista da
 * barra lateral é um deles) e espera que o scroll assente; só então mede. Reposiciona em scroll, redimensionamento,
 * teclado do iOS e mudanças de tamanho. Um alvo cortado ou implausível é descartado (próximo seletor ou cartão centrado).
 */
export function useTargetRect(
  selectors: readonly string[],
  enabled: boolean,
  reducedMotion = false,
): Target | null {
  const [target, setTarget] = useState<Target | null>(null);
  const key = selectors.join('|');

  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` representa `selectors`
  useEffect(() => {
    if (!enabled || selectors.length === 0) {
      setTarget(null);
      return;
    }
    let el: HTMLElement | null = null;
    let frame = 0;
    let observer: ResizeObserver | undefined;
    let settling: { since: number; stable: number; last: string; el: HTMLElement } | null = null;
    let disposed = false;
    const scrolled = new WeakSet<Element>();

    const publish = (next: Target | null) =>
      setTarget((prev) =>
        prev?.el === next?.el && same(prev?.box ?? null, next?.box ?? null) ? prev : next,
      );

    const watch = (found: HTMLElement | null) => {
      observer?.disconnect();
      el = found;
      if (el) {
        observer = new ResizeObserver(schedule);
        observer.observe(el);
        // A lista pode redimensionar-se (ex.: o selo de pedidos pendentes) sem o alvo mudar.
        if (el.parentElement) observer.observe(el.parentElement);
      }
    };

    const measure = () => {
      frame = 0;
      if (disposed) return;
      const viewport = readViewport();

      // 1. A assentar: o alvo foi pedido ao scroll; espera que a posição deixe de mudar.
      if (settling) {
        const r = settling.el.getBoundingClientRect();
        const sig = `${Math.round(r.left)}:${Math.round(r.top)}:${Math.round(r.width)}:${Math.round(r.height)}`;
        settling.stable = sig === settling.last ? settling.stable + 1 : 0;
        settling.last = sig;
        if (settling.stable < SETTLE_FRAMES && performance.now() - settling.since < SETTLE_MAX_MS) {
          schedule();
          return;
        }
        settling = null;
      }

      // 2. O alvo atual continua válido?
      if (el?.isConnected && isUsableTarget(el, viewport)) {
        publish({ box: spotlightBox(el, viewport), el });
        return;
      }

      // 3. Procurar de novo: o primeiro candidato renderizado que fique à vista (depois de o trazer ao centro).
      watch(null);
      for (const cand of candidates(selectors)) {
        const r = cand.getBoundingClientRect();
        const cs = getComputedStyle(cand);
        if (r.width < 2 || r.height < 2 || cs.display === 'none' || cs.visibility === 'hidden')
          continue;
        if (!scrolled.has(cand) && visibleFraction(cand, viewport) < 0.999) {
          scrolled.add(cand);
          cand.scrollIntoView({
            block: 'center',
            inline: 'nearest',
            behavior: reducedMotion ? 'auto' : 'smooth',
          });
          if (!reducedMotion) {
            // espera o fim do scroll suave e volta a medir (sem publicar posições intermédias)
            watch(cand);
            settling = { since: performance.now(), stable: 0, last: '', el: cand };
            schedule();
            return;
          }
        }
        if (isUsableTarget(cand, viewport)) {
          watch(cand);
          publish({ box: spotlightBox(cand, viewport), el: cand });
          return;
        }
      }
      publish(null);
    };
    function schedule() {
      if (!frame) frame = requestAnimationFrame(measure);
    }

    measure();
    const vv = window.visualViewport;
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    window.addEventListener('scrollend', schedule, true);
    vv?.addEventListener('resize', schedule);
    vv?.addEventListener('scroll', schedule);
    // Rede de segurança: layout assíncrono (rota a montar, fontes, animações da gaveta).
    const poll = window.setInterval(schedule, 400);
    return () => {
      disposed = true;
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      window.clearInterval(poll);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      window.removeEventListener('scrollend', schedule, true);
      vv?.removeEventListener('resize', schedule);
      vv?.removeEventListener('scroll', schedule);
    };
  }, [key, enabled, reducedMotion]);

  return enabled ? target : null;
}
