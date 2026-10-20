export interface FioInput {
  potentialT: number;
  collectedT: number;
  reuseT: number;
  recycleT: number;
  rejectT: number;
}

export type FioNodeId = 'potential' | 'collected' | 'missing' | 'reuse' | 'recycle' | 'reject';

export interface FioNode {
  id: FioNodeId;
  x: number;
  y: number;
  w: number;
  h: number;
  value: number;
  /** % do total da coluna de origem: potencial (recolhido e em falta) ou recolhido (destinos). */
  pct: number;
}

export interface FioRibbon {
  id: string;
  to: FioNodeId;
  d: string;
}

export interface FioLayout {
  nodes: FioNode[];
  ribbons: FioRibbon[];
  height: number;
  /** Extremidade do fio solto (onde termina o troço que falta), para o desenho do "esfiado". */
  loose: { x: number; y0: number; y1: number };
}

export interface FioOptions {
  width: number;
  /** Altura da faixa do potencial. */
  band: number;
  /** Largura dos nós. */
  nodeW: number;
  /** Colunas (x do início de cada nó): potencial, recolhido/em falta, destinos. */
  columns: [number, number, number];
  /** Folga mínima entre nós da mesma coluna. */
  gap: number;
  /** Altura mínima de um nó pequeno. */
  minNode: number;
}

const ribbon = (x0: number, a0: number, a1: number, x1: number, b0: number, b1: number): string => {
  const xm = (x0 + x1) / 2;
  const f = (n: number) => n.toFixed(1);
  return `M${f(x0)} ${f(a0)}C${f(xm)} ${f(a0)} ${f(xm)} ${f(b0)} ${f(x1)} ${f(b0)}L${f(x1)} ${f(b1)}C${f(xm)} ${f(b1)} ${f(xm)} ${f(a1)} ${f(x0)} ${f(a1)}Z`;
};

/**
 * Geometria do «fio»: uma faixa (potencial) que se parte no recolhido e no que falta (o fio solto), e o recolhido
 * volta a partir-se em reutilização, reciclagem e rejeito. As alturas são proporcionais às toneladas; os destinos,
 * muito finos, ganham uma altura mínima e uma folga para se ler o rótulo (a fita liga à altura real).
 */
export function fioLayout(input: FioInput, o: FioOptions): FioLayout {
  const potential = Math.max(1e-9, input.potentialT);
  const collected = Math.min(input.collectedT, potential);
  const missing = Math.max(0, potential - collected);
  const k = o.band / potential;
  const [xa, xb, xc] = o.columns;

  const hCollected = collected * k;
  const hMissing = missing * k;
  const nodes: FioNode[] = [
    { id: 'potential', x: xa, y: 0, w: o.nodeW, h: o.band, value: potential, pct: 100 },
    {
      id: 'collected',
      x: xb,
      y: 0,
      w: o.nodeW,
      h: hCollected,
      value: collected,
      pct: (collected / potential) * 100,
    },
    {
      id: 'missing',
      x: xb,
      y: hCollected + o.gap,
      w: o.nodeW,
      h: hMissing,
      value: missing,
      pct: (missing / potential) * 100,
    },
  ];
  const ribbons: FioRibbon[] = [
    {
      id: 'to-collected',
      to: 'collected',
      d: ribbon(xa + o.nodeW, 0, hCollected, xb, 0, hCollected),
    },
    {
      id: 'to-missing',
      to: 'missing',
      d: ribbon(
        xa + o.nodeW,
        hCollected,
        o.band,
        xb,
        hCollected + o.gap,
        hCollected + o.gap + hMissing,
      ),
    },
  ];

  const dest: [FioNodeId, number][] = [
    ['reuse', input.reuseT],
    ['recycle', input.recycleT],
    ['reject', input.rejectT],
  ];
  const destTotal = dest.reduce((s, [, v]) => s + v, 0) || 1;
  // Os destinos centram-se na altura do recolhido, com folga entre eles.
  const heights = dest.map(([, v]) => Math.max(o.minNode, (v / destTotal) * hCollected));
  const stack = heights.reduce((s, h) => s + h, 0) + o.gap * (dest.length - 1);
  let y = Math.max(0, hCollected / 2 - stack / 2);
  let src = 0;
  dest.forEach(([id, value], i) => {
    const h = heights[i] ?? o.minNode;
    const realH = (value / destTotal) * hCollected;
    nodes.push({ id, x: xc, y, w: o.nodeW, h, value, pct: (value / destTotal) * 100 });
    ribbons.push({
      id: `to-${id}`,
      to: id,
      d: ribbon(xb + o.nodeW, src, src + realH, xc, y + (h - realH) / 2, y + (h + realH) / 2),
    });
    src += realH;
    y += h + o.gap;
  });

  const bottom = Math.max(...nodes.map((n) => n.y + n.h));
  return {
    nodes,
    ribbons,
    height: bottom,
    loose: { x: xb + o.nodeW, y0: hCollected + o.gap, y1: hCollected + o.gap + hMissing },
  };
}
