/** Geometria do popover da visita (funções puras, testadas): onde pôr o cartão junto do alvo e a seta que o liga. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface Size {
  width: number;
  height: number;
}
export type Side = 'right' | 'left' | 'bottom' | 'top';
export interface Placement {
  x: number;
  y: number;
  side: Side;
  /** Posição da seta ao longo da aresta do cartão que toca o alvo (px desde o canto do cartão). */
  arrow: number;
}

const ORDER: Record<Side, Side[]> = {
  right: ['right', 'bottom', 'left', 'top'],
  bottom: ['bottom', 'right', 'left', 'top'],
  left: ['left', 'bottom', 'right', 'top'],
  top: ['top', 'right', 'left', 'bottom'],
};

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/** Lado preferido: junto da barra lateral o cartão abre para a direita; no topo, para baixo. */
export function preferredSide(target: Box, viewport: Size): Side {
  const cx = target.x + target.width / 2;
  const cy = target.y + target.height / 2;
  if (target.height >= viewport.height * 0.4 && cx < viewport.width / 2) return 'right';
  if (cy < viewport.height * 0.25) return 'bottom';
  if (cx < viewport.width * 0.35) return 'right';
  if (cy > viewport.height * 0.75) return 'top';
  return 'bottom';
}

export function computePlacement(
  target: Box,
  card: Size,
  viewport: Size,
  {
    gap = 14,
    margin = 12,
    arrowInset = 20,
  }: { gap?: number; margin?: number; arrowInset?: number } = {},
): Placement {
  const room: Record<Side, number> = {
    right: viewport.width - (target.x + target.width) - gap - margin,
    left: target.x - gap - margin,
    bottom: viewport.height - (target.y + target.height) - gap - margin,
    top: target.y - gap - margin,
  };
  const fits = (s: Side) =>
    s === 'left' || s === 'right' ? room[s] >= card.width : room[s] >= card.height;
  const order = ORDER[preferredSide(target, viewport)];
  const side =
    order.find(fits) ??
    // nenhum lado cabe: o que tem mais espaço (o cartão sobrepõe-se o mínimo ao alvo)
    [...order].sort((a, b) => room[b] - room[a])[0] ??
    'bottom';

  let x: number;
  let y: number;
  if (side === 'right') {
    x = target.x + target.width + gap;
    y = target.y + target.height / 2 - card.height / 2;
  } else if (side === 'left') {
    x = target.x - gap - card.width;
    y = target.y + target.height / 2 - card.height / 2;
  } else if (side === 'bottom') {
    x = target.x + target.width / 2 - card.width / 2;
    y = target.y + target.height + gap;
  } else {
    x = target.x + target.width / 2 - card.width / 2;
    y = target.y - gap - card.height;
  }
  x = clamp(x, margin, viewport.width - card.width - margin);
  y = clamp(y, margin, viewport.height - card.height - margin);

  const along =
    side === 'left' || side === 'right'
      ? target.y + target.height / 2 - y
      : target.x + target.width / 2 - x;
  const length = side === 'left' || side === 'right' ? card.height : card.width;
  return { x, y, side, arrow: clamp(along, arrowInset, length - arrowInset) };
}

/** Folha inferior (telemóvel): se o alvo está na metade de baixo, a folha sobe para o deixar à vista. */
export function sheetBottomOffset(target: Box | null, viewport: Size, gap = 14): number {
  if (!target) return 0;
  const centre = target.y + target.height / 2;
  if (centre < viewport.height * 0.5) return 0;
  return Math.max(0, viewport.height - target.y + gap);
}
