export interface FioInput {
  potentialT: number;
  collectedT: number;
  reuseT: number;
  recycleT: number;
  rejectT: number;
}

export type FioNodeId = 'collected' | 'missing' | 'reuse' | 'recycle' | 'reject';

export interface FioSegment {
  id: FioNodeId;
  tonnes: number;
  /** % da barra: do potencial (recolhido e por captar) ou do recolhido (destinos). */
  pct: number;
}

export interface FioBars {
  potentialT: number;
  /** Potencial = recolhido + por captar. */
  top: FioSegment[];
  /** Destino do recolhido: reutilização, reciclagem e rejeito (vazio sem destino registado). */
  bottom: FioSegment[];
  /** Largura do recolhido na barra de cima, que é a do fio que o liga à barra de baixo. */
  collectedPct: number;
}

const clean = (v: number): number => (Number.isFinite(v) && v > 0 ? v : 0);

/**
 * Duas barras ligadas por um fio: em cima o potencial (estimativa) partido no recolhido e no que falta; em baixo o
 * recolhido partido pelos seus destinos. Tudo em percentagens para o CSS desenhar sem medir nada; valores em falta ou
 * inválidos contam como 0 e o recolhido nunca passa do potencial.
 */
export function fioBars(input: FioInput): FioBars {
  const potential = clean(input.potentialT);
  const collected = Math.min(clean(input.collectedT), potential);
  const missing = potential - collected;
  const pctOf = (v: number, total: number) => (total > 0 ? (v / total) * 100 : 0);
  const dest: [FioNodeId, number][] = [
    ['reuse', clean(input.reuseT)],
    ['recycle', clean(input.recycleT)],
    ['reject', clean(input.rejectT)],
  ];
  const destTotal = dest.reduce((s, [, v]) => s + v, 0);
  return {
    potentialT: potential,
    top: [
      { id: 'collected', tonnes: collected, pct: pctOf(collected, potential) },
      { id: 'missing', tonnes: missing, pct: pctOf(missing, potential) },
    ],
    bottom:
      destTotal > 0 ? dest.map(([id, t]) => ({ id, tonnes: t, pct: pctOf(t, destTotal) })) : [],
    collectedPct: pctOf(collected, potential),
  };
}
