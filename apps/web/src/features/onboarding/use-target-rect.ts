import { useEffect, useState } from 'react';
import type { Box } from './placement';

const PAD = 6;

const isVisible = (el: Element): boolean => {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== 'hidden' && cs.display !== 'none';
};

/** O primeiro elemento visível que corresponde a um dos seletores (ou `null`: papel sem acesso, ecrã estreito...). */
export function resolveTarget(
  selectors: readonly string[],
  root: ParentNode = document,
): HTMLElement | null {
  for (const selector of selectors) {
    let found: NodeListOf<Element>;
    try {
      found = root.querySelectorAll(selector);
    } catch {
      continue; // seletor inválido nunca parte a visita
    }
    for (const el of found) if (el instanceof HTMLElement && isVisible(el)) return el;
  }
  return null;
}

/** Retângulo do alvo, em coordenadas do viewport e com folga; `null` se não houver alvo visível. */
export const boxOf = (el: Element): Box => {
  const r = el.getBoundingClientRect();
  return { x: r.left - PAD, y: r.top - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 };
};

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

/**
 * Segue o alvo enquanto `enabled`: reposiciona em scroll, redimensionamento, teclado do iOS e mudanças de tamanho,
 * e volta a procurá-lo se desaparecer ou ainda não existir (a rota pode estar a montar).
 */
export function useTargetRect(selectors: readonly string[], enabled: boolean): Target | null {
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

    const measure = () => {
      frame = 0;
      if (!(el?.isConnected && isVisible(el))) {
        observer?.disconnect();
        el = resolveTarget(selectors);
        if (el) {
          observer = new ResizeObserver(schedule);
          observer.observe(el);
          // O alvo pode estar fora do ecrã (lista de navegação com scroll): traz-se à vista antes de o destacar.
          const r = el.getBoundingClientRect();
          if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: 'nearest' });
        }
      }
      const next = el ? { box: boxOf(el), el } : null;
      setTarget((prev) =>
        prev?.el === next?.el && same(prev?.box ?? null, next?.box ?? null) ? prev : next,
      );
    };
    function schedule() {
      if (!frame) frame = requestAnimationFrame(measure);
    }

    measure();
    const vv = window.visualViewport;
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    vv?.addEventListener('resize', schedule);
    vv?.addEventListener('scroll', schedule);
    // Rede de segurança: layout assíncrono (rota a montar, fontes, animações da gaveta).
    const poll = window.setInterval(schedule, 400);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      window.clearInterval(poll);
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule, true);
      vv?.removeEventListener('resize', schedule);
      vv?.removeEventListener('scroll', schedule);
    };
  }, [key, enabled]);

  return enabled ? target : null;
}
