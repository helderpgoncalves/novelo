/**
 * Geometria do «fio» do hero: funções puras, sem DOM. O fio é uma curva de Bézier cúbica contínua (lê-se como uma linha de
 * fio, sem cantos) desenhada num `viewBox` fixo; o troço cheio vai até à fração do comprimento que a Vitrus já recolhe
 * (301,3 t de ≈ 1 317 t = 22,9 %) e o resto, a tracejado, é o que falta captar. As posições dos nós saem do comprimento de
 * arco real da curva, por isso 22,9 % do fio é mesmo 22,9 % do fio (e não 22,9 % da largura).
 */
import { FACTS } from './facts';

/** Dimensões do `viewBox` horizontal (a proporção fixa mantém a curva e o traço sem deformação). */
export const FIO_W = 1000;
export const FIO_H = 200;

type Point = readonly [number, number];
type Cubic = readonly [Point, Point, Point, Point];

/** Quatro troços encadeados com tangentes contínuas: sobe do vale (esquerda, em baixo), corre ao longo do horizonte e trepa ao campanário (direita, em cima). */
const SEGMENTS: readonly Cubic[] = [
  [
    [0, 190],
    [110, 192],
    [220, 186],
    [320, 160],
  ],
  [
    [320, 160],
    [420, 134],
    [470, 112],
    [560, 106],
  ],
  [
    [560, 106],
    [650, 100],
    [760, 104],
    [830, 96],
  ],
  [
    [830, 96],
    [900, 88],
    [950, 40],
    [FIO_W, 6],
  ],
];

const STEPS = 160;

function cubicAt([p0, p1, p2, p3]: Cubic, t: number): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ];
}

/** Tabela de comprimento de arco (pontos amostrados e comprimento acumulado), calculada uma vez. */
const TABLE = (() => {
  const points: Point[] = [];
  const lengths: number[] = [];
  let total = 0;
  for (const seg of SEGMENTS) {
    for (let i = points.length === 0 ? 0 : 1; i <= STEPS; i++) {
      const p = cubicAt(seg, i / STEPS);
      const prev = points[points.length - 1];
      if (prev) total += Math.hypot(p[0] - prev[0], p[1] - prev[1]);
      points.push(p);
      lengths.push(total);
    }
  }
  return { points, lengths, total };
})();

/** Atributo `d` do SVG para o fio inteiro. */
export const FIO_PATH = SEGMENTS.map((seg, i) => {
  const [p0, p1, p2, p3] = seg;
  const move = i === 0 ? `M${p0[0]} ${p0[1]} ` : '';
  return `${move}C${p1[0]} ${p1[1]} ${p2[0]} ${p2[1]} ${p3[0]} ${p3[1]}`;
}).join(' ');

/** Ponto do fio à fração `f` (0 a 1) do comprimento. */
export function fioPointAt(f: number): { x: number; y: number } {
  const target = Math.min(1, Math.max(0, f)) * TABLE.total;
  const { points, lengths } = TABLE;
  let lo = 0;
  let hi = lengths.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((lengths[mid] ?? 0) < target) lo = mid + 1;
    else hi = mid;
  }
  const b = points[lo] ?? points[points.length - 1] ?? [0, 0];
  if (lo === 0) return { x: b[0], y: b[1] };
  const a = points[lo - 1] ?? b;
  const la = lengths[lo - 1] ?? 0;
  const lb = lengths[lo] ?? la;
  const k = lb > la ? (target - la) / (lb - la) : 0;
  return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k };
}

/** Fração do potencial que já se recolhe (301,3 t ÷ 1 317,4 t): onde acaba o troço cheio. */
export const CAPTURED = FACTS.collectedT / FACTS.potentialT;
/** O que falta captar, em toneladas (estimativa), arredondado como na sala de decisão. */
export const GAP_T = Math.round(FACTS.potentialT - FACTS.collectedT);
/** Meio do troço tracejado (por comprimento): onde vive a marca do que falta. */
export const GAP_MID = (CAPTURED + 1) / 2;

export type FioMarks = {
  /** Fim do troço cheio. */
  solid: { x: number; y: number };
  /** Meio do troço tracejado. */
  gap: { x: number; y: number };
  /** Ponta do fio (o campanário). */
  end: { x: number; y: number };
};

export const FIO_MARKS: FioMarks = {
  solid: fioPointAt(CAPTURED),
  gap: fioPointAt(GAP_MID),
  end: fioPointAt(1),
};
