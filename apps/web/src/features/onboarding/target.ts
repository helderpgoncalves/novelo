/**
 * Escolha e validação do alvo de um passo da visita (funções sem estado, testadas).
 * Um alvo só é bom se for o elemento esperado (seletor exato), se estiver realmente visível (não cortado por um
 * ancestral com scroll, como a lista da barra lateral) e se o seu retângulo for plausível (nem minúsculo nem
 * do tamanho do ecrã). Caso contrário o passo tenta o seletor seguinte ou fica centrado.
 */
import type { Box, Size } from './placement';

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Fração mínima do alvo que tem de estar visível para ser destacado. */
export const MIN_VISIBLE = 0.85;
/** Tamanho mínimo (px) e máximo (fração do viewport) de um alvo plausível. */
export const MIN_SIZE = 8;
export const MAX_WIDTH_RATIO = 0.9;
export const MAX_HEIGHT_RATIO = 0.5;

const intersect = (a: Rect, b: Rect): Rect => ({
  left: Math.max(a.left, b.left),
  top: Math.max(a.top, b.top),
  right: Math.min(a.right, b.right),
  bottom: Math.min(a.bottom, b.bottom),
});

const area = (r: Rect) => Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top);

const toRect = (r: DOMRect | Rect): Rect => ({
  left: r.left,
  top: r.top,
  right: r.right,
  bottom: r.bottom,
});

const clips = (el: Element): boolean => {
  const cs = getComputedStyle(el);
  return [cs.overflow, cs.overflowX, cs.overflowY].some((v) => v !== '' && v !== 'visible');
};

/** Parte do elemento que o utilizador vê: o retângulo cortado por todos os ancestrais com overflow e pelo viewport. */
export function visibleRect(el: Element, viewport: Size): Rect {
  let rect = intersect(toRect(el.getBoundingClientRect()), {
    left: 0,
    top: 0,
    right: viewport.width,
    bottom: viewport.height,
  });
  for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
    if (clips(p)) rect = intersect(rect, toRect(p.getBoundingClientRect()));
  }
  return rect;
}

/** 0 a 1: quanto do elemento está à vista. */
export function visibleFraction(el: Element, viewport: Size): number {
  const full = toRect(el.getBoundingClientRect());
  const total = area(full);
  return total > 0 ? area(visibleRect(el, viewport)) / total : 0;
}

/** O retângulo é de um controlo (não de um contentor nem de um ponto)? */
export function isPlausibleRect(r: Rect, viewport: Size): boolean {
  const w = r.right - r.left;
  const h = r.bottom - r.top;
  return (
    w >= MIN_SIZE &&
    h >= MIN_SIZE &&
    w <= viewport.width * MAX_WIDTH_RATIO &&
    h <= viewport.height * MAX_HEIGHT_RATIO
  );
}

/** Renderizado e não escondido (display/visibility), embora possa estar fora de vista. */
export function isRendered(el: Element): boolean {
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== 'hidden' && cs.display !== 'none';
}

/** Elementos candidatos por ordem de preferência (seletor a seletor, ordem do documento). */
export function candidates(
  selectors: readonly string[],
  root: ParentNode = document,
): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const selector of selectors) {
    let found: NodeListOf<Element>;
    try {
      found = root.querySelectorAll(selector);
    } catch {
      continue; // seletor inválido nunca parte a visita
    }
    for (const el of found) if (el instanceof HTMLElement && !out.includes(el)) out.push(el);
  }
  return out;
}

/** O alvo é utilizável: renderizado, bem visível e com tamanho plausível. */
export function isUsableTarget(el: Element, viewport: Size): boolean {
  return (
    isRendered(el) &&
    visibleFraction(el, viewport) >= MIN_VISIBLE &&
    isPlausibleRect(visibleRect(el, viewport), viewport)
  );
}

/** Caixa do spotlight: o retângulo visível com folga, sempre dentro do viewport. */
export function spotlightBox(el: Element, viewport: Size, pad = 6, inset = 4): Box {
  const r = visibleRect(el, viewport);
  const left = Math.max(inset, r.left - pad);
  const top = Math.max(inset, r.top - pad);
  const right = Math.min(viewport.width - inset, r.right + pad);
  const bottom = Math.min(viewport.height - inset, r.bottom + pad);
  return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}
